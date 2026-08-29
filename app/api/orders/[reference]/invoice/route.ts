import { NextResponse } from "next/server";
import { getAccountIdentity } from "@/lib/auth/authorization";
import type { StripeMode } from "@/lib/env";
import { generateInvoicePdf } from "@/lib/invoice-pdf";
import { getStripe } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ reference: string }> },
) {
  const reference = (await params).reference;
  const token = new URL(request.url).searchParams.get("token");
  const user = await getAccountIdentity();
  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("*, order_items(*), invoices(*)")
    .eq("order_reference", reference)
    .maybeSingle();
  if (!order) return new NextResponse("Invoice unavailable", { status: 404 });
  let allowed =
    user?.id === order.customer_user_id ||
    (user?.profile.role === "admin" && user.aal === "aal2");
  if (!allowed && token) {
    const { data: tokenOrderId } = await admin.rpc("lookup_guest_order", {
      p_token: token,
    });
    allowed = tokenOrderId === order.id;
  }
  if (!allowed) return new NextResponse("Invoice unavailable", { status: 404 });

  const stripeInvoice = order.invoices
    .filter((invoice) => invoice.stripe_invoice_id)
    .sort((a, b) => b.version - a.version)[0];
  if (stripeInvoice?.stripe_invoice_id) {
    const mode = stripeInvoice.stripe_mode as StripeMode | null;
    let pdfUrl = stripeInvoice.invoice_pdf_url;
    if (!pdfUrl && (mode === "test" || mode === "live")) {
      try {
        const current = await getStripe(mode, false).invoices.retrieve(
          stripeInvoice.stripe_invoice_id,
        );
        pdfUrl = current.invoice_pdf ?? null;
        await admin
          .from("invoices")
          .update({
            stripe_status: current.status,
            hosted_invoice_url: current.hosted_invoice_url ?? null,
            invoice_pdf_url: pdfUrl,
          })
          .eq("id", stripeInvoice.id);
      } catch {
        // The stored Stripe URL remains the only permitted invoice source.
      }
    }
    if (pdfUrl)
      return NextResponse.redirect(pdfUrl, {
        headers: { "Cache-Control": "private, no-store" },
      });
    return new NextResponse("Stripe invoice is still being prepared", {
      status: 503,
    });
  }

  if (!order.is_demo)
    return new NextResponse("Stripe invoice unavailable", { status: 404 });

  // Historical demo orders have no Stripe payment and retain their preview PDF.
  const pdf = await generateInvoicePdf(
    order as unknown as Record<string, unknown>,
    order.order_items as unknown as Record<string, unknown>[],
  );
  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${order.order_reference}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}

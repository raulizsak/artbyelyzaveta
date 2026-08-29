import { NextResponse } from "next/server";
import { z } from "zod";
import { getAccountIdentity } from "@/lib/auth/authorization";
import type { StripeMode } from "@/lib/env";
import { ensureStripeInvoiceForOrder } from "@/lib/stripe/invoices";
import { getStripe } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAccountIdentity();
  if (user?.profile.role !== "admin" || user.aal !== "aal2")
    return NextResponse.json(
      { error: "AAL2 administrator access required" },
      { status: 403 },
    );
  const orderId = (await params).id;
  if (!z.uuid().safeParse(orderId).success)
    return NextResponse.json({ error: "Invalid order" }, { status: 400 });

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("id, payment_status, stripe_mode, is_demo")
    .eq("id", orderId)
    .maybeSingle();
  if (!order)
    return NextResponse.json({ error: "Order unavailable" }, { status: 404 });
  if (order.is_demo || order.payment_status !== "paid")
    return NextResponse.json(
      { error: "A Stripe invoice is available after a Stripe payment." },
      { status: 409 },
    );
  const mode = order.stripe_mode as StripeMode | null;
  if (mode !== "test" && mode !== "live")
    return NextResponse.json(
      { error: "The order has no Stripe payment mode." },
      { status: 409 },
    );

  try {
    const invoice = await ensureStripeInvoiceForOrder(order.id, mode);
    const sent = await getStripe(mode, false).invoices.sendInvoice(invoice.id);
    await admin
      .from("invoices")
      .update({
        sent_at: new Date().toISOString(),
        stripe_status: sent.status,
        hosted_invoice_url: sent.hosted_invoice_url ?? null,
        invoice_pdf_url: sent.invoice_pdf ?? null,
      })
      .eq("stripe_invoice_id", invoice.id);
    await admin.from("admin_audit_log").insert({
      actor_user_id: user.id,
      action: "invoice.sent_via_stripe",
      target_type: "order",
      target_id: order.id,
      safe_metadata: {
        stripe_invoice_id: invoice.id,
        stripe_mode: mode,
      },
    });
    return NextResponse.json({
      ok: true,
      mode,
      message:
        mode === "test"
          ? "Stripe test invoice prepared. Stripe does not deliver test emails."
          : "Stripe invoice sent to the customer.",
    });
  } catch {
    return NextResponse.json(
      { error: "Stripe could not send this invoice." },
      { status: 503 },
    );
  }
}

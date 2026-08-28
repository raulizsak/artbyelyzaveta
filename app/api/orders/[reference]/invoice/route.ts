import { NextResponse } from "next/server";
import { getAccountIdentity } from "@/lib/auth/authorization";
import { generateInvoicePdf } from "@/lib/invoice-pdf";
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
    .select("*, order_items(*)")
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

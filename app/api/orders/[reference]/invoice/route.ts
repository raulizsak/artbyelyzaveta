import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { NextResponse } from "next/server";
import { getAccountIdentity } from "@/lib/auth/authorization";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ reference: string }> },
) {
  const reference = (await params).reference;
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
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

  const items = order.order_items as unknown as {
    title: string;
    dimensions: string | null;
    medium: string | null;
    line_total_cents: number;
  }[];
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const charcoal = rgb(0.14, 0.15, 0.12);
  const olive = rgb(0.37, 0.4, 0.28);
  const gst = process.env.BUSINESS_GST_REGISTERED === "true";
  const money = (cents: number) =>
    new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: order.currency,
    }).format(cents / 100);
  const draw = (
    text: string,
    x: number,
    y: number,
    size = 11,
    font = regular,
    color = charcoal,
  ) => page.drawText(text, { x, y, size, font, color });
  draw("ART BY ELYZAVETA", 48, 784, 17, bold, olive);
  draw(gst ? "TAX INVOICE" : "RECEIPT / INVOICE", 410, 784, 12, bold);
  draw(process.env.BUSINESS_NAME || "Art by Elyzaveta", 48, 754, 10);
  if (process.env.BUSINESS_ABN)
    draw(`ABN ${process.env.BUSINESS_ABN}`, 48, 739, 10);
  if (process.env.BUSINESS_ADDRESS)
    draw(process.env.BUSINESS_ADDRESS.slice(0, 90), 48, 724, 10);
  draw(`Order ${order.order_reference}`, 48, 680, 16, bold);
  draw(
    `Issued ${new Intl.DateTimeFormat("en-AU", { dateStyle: "long" }).format(new Date())}`,
    48,
    658,
    10,
  );
  draw(
    `Customer: ${order.customer_first_name} ${order.customer_last_name}`,
    48,
    625,
    11,
  );
  draw(`Email: ${order.customer_email}`, 48, 607, 10);
  page.drawLine({
    start: { x: 48, y: 575 },
    end: { x: 547, y: 575 },
    thickness: 1,
    color: olive,
  });
  draw("Description", 48, 555, 10, bold);
  draw("Amount", 475, 555, 10, bold);
  let y = 525;
  for (const item of items) {
    draw(item.title.slice(0, 58), 48, y, 11, bold);
    draw(
      [item.medium, item.dimensions].filter(Boolean).join(" · ").slice(0, 75),
      48,
      y - 17,
      9,
    );
    draw(money(item.line_total_cents), 475, y, 11, bold);
    y -= 55;
  }
  page.drawLine({
    start: { x: 48, y: y + 10 },
    end: { x: 547, y: y + 10 },
    thickness: 0.7,
    color: olive,
  });
  draw("Subtotal", 385, y - 12, 10);
  draw(money(order.subtotal_cents), 475, y - 12, 10);
  draw("Shipping", 385, y - 32, 10);
  draw(money(order.shipping_cents), 475, y - 32, 10);
  if (gst) {
    draw("GST", 385, y - 52, 10);
    draw(money(order.tax_cents), 475, y - 52, 10);
  }
  draw("Total", 385, y - 78, 12, bold);
  draw(money(order.total_cents), 475, y - 78, 12, bold);
  draw(`Payment status: ${order.payment_status}`, 48, 150, 10);
  draw(
    (
      process.env.INVOICE_FOOTER || "Thank you for supporting original art."
    ).slice(0, 100),
    48,
    92,
    10,
    regular,
    olive,
  );
  const bytes = await pdf.save();
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${order.order_reference}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}

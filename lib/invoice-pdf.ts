import "server-only";

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { formatMelbourneDate } from "@/lib/date-time";
import { formatDisplayValue } from "@/lib/presentation";

type InvoiceOrder = Record<string, unknown>;
type InvoiceItem = Record<string, unknown>;

export async function generateInvoicePdf(
  order: InvoiceOrder,
  items: InvoiceItem[],
) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const charcoal = rgb(0.14, 0.15, 0.12);
  const olive = rgb(0.37, 0.4, 0.28);
  const gold = rgb(0.71, 0.6, 0.39);
  const gst = process.env.BUSINESS_GST_REGISTERED === "true";
  const money = (cents: unknown) =>
    new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: String(order.currency ?? "AUD"),
    }).format(Number(cents ?? 0) / 100);
  const draw = (
    text: string,
    x: number,
    y: number,
    size = 11,
    font = regular,
    color = charcoal,
  ) => page.drawText(text, { x, y, size, font, color });

  page.drawRectangle({
    x: 28,
    y: 28,
    width: 539,
    height: 786,
    borderColor: gold,
    borderWidth: 0.7,
  });
  draw("ART BY ELYZAVETA", 48, 784, 17, bold, olive);
  draw(gst ? "TAX INVOICE" : "RECEIPT / INVOICE", 410, 784, 12, bold);
  draw(process.env.BUSINESS_NAME || "Art by Elyzaveta", 48, 754, 10);
  if (process.env.BUSINESS_ABN)
    draw(`ABN ${process.env.BUSINESS_ABN}`, 48, 739, 10);
  if (process.env.BUSINESS_ADDRESS)
    draw(process.env.BUSINESS_ADDRESS.slice(0, 90), 48, 724, 10);
  draw(`Order ${String(order.order_reference ?? "")}`, 48, 680, 16, bold);
  draw(`Issued ${formatMelbourneDate(new Date(), "long")}`, 48, 658, 10);
  draw(
    `Customer: ${String(order.customer_first_name ?? "")} ${String(order.customer_last_name ?? "")}`,
    48,
    625,
    11,
  );
  draw(`Email: ${String(order.customer_email ?? "")}`, 48, 607, 10);
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
    draw(String(item.title ?? "Artwork").slice(0, 58), 48, y, 11, bold);
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
  let summaryY = y - 12;
  draw("Artwork subtotal", 365, summaryY, 10);
  draw(money(order.subtotal_cents), 475, summaryY, 10);
  summaryY -= 20;
  if (Number(order.discount_cents ?? 0) > 0) {
    draw("Discount", 385, summaryY, 10);
    draw(`-${money(order.discount_cents)}`, 475, summaryY, 10);
    summaryY -= 20;
  }
  draw("Shipping", 385, summaryY, 10);
  draw(money(order.shipping_cents), 475, summaryY, 10);
  summaryY -= 20;
  if (gst) {
    draw("GST", 385, summaryY, 10);
    draw(money(order.tax_cents), 475, summaryY, 10);
    summaryY -= 20;
  }
  summaryY -= 8;
  draw("Total paid", 375, summaryY, 12, bold);
  draw(money(order.amount_paid_cents ?? order.total_cents), 475, summaryY, 12, bold);
  draw(`Payment status: ${formatDisplayValue(order.payment_status)}`, 48, 150, 10);
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
  return Buffer.from(await pdf.save());
}

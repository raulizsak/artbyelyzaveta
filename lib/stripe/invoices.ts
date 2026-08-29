import "server-only";

import type Stripe from "stripe";
import type { StripeMode } from "@/lib/env";
import { formatDisplayValue } from "@/lib/presentation";
import { getStripe } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";

type OrderItem = {
  id: string;
  title: string;
  dimensions: string | null;
  medium: string | null;
  quantity: number;
  line_total_cents: number;
};

type OrderDiscount = {
  code: string;
  applied_cents: number;
};

type InvoiceOrder = {
  id: string;
  order_reference: string;
  customer_email: string;
  customer_first_name: string;
  customer_last_name: string;
  delivery_method: string;
  currency: string;
  discount_cents: number;
  shipping_cents: number;
  tax_cents: number;
  total_cents: number;
  payment_status: string;
  stripe_mode: string | null;
  stripe_customer_id: string | null;
  stripe_payment_intent_id: string | null;
  order_items: OrderItem[];
  order_discounts: OrderDiscount[];
};

const invoiceFooter = () => {
  const configured =
    process.env.INVOICE_FOOTER?.trim() ||
    "Thank you for supporting original art by an independent Melbourne artist.";
  return process.env.BUSINESS_GST_REGISTERED === "true"
    ? configured
    : `${configured} Not registered for GST.`;
};

const lineDescription = (item: OrderItem) =>
  [item.title, item.medium, item.dimensions].filter(Boolean).join(" · ");

async function getInvoiceOrder(orderId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("orders")
    .select(
      "id, order_reference, customer_email, customer_first_name, customer_last_name, delivery_method, currency, discount_cents, shipping_cents, tax_cents, total_cents, payment_status, stripe_mode, stripe_customer_id, stripe_payment_intent_id, order_items(id, title, dimensions, medium, quantity, line_total_cents), order_discounts(code, applied_cents)",
    )
    .eq("id", orderId)
    .maybeSingle();
  if (error || !data) throw new Error("Invoice order is unavailable.");
  return data as InvoiceOrder;
}

async function ensureCustomer(
  order: InvoiceOrder,
  mode: StripeMode,
  stripe: Stripe,
) {
  if (order.stripe_customer_id) return order.stripe_customer_id;
  const customer = await stripe.customers.create(
    {
      email: order.customer_email,
      name: `${order.customer_first_name} ${order.customer_last_name}`.trim(),
      metadata: { order_id: order.id, order_reference: order.order_reference },
    },
    { idempotencyKey: `invoice-customer-${mode}-${order.id}` },
  );
  const { error } = await createAdminClient()
    .from("orders")
    .update({ stripe_customer_id: customer.id })
    .eq("id", order.id)
    .is("stripe_customer_id", null);
  if (error) throw new Error("Stripe customer details could not be stored.");
  return customer.id;
}

async function saveInvoice(
  rowId: string,
  mode: StripeMode,
  invoice: Stripe.Invoice,
) {
  const { error } = await createAdminClient()
    .from("invoices")
    .update({
      invoice_reference: invoice.number || `STRIPE-${invoice.id}`,
      stripe_invoice_id: invoice.id,
      stripe_mode: mode,
      stripe_status: invoice.status,
      hosted_invoice_url: invoice.hosted_invoice_url ?? null,
      invoice_pdf_url: invoice.invoice_pdf ?? null,
      issued_at: invoice.status_transitions.finalized_at
        ? new Date(invoice.status_transitions.finalized_at * 1000).toISOString()
        : new Date().toISOString(),
    })
    .eq("id", rowId);
  if (error) throw new Error("Stripe invoice details could not be stored.");
}

export async function ensureStripeInvoiceForOrder(
  orderId: string,
  requestedMode?: StripeMode,
) {
  const admin = createAdminClient();
  const order = await getInvoiceOrder(orderId);
  if (order.payment_status !== "paid")
    throw new Error("A Stripe invoice can only be issued for a paid order.");
  const mode = requestedMode ?? (order.stripe_mode as StripeMode | null);
  if (mode !== "test" && mode !== "live")
    throw new Error("The order has no valid Stripe mode.");
  if (order.stripe_mode && order.stripe_mode !== mode)
    throw new Error("The invoice Stripe mode does not match the order.");
  if (!order.stripe_payment_intent_id)
    throw new Error("The order has no successful Stripe payment.");

  const stripe = getStripe(mode, false);
  const customerId = await ensureCustomer(order, mode, stripe);
  const { data: existing } = await admin
    .from("invoices")
    .select("id, stripe_invoice_id")
    .eq("order_id", order.id)
    .eq("version", 1)
    .maybeSingle();
  const placeholderReference = `STRIPE-PENDING-${mode}-${order.order_reference}`;
  const { data: row, error: rowError } = existing
    ? { data: existing, error: null }
    : await admin
        .from("invoices")
        .upsert(
          {
            order_id: order.id,
            version: 1,
            invoice_reference: placeholderReference,
            stripe_mode: mode,
          },
          { onConflict: "order_id,version" },
        )
        .select("id, stripe_invoice_id")
        .single();
  if (rowError || !row)
    throw new Error("Invoice record could not be reserved.");

  let invoice = row.stripe_invoice_id
    ? await stripe.invoices.retrieve(row.stripe_invoice_id)
    : await stripe.invoices.create(
        {
          auto_advance: false,
          collection_method: "send_invoice",
          currency: order.currency.toLowerCase(),
          customer: customerId,
          days_until_due: 30,
          description: `Original artwork purchase — ${order.order_reference}`,
          discounts: [],
          footer: invoiceFooter(),
          custom_fields: [
            {
              name: "ABN",
              value: process.env.BUSINESS_ABN?.trim() || "19 794 901 095",
            },
            { name: "Order", value: order.order_reference },
            {
              name: "Delivery",
              value: formatDisplayValue(order.delivery_method),
            },
          ],
          metadata: {
            order_id: order.id,
            order_reference: order.order_reference,
            stripe_mode: mode,
          },
          rendering: { pdf: { page_size: "a4" } },
        },
        { idempotencyKey: `invoice-${mode}-${order.id}` },
      );

  if (!row.stripe_invoice_id) await saveInvoice(row.id, mode, invoice);

  if (invoice.status === "draft") {
    for (const item of order.order_items) {
      await stripe.invoiceItems.create(
        {
          amount: item.line_total_cents,
          currency: order.currency.toLowerCase(),
          customer: customerId,
          invoice: invoice.id,
          description: lineDescription(item),
          discountable: false,
          metadata: { order_id: order.id, order_item_id: item.id },
        },
        { idempotencyKey: `invoice-item-${mode}-${item.id}` },
      );
    }
    if (order.discount_cents > 0) {
      const codes = order.order_discounts.map(({ code }) => code).join(" + ");
      await stripe.invoiceItems.create(
        {
          amount: -order.discount_cents,
          currency: order.currency.toLowerCase(),
          customer: customerId,
          invoice: invoice.id,
          description: `Artwork discount${codes ? ` — ${codes}` : ""}`,
          discountable: false,
          metadata: { order_id: order.id, kind: "artwork_discount" },
        },
        { idempotencyKey: `invoice-discount-${mode}-${order.id}` },
      );
    }
    if (order.shipping_cents > 0) {
      await stripe.invoiceItems.create(
        {
          amount: order.shipping_cents,
          currency: order.currency.toLowerCase(),
          customer: customerId,
          invoice: invoice.id,
          description: "Insured artwork shipping",
          discountable: false,
          metadata: { order_id: order.id, kind: "shipping" },
        },
        { idempotencyKey: `invoice-shipping-${mode}-${order.id}` },
      );
    }
    if (order.tax_cents > 0) {
      await stripe.invoiceItems.create(
        {
          amount: order.tax_cents,
          currency: order.currency.toLowerCase(),
          customer: customerId,
          invoice: invoice.id,
          description: "Tax",
          discountable: false,
          metadata: { order_id: order.id, kind: "tax" },
        },
        { idempotencyKey: `invoice-tax-${mode}-${order.id}` },
      );
    }
    invoice = await stripe.invoices.finalizeInvoice(
      invoice.id,
      { auto_advance: false },
      { idempotencyKey: `invoice-finalize-${mode}-${order.id}` },
    );
  }

  if (invoice.amount_due !== order.total_cents)
    throw new Error("Stripe invoice total does not match the order snapshot.");
  if (invoice.status === "open" && invoice.amount_remaining > 0) {
    invoice = await stripe.invoices.attachPayment(
      invoice.id,
      { payment_intent: order.stripe_payment_intent_id },
      { idempotencyKey: `invoice-payment-${mode}-${order.id}` },
    );
  }
  invoice = await stripe.invoices.retrieve(invoice.id);
  if (invoice.amount_remaining !== 0 || invoice.status !== "paid")
    throw new Error("Stripe did not mark the invoice as paid.");
  await saveInvoice(row.id, mode, invoice);
  return invoice;
}

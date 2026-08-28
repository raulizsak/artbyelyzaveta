import { describe, expect, it } from "vitest";
import { renderOrderEmail } from "../lib/email/order-template";

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project-ref.supabase.co";

const order = {
  order_reference: "ABE-2026-DEMO0001",
  customer_first_name: "Ava",
  customer_last_name: "Collector",
  customer_email: "ava@example.test",
  customer_phone: "0400000000",
  shipping_address: {
    recipient_name: "Ava Collector",
    line1: "1 Gallery Lane",
    suburb: "Melbourne",
    state: "VIC",
    postcode: "3000",
    country: "Australia",
  },
  delivery_method: "shipping",
  delivery_notes: "Handle with care",
  currency: "AUD",
  total_cents: 88000,
  payment_status: "paid",
  fulfillment_status: "unfulfilled",
  is_demo: true,
};

describe("order email templates", () => {
  it("gives a demo customer a private order link and no-charge wording", () => {
    const message = renderOrderEmail({
      template: "order_confirmation",
      order,
      items: [
        {
          title: "Cows at Dusk",
          dimensions: "120 × 80 cm",
          image_path: "paintings/cows-at-dusk/main.webp",
        },
      ],
      payload: { guest_token: "private-token" },
      siteUrl: "https://artbyelyzaveta.shop",
    });

    expect(message.subject).toContain("ABE-2026-DEMO0001");
    expect(message.text).toContain("No payment was taken");
    expect(message.text).toContain("$880.00");
    expect(message.text).toContain("order-access?token=private-token");
    expect(message.html).toContain(
      "artwork-public/paintings/cows-at-dusk/main.webp",
    );
  });

  it.each([
    ["preparing", { fulfillment_status: "preparing" }, "being prepared"],
    ["delivered", { fulfillment_status: "delivered" }, "been delivered"],
    ["delayed", { order_status: "delayed" }, "update about your artwork"],
    ["cancelled", { order_status: "cancelled" }, "been cancelled"],
  ])("renders a distinct %s lifecycle email", (_name, changes, heading) => {
    const message = renderOrderEmail({
      template: "order_update",
      order: { ...order, ...changes },
      items: [
        {
          title: "Cows at Dusk",
          dimensions: "120 × 80 cm",
          image_path: "/optimized/artwork/cows-at-dusk-card.webp",
        },
      ],
      payload: {},
      siteUrl: "https://artbyelyzaveta.shop",
    });
    expect(message.subject.toLowerCase()).toContain(heading);
    expect(message.html).toContain("Cows at Dusk");
    expect(message.html).toContain("<img");
  });

  it("renders shipment and invoice-specific actions", () => {
    const shipped = renderOrderEmail({
      template: "shipment",
      order: {
        ...order,
        fulfillment_status: "shipped",
        tracking_number: "ABEX123456789AU",
        tracking_url: "https://auspost.com.au/track/ABEX123456789AU",
      },
      items: [{ title: "Cows at Dusk", image_path: "orders/cows.webp" }],
      payload: {},
      siteUrl: "https://artbyelyzaveta.shop",
    });
    const invoice = renderOrderEmail({
      template: "invoice",
      order,
      items: [{ title: "Cows at Dusk", image_path: "orders/cows.webp" }],
      payload: {},
      siteUrl: "https://artbyelyzaveta.shop",
    });
    expect(shipped.text).toContain("Tracking number: ABEX123456789AU");
    expect(shipped.html).toContain("Track your artwork");
    expect(invoice.subject).toContain("invoice is ready");
    expect(invoice.html).toContain("View invoice");
  });

  it("includes the protected admin workflow details and escapes content", () => {
    const message = renderOrderEmail({
      template: "admin_new_order",
      order: { ...order, delivery_notes: "<script>not markup</script>" },
      items: [{ title: "Cows at Dusk", dimensions: "120 × 80 cm" }],
      payload: {},
      siteUrl: "https://artbyelyzaveta.shop",
    });

    expect(message.text).toContain("DEMO");
    expect(message.text).toContain("Ava Collector");
    expect(message.text).toContain("/admin/orders/ABE-2026-DEMO0001");
    expect(message.html).not.toContain("<script>not markup</script>");
    expect(message.html).toContain("&lt;script&gt;not markup&lt;/script&gt;");
  });
});

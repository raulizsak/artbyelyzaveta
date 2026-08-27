import { describe, expect, it } from "vitest";
import { renderOrderEmail } from "../lib/email/order-template";

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
      items: [{ title: "Cows at Dusk", dimensions: "120 × 80 cm" }],
      payload: { guest_token: "private-token" },
      siteUrl: "https://artbyelyzaveta.shop",
    });

    expect(message.subject).toContain("ABE-2026-DEMO0001");
    expect(message.text).toContain("No payment was taken");
    expect(message.text).toContain("$880.00");
    expect(message.text).toContain("order-access?token=private-token");
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

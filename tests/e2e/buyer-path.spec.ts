import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
});

test("buyer can browse, use a duplicate-safe bag and complete the payment-free demo", async ({
  page,
}) => {
  await page.goto("/shop");
  await expect(
    page.getByRole("heading", { name: "Original Paintings" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "View Cows at Dusk" }).click();
  await expect(
    page.getByRole("heading", { name: "Cows at Dusk", level: 1 }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Add original to bag" }).click();
  await expect(page.getByText("Your bag").first()).toBeVisible();
  await page.getByRole("button", { name: "Close drawer" }).click();
  await page.getByRole("button", { name: "Added to bag" }).click();
  await expect(page.getByLabel(/Open shopping bag, 1 item$/)).toBeAttached();
  await page.getByRole("button", { name: "Close drawer" }).click();

  await page.goto("/cart");
  await page.getByRole("button", { name: "Remove Cows at Dusk" }).click();
  await expect(
    page.getByRole("heading", { name: "Your bag is quiet." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Undo removal" }).click();
  await page.getByRole("link", { name: "Continue to demo checkout" }).click();
  await page.locator('[data-checkout-ready="true"]').waitFor();

  await expect(
    page.locator(
      'input[type="password"], input[autocomplete="cc-number"], input[name*="card" i]',
    ),
  ).toHaveCount(0);
  await page.getByLabel("First name").fill("Avery");
  await page.getByLabel("Last name").fill("Collector");
  await page.getByLabel("Email address").fill("avery@example.com");
  await page.getByLabel("Phone number").fill("0400 000 000");
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByLabel("Street address").fill("10 Gallery Lane");
  await page.getByLabel("Suburb / city").fill("Melbourne");
  await page.getByLabel("Postcode").fill("3000");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(
    page.getByRole("heading", { name: "No payment is collected" }),
  ).toBeVisible();
  await expect(page.locator('input[autocomplete^="cc-"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Place demo order" }).click();
  await expect(
    page.getByRole("heading", { name: "Thank you, Avery." }),
  ).toBeVisible();
  await expect(page.getByText("no payment has been taken")).toBeVisible();
});

test("room preview and lightbox are keyboard dismissible", async ({ page }) => {
  await page.goto("/shop/cows-at-dusk");
  await page.getByRole("button", { name: "Preview in a room" }).click();
  await expect(
    page.getByRole("dialog", { name: "See it in a room" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "See it in a room" }),
  ).toBeHidden();
  await page.getByRole("button", { name: "Open image full screen" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("contact and commission enquiries are validated and saved", async ({
  page,
}) => {
  await page.goto("/contact");
  await page.locator('form[data-ready="true"]').waitFor();
  await page.getByLabel("Email *").fill("avery@example.com");
  await page
    .getByLabel("Message *")
    .fill("I would like to ask about Cows at Dusk.");
  await page
    .getByLabel(/I consent to Art by Elyzaveta using these details/)
    .check();
  await page.getByLabel("Name *").fill("Avery Collector");
  await expect(page.getByLabel("Name *")).toHaveValue("Avery Collector");
  await page.getByRole("button", { name: "Send enquiry" }).click();
  await expect(
    page.getByRole("heading", { name: "Thank you for reaching out." }),
  ).toBeVisible();

  await page.goto("/commissions");
  await page.locator('form[data-ready="true"]').waitFor();
  await page.getByLabel("Email *").fill("avery@example.com");
  await page
    .getByLabel("Inspiration / story *")
    .fill("A calm coastal place remembered from childhood.");
  await page
    .getByLabel(/I consent to Art by Elyzaveta using these details/)
    .check();
  await page.getByLabel("Name *").fill("Avery Collector");
  await expect(page.getByLabel("Name *")).toHaveValue("Avery Collector");
  await page.getByRole("button", { name: "Send commission enquiry" }).click();
  await expect(
    page.getByRole("heading", { name: "Your idea is on its way." }),
  ).toBeVisible();
});

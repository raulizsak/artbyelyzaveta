import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
});

test("buyer can browse, use a duplicate-safe bag and reach safe demo checkout", async ({
  page,
}) => {
  await page.goto("/shop");
  await expect(
    page.getByRole("heading", { name: "Original Paintings" }),
  ).toBeVisible();
  await Promise.all([
    page.waitForURL("**/shop/cows-at-dusk"),
    page.getByRole("link", { name: "View Cows at Dusk" }).click(),
  ]);
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
  await page.getByRole("link", { name: /Continue to checkout/ }).click();
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
    page.getByRole("heading", { name: "No payment will be taken" }),
  ).toBeVisible();
  await expect(page.locator('input[autocomplete^="cc-"]')).toHaveCount(0);
  await expect(
    page.getByText(/Demo checkout is currently disabled/),
  ).toBeVisible();
});

test("coming-soon page signs up with duplicate-safe success copy", async ({
  page,
}) => {
  await page.route("**/api/subscribers", (route) =>
    route.fulfill({
      status: 201,
      contentType: "application/json",
      body: '{"ok":true}',
    }),
  );
  await page.goto("/");
  await expect(page.getByText("Your new art shop")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Coming soon" }),
  ).toBeVisible();
  await expect(page.locator("header")).toHaveCount(0);
  await page
    .getByLabel("Sign up to know when we go live")
    .fill("collector@example.test");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(
    page.getByText(
      "You're on the list. We'll let you know when the shop goes live.",
    ),
  ).toBeVisible();
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

test("mobile gallery survives rapid repeated thumbnail changes and navigation", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "mobile-chromium",
    "This is the dedicated mobile gallery regression.",
  );
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto("/shop/cows-at-dusk");
  const buttons = page.getByRole("button", { name: /^Show view \d+$/ });
  await expect(buttons).toHaveCount(5);
  const mainImage = page.locator(".product-gallery__main img");

  async function tapRapidly(finalIndex: number) {
    await buttons.first().evaluate((firstButton, targetIndex) => {
      const gallery = firstButton.closest(".product-gallery");
      const controls = [
        ...gallery!.querySelectorAll<HTMLButtonElement>(
          '[aria-label^="Show view"]',
        ),
      ];
      for (let index = 0; index < 20; index += 1)
        controls[index % controls.length].click();
      controls[targetIndex].click();
    }, finalIndex);
    await expect(buttons.nth(finalIndex)).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const thumbnailSource = await buttons
      .nth(finalIndex)
      .locator("img")
      .getAttribute("src");
    await expect(mainImage).toHaveAttribute(
      "src",
      thumbnailSource!.replace("-thumbnail.webp", "-main.webp"),
    );
  }

  await tapRapidly(4);
  await tapRapidly(2);
  await page.goto("/shop");
  await page.goBack();
  await expect(buttons).toHaveCount(5);
  await page.goForward();
  await expect(
    page.getByRole("heading", { name: "Original Paintings" }),
  ).toBeVisible();
  await page.goBack();
  await tapRapidly(1);
});

test("contact and commission enquiries are validated and saved", async ({
  page,
}) => {
  await page.route("**/api/enquiries/contact", (route) =>
    route.fulfill({
      status: 201,
      contentType: "application/json",
      body: '{"ok":true}',
    }),
  );
  await page.route("**/api/enquiries/commission", (route) =>
    route.fulfill({
      status: 201,
      contentType: "application/json",
      body: '{"ok":true}',
    }),
  );
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

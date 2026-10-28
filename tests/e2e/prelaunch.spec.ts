import { expect, test } from "@playwright/test";
import { POLICIES } from "../../lib/policies";

test("shop grid fits every required viewport and retains compact columns with one painting", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "Explicit viewport matrix runs once.",
  );
  test.setTimeout(90_000);
  for (const width of [320, 375, 390, 430, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/shop");
    await expect(
      page.getByRole("link", { name: "View Cows at Dusk" }),
    ).toBeVisible();
    const layout = await page
      .getByRole("main")
      .locator(".catalogue-grid")
      .evaluate((element) => {
        const image = element.querySelector(".painting-card__image")!;
        return {
          columns:
            getComputedStyle(element).gridTemplateColumns.split(" ").length,
          image: image.getBoundingClientRect().toJSON(),
          overflow: document.documentElement.scrollWidth - innerWidth,
        };
      });
    expect(layout.columns).toBe(
      width >= 1440 ? 4 : width >= 1024 ? 3 : width >= 390 ? 2 : 1,
    );
    expect(layout.overflow).toBe(0);
    expect(layout.image.height).toBeLessThanOrEqual(340);
    if (width >= 1024) expect(layout.image.width).toBeLessThan(450);
    if (width === 1440) expect(layout.image.bottom).toBeLessThan(900);
    await page.screenshot({
      path: testInfo.outputPath(`shop-${width}.png`),
      fullPage: true,
    });
  }
});

test("orientation, availability, search, clear and browser history work together", async ({
  page,
}, testInfo) => {
  await page.goto("/shop");
  const mobile = testInfo.project.name === "mobile-chromium";
  if (mobile)
    await page.getByRole("button", { name: "Filters", exact: true }).click();
  const scope = mobile
    ? page.getByRole("dialog")
    : page.locator(".desktop-filters");
  await scope.getByLabel("Orientation").selectOption("portrait");
  await expect(page).toHaveURL(/orientation=portrait/);
  if (mobile)
    await page
      .getByRole("button", { name: "Show 0 works", exact: true })
      .click();
  await expect(
    page.getByRole("heading", { name: "No works found" }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole("link", { name: "View Cows at Dusk" }),
  ).toBeVisible();
  await page
    .getByRole("searchbox", { name: "Search artworks", exact: true })
    .fill("zzzz-no-match");
  await expect(
    page.getByRole("searchbox", { name: "Search artworks", exact: true }),
  ).toHaveValue("zzzz-no-match");
  if (mobile)
    await page
      .getByRole("button", { name: "Search collection", exact: true })
      .click();
  else await page.getByLabel("Search artworks", { exact: true }).press("Enter");
  await expect(page).toHaveURL(/q=zzzz-no-match/);
  await expect(
    page.getByRole("heading", { name: "No works found" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("link", { name: "View Cows at Dusk" }),
  ).toBeVisible();
  await expect(page.getByLabel("Search artworks", { exact: true })).toHaveValue(
    "",
  );
  await page.goto(
    "/shop?orientation=landscape&availability=available&sort=price-desc&q=cows",
  );
  await expect(
    page.getByRole("link", { name: "View Cows at Dusk" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "View Cows at Dusk" }).click();
  await expect(page).toHaveURL(/\/shop\/cows-at-dusk$/);
  await expect(
    page.getByRole("heading", { name: "Cows at Dusk", level: 1 }),
  ).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/orientation=landscape/);
  await expect(page.getByLabel("Search artworks", { exact: true })).toHaveValue(
    "cows",
  );
});

test("public routes render and private routes deny anonymous access", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "Route inventory runs once.",
  );
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const route of [
    "/",
    "/home",
    "/shop",
    "/shop/cows-at-dusk",
    "/about",
    "/commissions",
    "/contact",
    "/cart",
    "/checkout",
    "/order-access",
    "/order-confirmation",
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
    "/preview",
    ...POLICIES.map((policy) => `/policies/${policy.slug}`),
  ]) {
    const response = await page.goto(route);
    expect(response?.status(), route).toBeLessThan(400);
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.locator("h1").first()).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      ),
      route,
    ).toBe(0);
  }
  for (const route of [
    "/account",
    "/account/addresses",
    "/account/profile",
    "/account/security",
    "/account/payment-methods",
    "/account/returns",
    "/account/orders",
    "/account/orders/ABE-2026-A1B2C3D4E5",
    "/admin",
    "/admin/paintings",
    "/admin/paintings/new",
    "/admin/paintings/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    "/admin/orders",
    "/admin/orders/ABE-2026-A1B2C3D4E5",
    "/admin/discounts",
    "/admin/discounts/new",
    "/admin/discounts/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    "/admin/returns",
    "/admin/subscribers",
  ]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/login\?next=/);
  }
  expect(errors).toEqual([]);
});

test("failed image and form network requests show recoverable errors", async ({
  page,
}) => {
  await page.route("**/*-card.webp", (route) => route.abort());
  await page.route("**/*-thumbnail.webp", (route) => route.abort());
  await page.goto("/shop");
  await expect(
    page.getByText("Photograph unavailable. Open artwork for details."),
  ).toBeVisible();
  await page.route("**/api/subscribers", (route) => route.abort());
  await page.goto("/");
  await page
    .getByLabel("Sign up to know when we go live")
    .fill("qa@example.test");
  await page.getByRole("button", { name: "Sign up", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Sign up", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByText("We couldn't add you just now. Please try again shortly."),
  ).toBeVisible();
});

import { expect, test } from "@playwright/test";

const viewports = [
  { width: 1920, height: 1080 },
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
  { width: 1280, height: 800 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 430, height: 932 },
  { width: 393, height: 852 },
  { width: 390, height: 844 },
  { width: 375, height: 812 },
  { width: 360, height: 800 },
  { width: 320, height: 568 },
];
const headingViewports = viewports.filter(({ width }) =>
  [1440, 1280, 1024, 768, 430, 390, 375].includes(width),
);

test("shared hero scale is responsive across the required viewport matrix", async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "The explicit viewport matrix only needs one browser project.",
  );

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.locator(".hero__lede:visible").first().waitFor();
    await page.waitForFunction(() =>
      [...document.querySelectorAll(".hero__lede")].some(
        (element) => element.getBoundingClientRect().height > 0,
      ),
    );

    const layout = await page.evaluate(() => {
      const visibleRect = (selector: string) =>
        [...document.querySelectorAll(selector)]
          .map((element) => element.getBoundingClientRect())
          .find((rect) => rect.width > 0 && rect.height > 0);
      const h1 = visibleRect(".hero h1");
      const supporting = visibleRect(".hero__lede");
      const hero = visibleRect(".hero");
      const visibleHeading = [...document.querySelectorAll(".hero h1")].find(
        (element) => element.getBoundingClientRect().height > 0,
      )!;
      const buttons = [...document.querySelectorAll(".hero .button-row a")]
        .map((button) => button.getBoundingClientRect())
        .filter((rect) => rect.width > 0 && rect.height > 0);
      return {
        overflow:
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
        fontSize: Number.parseFloat(getComputedStyle(visibleHeading).fontSize),
        h1Bottom: h1?.bottom ?? 0,
        supportingTop: supporting?.top ?? 0,
        heroBottom: hero?.bottom ?? 0,
        buttonTops: buttons.map((button) => button.top),
      };
    });

    expect(layout.overflow, `${viewport.width}px horizontal overflow`).toBe(0);
    expect(
      layout.h1Bottom,
      `${viewport.width}px heading/supporting overlap`,
    ).toBeLessThan(layout.supportingTop);
    expect(layout.fontSize).toBeGreaterThanOrEqual(40);
    expect(layout.fontSize).toBeLessThanOrEqual(64);

    if (viewport.width >= 1024) {
      expect(
        layout.heroBottom,
        `${viewport.width}×${viewport.height} desktop hero below fold`,
      ).toBeLessThanOrEqual(viewport.height + 2);
    }
    if (viewport.width >= 360) {
      expect(
        Math.abs(layout.buttonTops[0] - layout.buttonTops[1]),
        `${viewport.width}px hero buttons stacked`,
      ).toBeLessThan(2);
    }
  }

  for (const viewport of headingViewports) {
    await page.setViewportSize(viewport);
    await page.goto("/about", { waitUntil: "domcontentloaded" });
    await page.locator(".about-hero h1:visible").first().waitFor();
    const layout = await page.evaluate(() => {
      const visible = (selector: string) =>
        [...document.querySelectorAll(selector)].find(
          (element) => element.getBoundingClientRect().height > 0,
        )!;
      const heading = visible(".about-hero h1");
      return {
        overflow:
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
        fontSize: Number.parseFloat(getComputedStyle(heading).fontSize),
        headingBottom: heading.getBoundingClientRect().bottom,
        copyTop: visible(
          ".about-hero > div:first-child > p:last-child",
        ).getBoundingClientRect().top,
      };
    });
    expect(layout.overflow, `${viewport.width}px About overflow`).toBe(0);
    expect(layout.headingBottom).toBeLessThan(layout.copyTop);
    expect(layout.fontSize).toBeGreaterThanOrEqual(38);
    expect(layout.fontSize).toBeLessThanOrEqual(56);
  }
});

test("logo paints on page load, replays on desktop hover and respects reduced motion", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "Desktop hover behavior only applies to a fine pointer.",
  );
  await page.goto("/");
  const logo = page.locator("header .brand-logo:visible").first();
  await expect(logo).toHaveClass(/brand-logo--animate/);
  await expect
    .poll(async () => (await logo.getAttribute("class")) ?? "", {
      timeout: 2_500,
    })
    .not.toContain("brand-logo--animate");

  await logo.hover();
  await expect(logo).toHaveClass(/brand-logo--animate/);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/about");
  const reducedStroke = page
    .locator("header .brand-logo:visible .brand-logo__stroke")
    .first();
  const reducedDurationMs = await reducedStroke.evaluate((element) => {
    const value = getComputedStyle(element).animationDuration;
    const duration = Number.parseFloat(value);
    return value.endsWith("ms") ? duration : duration * 1000;
  });
  expect(reducedDurationMs).toBeLessThanOrEqual(0.02);
  await expect(reducedStroke).toHaveCSS("stroke-dashoffset", "0px");
});

test("contact validation identifies, focuses and recovers each required field", async ({
  page,
}) => {
  await page.route("**/api/enquiries/contact", (route) =>
    route.fulfill({
      status: 201,
      contentType: "application/json",
      body: '{"ok":true}',
    }),
  );
  await page.goto("/contact");
  await page.locator('form[data-ready="true"]').waitFor();
  await page.getByRole("button", { name: "Send enquiry" }).click();

  await expect(page.getByText("Please enter your full name.")).toBeVisible();
  await expect(
    page.getByText("Please enter a valid email address."),
  ).toBeVisible();
  await expect(page.getByText("Please enter your message.")).toBeVisible();
  await expect(
    page.getByText(
      "Please confirm that we can use these details to respond to your enquiry.",
    ),
  ).toBeVisible();
  await expect(page.getByLabel("Name *")).toBeFocused();
  await expect(page.getByLabel("Name *")).toHaveAttribute(
    "aria-invalid",
    "true",
  );

  await page.getByLabel("Name *").fill("Avery Collector");
  await expect(page.getByText("Please enter your full name.")).toHaveCount(0);
  await page.getByLabel("Email *").fill("not-an-email");
  await expect(
    page.getByText("Please enter a valid email address."),
  ).toBeVisible();
  await page.getByLabel("Email *").fill("avery@example.com");
  await page.getByLabel("Message *").fill("A question about delivery.");
  await page
    .getByLabel(/I consent to Art by Elyzaveta using these details/)
    .check();
  await page.getByRole("button", { name: "Send enquiry" }).click();
  await expect(
    page.getByRole("heading", { name: "Thank you for reaching out." }),
  ).toBeVisible();
});

test("commission validation and image upload recover through a successful submission", async ({
  page,
}) => {
  await page.goto("/commissions");
  await page.locator('form[data-ready="true"]').waitFor();
  const uploadAlignment = await page.evaluate(() => {
    const timing = document
      .querySelector("#commission-timing")!
      .getBoundingClientRect();
    const upload = document
      .querySelector(".upload-dropzone")!
      .getBoundingClientRect();
    return {
      viewportWidth: window.innerWidth,
      timingTop: timing.top,
      timingHeight: timing.height,
      uploadTop: upload.top,
      uploadHeight: upload.height,
    };
  });
  if (uploadAlignment.viewportWidth > 650)
    expect(uploadAlignment.uploadTop).toBeCloseTo(uploadAlignment.timingTop, 1);
  expect(uploadAlignment.uploadHeight).toBeCloseTo(
    uploadAlignment.timingHeight,
    1,
  );
  await page.getByRole("button", { name: "Send commission enquiry" }).click();

  await expect(page.getByText("Please enter your full name.")).toBeVisible();
  await expect(
    page.getByText("Please enter a valid email address."),
  ).toBeVisible();
  await expect(
    page.getByText("Please tell Lisa a little about your idea."),
  ).toBeVisible();
  await expect(page.getByLabel("Name *")).toBeFocused();

  const fileInput = page.getByLabel("Choose up to 3 inspiration images");
  await fileInput.setInputFiles({
    name: "reference.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("not an image"),
  });
  await expect(
    page.getByText("Please upload a JPG, PNG or WEBP image."),
  ).toBeVisible();

  await fileInput.setInputFiles({
    name: "too-large.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.alloc(8 * 1024 * 1024 + 1),
  });
  await expect(
    page.getByText(
      "This image is larger than 8 MB. Please choose a smaller file.",
    ),
  ).toBeVisible();

  await page.getByLabel("Name *").fill("Avery Collector");
  await page.getByLabel("Email *").fill("avery@example.com");
  await page
    .getByLabel("Inspiration / story *")
    .fill("A quiet remembered landscape at the end of the day.");
  await page
    .getByLabel(/I consent to Art by Elyzaveta using these details/)
    .check();
  await page.route("**/api/enquiries/commission", (route) =>
    route.fulfill({
      status: 201,
      contentType: "application/json",
      body: '{"ok":true}',
    }),
  );
  await page.getByRole("button", { name: "Send commission enquiry" }).click();
  await expect(
    page.getByRole("heading", { name: "Your idea is on its way." }),
  ).toBeVisible();
});

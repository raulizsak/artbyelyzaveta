import { expect, test, type BrowserContext } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { createHmac, randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { localSupabaseConfig } from "../../scripts/local-supabase.cjs";

const config = localSupabaseConfig();
const admin = createClient(config.API_URL, config.SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const users: string[] = [];
const paintings: string[] = [];
const discounts: string[] = [];
const orders: string[] = [];
const events: string[] = [];

function totp(secret: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bits = [...secret.replace(/=+$/, "").toUpperCase()]
    .map((letter) => alphabet.indexOf(letter).toString(2).padStart(5, "0"))
    .join("");
  const key = Buffer.from(
    bits.match(/.{8}/g)!.map((byte) => parseInt(byte, 2)),
  );
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const digest = createHmac("sha1", key).update(counter).digest();
  return String(
    (digest.readUInt32BE(digest[19] & 15) & 0x7fffffff) % 1_000_000,
  ).padStart(6, "0");
}

async function identity(
  context: BrowserContext,
  role: "admin" | "customer",
  aal2: boolean,
) {
  const email = `local-qa-${randomUUID()}@example.test`;
  const password = `LocalQa-${randomUUID()}`;
  const result = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  expect(result.error).toBeNull();
  const id = result.data.user!.id;
  users.push(id);
  expect(
    (await admin.from("profiles").update({ role }).eq("id", id)).error,
  ).toBeNull();
  let jar: { name: string; value: string }[] = [];
  const client = createServerClient(config.API_URL, config.ANON_KEY, {
    cookies: {
      getAll: () => jar,
      setAll: (values) => {
        for (const value of values) {
          jar = jar.filter((item) => item.name !== value.name);
          jar.push({ name: value.name, value: value.value });
        }
      },
    },
  });
  expect(
    (await client.auth.signInWithPassword({ email, password })).error,
  ).toBeNull();
  if (aal2) {
    const factor = await client.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Local isolated QA",
    });
    expect(factor.error).toBeNull();
    if (!factor.data || factor.data.type !== "totp")
      throw new Error("Local TOTP enrollment failed");
    expect(
      (
        await client.auth.mfa.challengeAndVerify({
          factorId: factor.data.id,
          code: totp(factor.data.totp.secret),
        })
      ).error,
    ).toBeNull();
  }
  await context.addCookies(
    jar
      .filter((cookie) => cookie.value)
      .map((cookie) => ({
        ...cookie,
        domain: "127.0.0.1",
        path: "/",
        sameSite: "Lax" as const,
      })),
  );
  return client;
}

test.afterEach(async () => {
  for (const id of orders.splice(0)) {
    await admin.from("order_items").delete().eq("order_id", id);
    await admin.from("orders").delete().eq("id", id);
  }
  for (const id of events.splice(0))
    await admin.from("stripe_events").delete().eq("stripe_event_id", id);
  for (const id of discounts.splice(0))
    await admin.from("discounts").delete().eq("id", id);
  for (const id of paintings.splice(0)) {
    // IDs below were returned by this test's local painting-create response.
    for (const bucket of ["artwork-public", "artwork-originals"]) {
      const { data: groups } = await admin.storage.from(bucket).list(id);
      const paths: string[] = [];
      for (const group of groups ?? []) {
        if (!/^[a-f0-9-]{36}$/.test(group.name)) continue;
        const { data: files } = await admin.storage
          .from(bucket)
          .list(`${id}/${group.name}`);
        for (const file of files ?? [])
          if (
            /^(original\.(jpg|png|webp)|(thumbnail|card|main|large)\.webp)$/.test(
              file.name,
            )
          )
            paths.push(`${id}/${group.name}/${file.name}`);
      }
      if (paths.length) await admin.storage.from(bucket).remove(paths);
    }
    await admin.from("paintings").delete().eq("id", id);
  }
  for (const id of users.splice(0)) await admin.auth.admin.deleteUser(id);
});

test("real local admin creates, uploads, reorders, publishes, edits and archives artwork", async ({
  page,
  context,
}, testInfo) => {
  await identity(context, "admin", true);
  await page.goto("/admin/paintings/new");
  await expect(
    page.getByRole("heading", { name: "Add a painting" }),
  ).toBeVisible();
  const title = `Local QA ${randomUUID().slice(0, 8)}`;
  const discountCode = `QA${randomUUID().slice(0, 8).toUpperCase()}`;
  const discount = await admin
    .from("discounts")
    .insert({
      code: discountCode,
      discount_type: "fixed_amount",
      amount_off_cents: 10000,
      starts_at: new Date(Date.now() - 60000).toISOString(),
    })
    .select("id")
    .single();
  expect(discount.error).toBeNull();
  discounts.push(discount.data!.id);
  const slug = title.toLowerCase().replaceAll(" ", "-");
  await page.getByLabel("Painting title", { exact: true }).fill(title);
  await page.getByLabel("Price (AUD)", { exact: true }).fill("850.25");
  await page.getByLabel("Shipping cost (AUD)", { exact: true }).fill("25.50");
  await page.getByLabel("Width", { exact: true }).fill("60");
  await page.getByLabel("Height", { exact: true }).fill("80");
  await expect(
    page.getByLabel("Artwork orientation", { exact: true }),
  ).toHaveValue("portrait");
  await page
    .getByLabel("Short description", { exact: true })
    .fill("Isolated local QA only. Never published to the live store.");
  await page.getByLabel("Status", { exact: true }).selectOption("available");
  await page
    .locator('input[type="file"]')
    .setInputFiles([
      resolve("public/optimized/artwork/cows-at-dusk-gallery-wall-main.webp"),
      resolve("public/optimized/artwork/cows-at-dusk-warm-room-main.webp"),
    ]);
  await page
    .getByRole("button", { name: "Move image earlier", exact: true })
    .nth(1)
    .click();
  const created = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/admin/paintings") &&
      response.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Save painting", exact: true })
    .first()
    .click();
  const response = await created;
  expect(response.status()).toBe(201);
  const id = (await response.json()).id as string;
  paintings.push(id);
  await expect(page).toHaveURL(new RegExp(`/admin/paintings/${id}$`), {
    timeout: 30_000,
  });
  await expect(
    page.getByRole("button", { name: "Save painting", exact: true }).first(),
  ).toBeEnabled();
  const saved = await admin.from("paintings").select("*").eq("id", id).single();
  expect(saved.data).toMatchObject({
    status: "available",
    price_cents: 85025,
    shipping_cents: 2550,
    width_cm: 60,
    height_cm: 80,
    orientation: "portrait",
    slug,
  });
  const { data: media } = await admin
    .from("painting_media")
    .select("*")
    .eq("painting_id", id);
  expect(media).toHaveLength(10);
  expect(
    media!
      .filter((item) => item.variant === "main")
      .map((item) => item.position)
      .sort(),
  ).toEqual([0, 1]);
  const publicImage = media!.find((item) => item.variant === "main")!;
  expect(
    (
      await page.request.get(
        `${config.API_URL}/storage/v1/object/public/artwork-public/${publicImage.storage_path}`,
      )
    ).status(),
  ).toBe(200);
  await page.goto(`/shop?orientation=portrait&q=${encodeURIComponent(title)}`);
  await expect(page.getByRole("link", { name: `View ${title}` })).toBeVisible();
  await page.getByRole("link", { name: `View ${title}` }).click();
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /^Show view/ })).toHaveCount(2);
  await page
    .getByRole("button", { name: "Add original to bag", exact: true })
    .click();
  await page.getByRole("button", { name: "Close drawer", exact: true }).click();
  await page.goto("/checkout");
  await page.getByLabel("First name", { exact: true }).fill("Local");
  await page.getByLabel("Last name", { exact: true }).fill("QA");
  await page
    .getByLabel("Email address", { exact: true })
    .fill("collection-qa@example.test");
  await page.getByLabel("Phone number", { exact: true }).fill("0400000000");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel(/Personal collection/).check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Review and payment", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(".checkout-totals").getByText("$0.00", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Discount code", { exact: true }).fill(discountCode);
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page.locator(".checkout-summary__total")).toContainText(
    "$750.25",
  );
  await page.getByLabel("Discount code", { exact: true }).fill("INVALIDCODE");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page.getByText("This discount code isn't valid.")).toBeVisible();
  await page
    .locator(".review-grid")
    .getByRole("button", { name: "Edit", exact: true })
    .nth(1)
    .click();
  await page.getByLabel(/Shipping/).check();
  await page
    .getByLabel("Street address", { exact: true })
    .fill("1 Local Test Street");
  await page.getByLabel("Suburb / city", { exact: true }).fill("Melbourne");
  await page.getByLabel("Postcode", { exact: true }).fill("3000");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.locator(".checkout-summary__total")).toContainText(
    "$775.75",
  );
  await expect(page.locator(".checkout-totals")).toContainText("$25.50");
  expect(
    (await page.request.post("/api/checkout/session", { data: {} })).status(),
  ).toBe(503);
  await page.goto(`/admin/paintings/${id}`);
  await page
    .getByLabel("Painting title", { exact: true })
    .fill(`${title} Edited`);
  await page.getByLabel("Price (AUD)", { exact: true }).fill("900.50");
  await page
    .locator('input[type="file"]')
    .setInputFiles(
      resolve("public/optimized/artwork/cows-at-dusk-modern-room-main.webp"),
    );
  await page
    .getByRole("button", { name: "Move image earlier", exact: true })
    .nth(2)
    .click();
  await page
    .getByRole("button", { name: "Move image earlier", exact: true })
    .nth(1)
    .click();
  await page
    .getByRole("button", { name: "Remove image", exact: true })
    .nth(2)
    .click();
  await page
    .getByRole("button", { name: "Save painting", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "Save painting", exact: true }).first(),
  ).toBeEnabled({ timeout: 30_000 });
  await expect(
    page.locator(".painting-editor__form > .form-error"),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Painting title", exact: true }),
  ).toHaveValue(`${title} Edited`);
  await expect(page.locator(".painting-media-item")).toHaveCount(2);
  expect(
    (
      await admin
        .from("paintings")
        .select("slug,price_cents")
        .eq("id", id)
        .single()
    ).data,
  ).toMatchObject({ slug, price_cents: 90050 });
  await page.screenshot({
    path: testInfo.outputPath("admin-edited.png"),
    fullPage: true,
  });
  await page.getByLabel("Status", { exact: true }).selectOption("archived");
  await page
    .getByRole("button", { name: "Save painting", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "Save painting", exact: true }).first(),
  ).toBeEnabled();
  await expect(
    page.locator(".painting-editor__form > .form-error"),
  ).toHaveCount(0);
  await page.goto(`/shop?q=${encodeURIComponent(title)}`);
  await expect(
    page.getByRole("heading", { name: "No works found" }),
  ).toBeVisible();
  for (const route of [
    "/admin",
    "/admin/paintings",
    "/admin/orders",
    "/admin/orders/ABE-2026-A1B2C3D4E5",
    "/admin/discounts",
    "/admin/discounts/new",
    "/admin/returns",
    "/admin/subscribers",
    "/account",
    "/account/addresses",
    "/account/profile",
    "/account/security",
    "/account/payment-methods",
    "/account/returns",
    "/account/orders",
  ]) {
    await page.goto(route);
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(
      page.getByText("This page could not be shown.", { exact: true }),
    ).toHaveCount(0);
  }
  expect((await page.request.get("/api/health")).status()).toBe(200);
});

test("separate concurrent database transactions permit exactly one buyer", async () => {
  const id = randomUUID();
  paintings.push(id);
  expect(
    (
      await admin.from("paintings").insert({
        id,
        slug: `local-qa-${id}`,
        title: "Isolated concurrency fixture",
        price_cents: 50000,
        shipping_cents: 2500,
        currency: "AUD",
        status: "available",
        published_at: new Date().toISOString(),
      })
    ).error,
  ).toBeNull();
  const attempts = await Promise.all(
    [0, 1].map((buyer) =>
      admin.rpc("create_commerce_checkout", {
        p_painting_ids: [id],
        p_customer_user_id: null,
        p_customer_email: `concurrency-${buyer}@example.test`,
        p_customer_first_name: "Local",
        p_customer_last_name: "QA",
        p_customer_phone: null,
        p_shipping_address: {},
        p_delivery_method: "collection",
        p_delivery_notes: null,
        p_discount_codes: [],
        p_reservation_minutes: 30,
      }),
    ),
  );
  expect(attempts.filter((result) => result.error === null)).toHaveLength(1);
  expect(attempts.filter((result) => result.error !== null)).toHaveLength(1);
  const winner = attempts.find((result) => result.error === null)!.data[0];
  orders.push(winner.order_id);
  expect(winner.shipping_cents).toBe(0);
  const event = `evt_local_qa_${randomUUID()}`;
  events.push(event);
  const payment = await admin.rpc("process_commerce_stripe_event", {
    p_event_id: event,
    p_event_type: "checkout.session.completed",
    p_mode: "test",
    p_data: {
      order_id: winner.order_id,
      payment_status: "paid",
      amount_total: 50000,
      amount_shipping: 0,
      amount_discount: 0,
      currency: "aud",
    },
  });
  expect(payment.error).toBeNull();
  expect(payment.data.status).toBe("processed");
  expect(
    (await admin.from("paintings").select("status").eq("id", id).single()).data!
      .status,
  ).toBe("sold");
  expect(
    (
      await admin
        .from("email_outbox")
        .select("id", { count: "exact" })
        .eq("order_id", winner.order_id)
    ).count,
  ).toBe(2);
});

test("anonymous visitors, customers and AAL1 admins cannot use protected actions", async ({
  page,
  context,
}) => {
  expect(
    (await page.request.post("/api/admin/paintings", { data: {} })).status(),
  ).toBe(403);
  expect(
    (
      await page.request.get("/api/orders/ABE-2026-A1B2C3D4E5/invoice")
    ).status(),
  ).toBe(404);
  await identity(context, "customer", false);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/account$/);
  expect(
    (await page.request.post("/api/admin/paintings", { data: {} })).status(),
  ).toBe(403);
  await context.clearCookies();
  await identity(context, "admin", false);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/account\/security/);
  expect(
    (await page.request.post("/api/admin/paintings", { data: {} })).status(),
  ).toBe(403);
});

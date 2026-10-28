// Explicit provider QA only: isolated rows, journalled IDs, test-only Stripe.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import Stripe from "stripe";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";
const root = "test-results/private-readiness/";
const env = Object.fromEntries(
  JSON.parse(await readFile(root + "render-env.json", "utf8")).map((x) => [
    x.key,
    x.value,
  ]),
);
assert.equal(
  new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname,
  "fhxgcvdwvagqnxgydyca.supabase.co",
);
assert.ok(env.STRIPE_TEST_SECRET_KEY.startsWith("sk_test_"));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});
const stripe = new Stripe(env.STRIPE_TEST_SECRET_KEY);
assert.equal((await stripe.accounts.retrieve()).id, "acct_1U8UtpJ7PpvmgXCg");
let journal;
try {
  journal = JSON.parse(await readFile(root + "fixture-journal.json", "utf8"));
} catch (e) {
  if (e.code !== "ENOENT") throw e;
  journal = {
    project: "fhxgcvdwvagqnxgydyca",
    runId: randomUUID(),
    paintings: [
      "shipping",
      "collection",
      "decline",
      "concurrent",
      "review-shipping",
      "review-collection",
    ].map((kind) => ({ id: randomUUID(), kind })),
    createdAt: new Date().toISOString(),
  };
  await writeFile(
    root + "fixture-journal.json",
    JSON.stringify(journal, null, 2),
  );
}
assert.equal(journal.project, "fhxgcvdwvagqnxgydyca");
for (const fixture of journal.paintings) {
  const painting = {
    id: fixture.id,
    slug: "private-review-" + fixture.kind + "-" + journal.runId.slice(0, 8),
    title: "Private review — " + fixture.kind.replaceAll("-", " "),
    description:
      "Isolated pre-launch Stripe test artwork. This record is not an artwork offered for sale.",
    story:
      "Provider verification record; no genuine financial transaction or fulfilment.",
    price_cents: 12000,
    shipping_cents: 1500,
    currency: "AUD",
    width_cm: 30,
    height_cm: 40,
    depth_cm: 2,
    medium: "Oil",
    surface: "Canvas",
    category: "Pre-launch verification",
    orientation: "portrait",
    status: "available",
    published_at: new Date().toISOString(),
    year: 2026,
  };
  const found = await sb
    .from("paintings")
    .select("id,slug")
    .eq("id", fixture.id)
    .maybeSingle();
  if (found.error) throw Error("Fixture inspection failed");
  if (found.data) assert.equal(found.data.slug, painting.slug);
  else {
    const r = await sb.from("paintings").insert(painting);
    if (r.error)
      throw Error("Isolated artwork insert failed: " + r.error.message);
  }
  let product = fixture.productId
    ? await stripe.products.retrieve(fixture.productId)
    : await stripe.products.create(
        {
          name: painting.title,
          description: painting.description,
          metadata: { painting_id: fixture.id, prelaunch_run: journal.runId },
        },
        { idempotencyKey: "readiness-product-" + fixture.id },
      );
  fixture.productId = product.id;
  const price = fixture.priceId
    ? await stripe.prices.retrieve(fixture.priceId)
    : await stripe.prices.create(
        {
          product: product.id,
          currency: "aud",
          unit_amount: 12000,
          metadata: { painting_id: fixture.id, prelaunch_run: journal.runId },
        },
        { idempotencyKey: "readiness-price-" + fixture.id },
      );
  fixture.priceId = price.id;
  await writeFile(
    root + "fixture-journal.json",
    JSON.stringify(journal, null, 2),
  );
  const catalog = await sb
    .from("painting_stripe_catalog")
    .upsert(
      {
        painting_id: fixture.id,
        mode: "test",
        stripe_product_id: product.id,
        stripe_price_id: price.id,
        synced_price_cents: 12000,
        synced_currency: "AUD",
        sync_status: "synced",
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: "painting_id,mode" },
    );
  if (catalog.error) throw Error("Isolated catalog insert failed");
}
const image = await readFile("public/brand-stripe-icon.png");
const metadata = await sharp(image).metadata();
for (const fixture of journal.paintings) {
  for (const variant of ["main", "card", "thumbnail"]) {
    const path = fixture.id + "/private-review/" + variant + ".png";
    const upload = await sb.storage
      .from("artwork-public")
      .upload(path, image, { contentType: "image/png", upsert: true });
    if (upload.error) throw Error("Isolated image upload failed");
    const media = await sb
      .from("painting_media")
      .upsert(
        {
          painting_id: fixture.id,
          kind: "artwork",
          storage_path: path,
          variant,
          width: metadata.width,
          height: metadata.height,
          bytes: image.length,
          mime_type: "image/png",
          alt_text: "Isolated private review artwork",
          position: 0,
        },
        { onConflict: "storage_path" },
      );
    if (media.error) throw Error("Isolated image metadata failed");
  }
}
journal.discountId ??= randomUUID();
journal.discountCode ??= "REVIEW10_" + journal.runId.slice(0, 8).toUpperCase();
await writeFile(
  root + "fixture-journal.json",
  JSON.stringify(journal, null, 2),
);
const discount = await sb
  .from("discounts")
  .upsert(
    {
      id: journal.discountId,
      code: journal.discountCode,
      discount_type: "percentage",
      percent_off: 10,
      applies_to: "specific",
      active: true,
    },
    { onConflict: "id" },
  );
if (discount.error) throw Error("Isolated discount insert failed");
const scope = await sb.from("discount_products").upsert(
  journal.paintings.map((f) => ({
    discount_id: journal.discountId,
    painting_id: f.id,
  })),
  { onConflict: "discount_id,painting_id" },
);
if (scope.error) throw Error("Isolated discount scope failed");
console.log(
  JSON.stringify({
    project: journal.project,
    isolatedArtworks: journal.paintings.length,
    stripeMode: "test",
    realArtworkChanges: 0,
    imagesUploaded: journal.paintings.length * 3,
    discountCode: journal.discountCode,
  }),
);

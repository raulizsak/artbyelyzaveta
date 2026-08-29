import "server-only";

import { createHash } from "node:crypto";
import type Stripe from "stripe";
import { getStripeSecretKey, type StripeMode } from "@/lib/env";
import { publicArtworkUrl } from "@/lib/media-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/server";

export type CatalogSyncResult = {
  mode: StripeMode;
  status: "synced" | "inactive" | "error";
  error?: string;
};

const modes: StripeMode[] = ["test", "live"];

const fingerprint = (value: unknown) =>
  createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex")
    .slice(0, 16);

async function findProduct(
  stripe: Stripe,
  paintingId: string,
): Promise<Stripe.Product | null> {
  for await (const product of stripe.products.list({ limit: 100 })) {
    if (product.metadata.painting_id === paintingId) return product;
  }
  return null;
}

export async function syncPaintingCatalog(
  paintingId: string,
): Promise<CatalogSyncResult[]> {
  const admin = createAdminClient();
  const [{ data: painting, error }, { data: existingRows }] = await Promise.all([
    admin
      .from("paintings")
      .select(
        "id, slug, title, description, price_cents, currency, status, published_at, painting_media(storage_path, kind, variant, position)",
      )
      .eq("id", paintingId)
      .single(),
    admin
      .from("painting_stripe_catalog")
      .select("*")
      .eq("painting_id", paintingId),
  ]);
  if (error || !painting) throw new Error("Painting is unavailable for sync.");

  const media = [...(painting.painting_media ?? [])].sort(
    (a, b) => a.position - b.position,
  );
  const imagePath =
    media.find((entry) => entry.kind === "artwork" && entry.variant === "large")
      ?.storage_path ??
    media.find((entry) => entry.kind === "artwork" && entry.variant === "main")
      ?.storage_path;
  const imageUrl = imagePath
    ? publicArtworkUrl(imagePath, process.env.SITE_URL)
    : "";
  const shouldBeActive =
    painting.published_at !== null && painting.status === "available";

  return Promise.all(
    modes.map(async (mode): Promise<CatalogSyncResult> => {
      const current = existingRows?.find((row) => row.mode === mode);
      if (!getStripeSecretKey(mode)) {
        await admin.from("painting_stripe_catalog").upsert(
          {
            painting_id: paintingId,
            mode,
            stripe_product_id: current?.stripe_product_id ?? null,
            stripe_price_id: current?.stripe_price_id ?? null,
            synced_price_cents: current?.synced_price_cents ?? null,
            synced_currency: current?.synced_currency ?? null,
            sync_status: "error",
            sync_error: `Stripe ${mode} credentials are not configured.`,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "painting_id,mode" },
        );
        return {
          mode,
          status: "error",
          error: `Stripe ${mode} credentials are not configured.`,
        };
      }

      try {
        const stripe = getStripe(mode, false);
        let product: Stripe.Product | null = null;
        if (current?.stripe_product_id) {
          const retrieved = await stripe.products.retrieve(
            current.stripe_product_id,
          );
          if (!retrieved.deleted) product = retrieved;
        }
        product ??= await findProduct(stripe, paintingId);
        const productInput: Stripe.ProductUpdateParams = {
          name: painting.title,
          description: painting.description || undefined,
          active: shouldBeActive,
          images: imageUrl && /^https:\/\//.test(imageUrl) ? [imageUrl] : [],
          metadata: { painting_id: painting.id, painting_slug: painting.slug },
        };
        if (product) {
          product = await stripe.products.update(product.id, productInput);
        } else {
          product = await stripe.products.create(
            productInput as Stripe.ProductCreateParams,
            {
              idempotencyKey: `painting-product-${painting.id}-${fingerprint(productInput)}`,
            },
          );
        }

        let price: Stripe.Price | null = null;
        if (current?.stripe_price_id) {
          price = await stripe.prices.retrieve(current.stripe_price_id);
        }
        const priceMatches =
          price?.unit_amount === painting.price_cents &&
          price.currency.toUpperCase() === painting.currency;
        if (!priceMatches) {
          const oldPrice = price;
          const priceInput: Stripe.PriceCreateParams = {
            product: product.id,
            currency: painting.currency.toLowerCase(),
            unit_amount: painting.price_cents,
            active: true,
            metadata: {
              painting_id: painting.id,
              painting_slug: painting.slug,
            },
          };
          price = await stripe.prices.create(
            priceInput,
            {
              idempotencyKey: `painting-price-${painting.id}-${fingerprint(priceInput)}`,
            },
          );
          price = await stripe.prices.retrieve(price.id);
          if (!price.active)
            price = await stripe.prices.update(price.id, { active: true });
          await stripe.products.update(product.id, { default_price: price.id });
          if (oldPrice?.active)
            await stripe.prices.update(oldPrice.id, { active: false });
          if (!shouldBeActive)
            price = await stripe.prices.update(price.id, { active: false });
        } else if (price) {
          if (shouldBeActive && !price.active)
            price = await stripe.prices.update(price.id, { active: true });
          const defaultPriceId =
            typeof product.default_price === "string"
              ? product.default_price
              : product.default_price?.id;
          if (shouldBeActive && defaultPriceId !== price.id)
            await stripe.products.update(product.id, {
              default_price: price.id,
            });
          if (!shouldBeActive && price.active)
            price = await stripe.prices.update(price.id, { active: false });
        }

        const status = shouldBeActive ? "synced" : "inactive";
        await admin.from("painting_stripe_catalog").upsert(
          {
            painting_id: paintingId,
            mode,
            stripe_product_id: product.id,
            stripe_price_id: price?.id ?? null,
            synced_price_cents: painting.price_cents,
            synced_currency: painting.currency,
            sync_status: status,
            sync_error: null,
            last_synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "painting_id,mode" },
        );
        return { mode, status };
      } catch (error) {
        console.error("stripe-catalog-sync-failed", {
          paintingId,
          mode,
          message: error instanceof Error ? error.message : "Unknown error",
        });
        await admin.from("painting_stripe_catalog").upsert(
          {
            painting_id: paintingId,
            mode,
            stripe_product_id: current?.stripe_product_id ?? null,
            stripe_price_id: current?.stripe_price_id ?? null,
            synced_price_cents: current?.synced_price_cents ?? null,
            synced_currency: current?.synced_currency ?? null,
            sync_status: "error",
            sync_error: `Stripe ${mode} catalogue sync failed.`,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "painting_id,mode" },
        );
        return {
          mode,
          status: "error",
          error: `Stripe ${mode} catalogue sync failed.`,
        };
      }
    }),
  );
}

export async function getCheckoutPriceIds(
  paintingIds: string[],
  mode: StripeMode,
) {
  const { data, error } = await createAdminClient()
    .from("painting_stripe_catalog")
    .select("painting_id, stripe_price_id, sync_status")
    .in("painting_id", paintingIds)
    .eq("mode", mode);
  if (error || !data || data.length !== paintingIds.length)
    throw new Error("Stripe catalogue is not ready for checkout.");
  const byPainting = new Map(data.map((row) => [row.painting_id, row]));
  return paintingIds.map((paintingId) => {
    const row = byPainting.get(paintingId);
    if (!row?.stripe_price_id || row.sync_status !== "synced")
      throw new Error("Stripe catalogue is not ready for checkout.");
    return { paintingId, priceId: row.stripe_price_id };
  });
}

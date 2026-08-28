import "server-only";

import type Stripe from "stripe";
import { getStripeSecretKey, type StripeMode } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/server";

export type DiscountSyncResult = {
  error?: string;
  mode: StripeMode;
  status: "synced" | "inactive" | "error";
};

const modes: StripeMode[] = ["test", "live"];

export async function syncDiscountCatalog(
  discountId: string,
): Promise<DiscountSyncResult[]> {
  const admin = createAdminClient();
  const [{ data: discount, error }, { data: products }, { data: rows }] =
    await Promise.all([
      admin.from("discounts").select("*").eq("id", discountId).single(),
      admin
        .from("discount_products")
        .select("painting_id")
        .eq("discount_id", discountId),
      admin
        .from("discount_stripe_catalog")
        .select("*")
        .eq("discount_id", discountId),
    ]);
  if (error || !discount) throw new Error("Discount is unavailable for sync.");

  return Promise.all(
    modes.map(async (mode): Promise<DiscountSyncResult> => {
      const current = rows?.find(
        (row) => row.mode === mode && row.version === discount.version,
      );
      const previous = (rows ?? []).filter(
        (row) => row.mode === mode && row.version < discount.version,
      );
      const now = Date.now();
      const active =
        discount.active &&
        discount.archived_at === null &&
        new Date(discount.starts_at).getTime() <= now &&
        (!discount.ends_at || new Date(discount.ends_at).getTime() > now);

      if (!getStripeSecretKey(mode)) {
        const message = `Stripe ${mode} credentials are not configured.`;
        await admin.from("discount_stripe_catalog").upsert(
          {
            discount_id: discount.id,
            mode,
            version: discount.version,
            stripe_coupon_id: current?.stripe_coupon_id ?? null,
            stripe_promotion_code_id:
              current?.stripe_promotion_code_id ?? null,
            sync_status: "error",
            sync_error: message,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "discount_id,mode,version" },
        );
        return { error: message, mode, status: "error" };
      }

      try {
        const stripe = getStripe(mode, false);
        for (const old of previous) {
          if (!old.stripe_promotion_code_id) continue;
          const promotion = await stripe.promotionCodes.retrieve(
            old.stripe_promotion_code_id,
          );
          if (promotion.active)
            await stripe.promotionCodes.update(promotion.id, { active: false });
          if (old.sync_status !== "inactive")
            await admin
              .from("discount_stripe_catalog")
              .update({ sync_status: "inactive", updated_at: new Date().toISOString() })
              .eq("id", old.id);
        }

        let eligibleProductIds: string[] | undefined;
        if (discount.applies_to === "specific") {
          const paintingIds = (products ?? []).map((item) => item.painting_id);
          const { data: productRows } = await admin
            .from("painting_stripe_catalog")
            .select("painting_id, stripe_product_id")
            .eq("mode", mode)
            .in("painting_id", paintingIds);
          eligibleProductIds = (productRows ?? [])
            .map((item) => item.stripe_product_id)
            .filter((value): value is string => Boolean(value));
          if (eligibleProductIds.length !== paintingIds.length)
            throw new Error("Eligible paintings are not fully synced to Stripe.");
        }

        let coupon: Stripe.Coupon | null = null;
        if (current?.stripe_coupon_id)
          coupon = await stripe.coupons.retrieve(current.stripe_coupon_id);
        if (!coupon || coupon.deleted) {
          const params: Stripe.CouponCreateParams = {
            duration: "once",
            name: `${discount.code} v${discount.version}`,
            applies_to: eligibleProductIds?.length
              ? { products: eligibleProductIds }
              : undefined,
            max_redemptions: discount.max_redemptions ?? undefined,
            redeem_by: discount.ends_at
              ? Math.floor(new Date(discount.ends_at).getTime() / 1000)
              : undefined,
            metadata: {
              discount_id: discount.id,
              discount_version: String(discount.version),
              managed_by: "art_by_elyzaveta",
            },
          };
          if (discount.discount_type === "percentage")
            params.percent_off = discount.percent_off ?? undefined;
          else {
            params.amount_off = discount.amount_off_cents ?? undefined;
            params.currency = "aud";
          }
          coupon = await stripe.coupons.create(params, {
            idempotencyKey: `discount-coupon-${discount.id}-${discount.version}`,
          });
        }

        let promotion: Stripe.PromotionCode | null = null;
        if (current?.stripe_promotion_code_id)
          promotion = await stripe.promotionCodes.retrieve(
            current.stripe_promotion_code_id,
          );
        if (!promotion) {
          promotion = await stripe.promotionCodes.create(
            {
              promotion: { type: "coupon", coupon: coupon.id },
              active,
              code: discount.code.replaceAll("_", "-"),
              max_redemptions: discount.max_redemptions ?? undefined,
              expires_at: discount.ends_at
                ? Math.floor(new Date(discount.ends_at).getTime() / 1000)
                : undefined,
              restrictions: discount.minimum_subtotal_cents
                ? {
                    minimum_amount: discount.minimum_subtotal_cents,
                    minimum_amount_currency: "aud",
                  }
                : undefined,
              metadata: {
                discount_id: discount.id,
                discount_version: String(discount.version),
                original_code: discount.code,
              },
            },
            {
              idempotencyKey: `discount-promotion-${discount.id}-${discount.version}`,
            },
          );
        } else if (promotion.active !== active) {
          promotion = await stripe.promotionCodes.update(promotion.id, { active });
        }

        const status = active ? "synced" : "inactive";
        await admin.from("discount_stripe_catalog").upsert(
          {
            discount_id: discount.id,
            mode,
            version: discount.version,
            stripe_coupon_id: coupon.id,
            stripe_promotion_code_id: promotion.id,
            sync_status: status,
            sync_error: null,
            last_synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "discount_id,mode,version" },
        );
        return { mode, status };
      } catch (caught) {
        const message =
          caught instanceof Error
            ? `Stripe ${mode} discount sync failed: ${caught.message}`
            : `Stripe ${mode} discount sync failed.`;
        await admin.from("discount_stripe_catalog").upsert(
          {
            discount_id: discount.id,
            mode,
            version: discount.version,
            stripe_coupon_id: current?.stripe_coupon_id ?? null,
            stripe_promotion_code_id:
              current?.stripe_promotion_code_id ?? null,
            sync_status: "error",
            sync_error: message.slice(0, 500),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "discount_id,mode,version" },
        );
        return { error: message, mode, status: "error" };
      }
    }),
  );
}

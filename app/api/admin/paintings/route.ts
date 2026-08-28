import { NextResponse } from "next/server";
import { getAccountIdentity } from "@/lib/auth/authorization";
import { paintingInputSchema } from "@/lib/painting-admin";
import { syncPaintingCatalog } from "@/lib/stripe/catalog";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const user = await getAccountIdentity();
  if (user?.profile.role !== "admin" || user.aal !== "aal2")
    return NextResponse.json(
      { error: "AAL2 administrator access required" },
      { status: 403 },
    );
  const parsed = paintingInputSchema.safeParse(await request.json());
  if (!parsed.success)
    return NextResponse.json(
      { error: "Review the painting details" },
      { status: 400 },
    );
  const value = parsed.data;
  const { data, error } = await createAdminClient()
    .from("paintings")
    .insert({
      slug: value.slug,
      title: value.title,
      description: value.description,
      story: value.story,
      price_cents: value.priceAud,
      shipping_cents: value.shippingAud,
      currency: value.currency,
      width_cm: value.widthCm,
      height_cm: value.heightCm,
      depth_cm: value.depthCm,
      medium: value.medium,
      surface: value.surface,
      category: value.category,
      orientation: value.orientation,
      framed: value.framed,
      frame_description: value.frameDescription,
      signed: value.signed,
      ready_to_hang: value.readyToHang,
      certificate: value.certificate,
      status: value.status,
      featured: value.featured,
      year: value.year,
      seo_title: value.seoTitle,
      seo_description: value.seoDescription,
      published_at: value.status === "draft" ? null : new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !data)
    return NextResponse.json(
      {
        error:
          error?.code === "23505"
            ? "That painting URL is already in use."
            : "Painting not saved",
      },
      { status: 409 },
    );
  await createAdminClient()
    .from("admin_audit_log")
    .insert({
      actor_user_id: user.id,
      action: "painting.created",
      target_type: "painting",
      target_id: data.id,
      safe_metadata: { slug: value.slug, status: value.status },
    });
  const stripeSync = await syncPaintingCatalog(data.id);
  return NextResponse.json({ id: data.id, stripeSync }, { status: 201 });
}

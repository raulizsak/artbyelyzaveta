import { NextResponse } from "next/server";
import { z } from "zod";
import { getAccountIdentity } from "@/lib/auth/authorization";
import { paintingInputSchema } from "@/lib/painting-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAccountIdentity();
  if (user?.profile.role !== "admin" || user.aal !== "aal2")
    return NextResponse.json(
      { error: "AAL2 administrator access required" },
      { status: 403 },
    );
  const id = (await params).id;
  const parsed = paintingInputSchema.safeParse(await request.json());
  if (!z.uuid().safeParse(id).success || !parsed.success)
    return NextResponse.json(
      { error: "Review the painting details" },
      { status: 400 },
    );
  const value = parsed.data;
  const admin = createAdminClient();
  const { data: current } = await admin
    .from("paintings")
    .select("published_at")
    .eq("id", id)
    .maybeSingle();
  if (!current)
    return NextResponse.json({ error: "Painting not found" }, { status: 404 });
  const { error } = await admin
    .from("paintings")
    .update({
      slug: value.slug,
      title: value.title,
      description: value.description,
      story: value.story,
      price_cents: value.priceCents,
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
      published_at:
        value.status === "draft"
          ? null
          : (current.published_at ?? new Date().toISOString()),
    })
    .eq("id", id);
  if (error)
    return NextResponse.json({ error: "Painting not saved" }, { status: 409 });
  await admin.from("admin_audit_log").insert({
    actor_user_id: user.id,
    action: "painting.updated",
    target_type: "painting",
    target_id: id,
    safe_metadata: { slug: value.slug, status: value.status },
  });
  return NextResponse.json({ id });
}

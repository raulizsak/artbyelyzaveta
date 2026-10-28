import { NextResponse } from "next/server";
import { z } from "zod";
import { getAccountIdentity } from "@/lib/auth/authorization";
import { parseMediaPositionToken } from "@/lib/painting-media";
import { syncPaintingCatalog } from "@/lib/stripe/catalog";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const mediaSchema = z.object({
  media: z
    .array(
      z.object({
        kind: z.enum(["artwork", "room", "detail"]),
        storage_path: z.string().min(1).max(500),
        variant: z.enum(["thumbnail", "card", "main", "large", "original"]),
        width: z.number().int().positive(),
        height: z.number().int().positive(),
        bytes: z.number().int().positive(),
        mime_type: z.enum([
          "image/jpeg",
          "image/png",
          "image/webp",
          "image/avif",
        ]),
        alt_text: z.string().trim().min(1).max(300),
        position: z.number().int().min(0),
      }),
    )
    .min(1)
    .max(150),
});

const reorderSchema = z.object({
  groupKeys: z.array(z.string().min(1).max(500)).max(30),
});

const removeSchema = z.object({ groupKey: z.string().min(1).max(500) });

async function adminIdentity() {
  const user = await getAccountIdentity();
  return user?.profile.role === "admin" && user.aal === "aal2" ? user : null;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await adminIdentity();
  if (!user)
    return NextResponse.json(
      { error: "AAL2 administrator access required" },
      { status: 403 },
    );
  const id = (await params).id;
  const parsed = mediaSchema.safeParse(await request.json());
  if (!z.uuid().safeParse(id).success || !parsed.success)
    return NextResponse.json(
      { error: "Invalid media metadata" },
      { status: 400 },
    );
  if (
    parsed.data.media.some(
      (item) =>
        !item.storage_path.startsWith(`${id}/`) ||
        !new RegExp(
          `^${id}/[a-f0-9-]{36}/(?:original\\.(?:jpg|png|webp)|(?:thumbnail|card|main|large)\\.webp)$`,
          "i",
        ).test(item.storage_path),
    )
  )
    return NextResponse.json(
      { error: "Image paths must belong to this painting." },
      { status: 400 },
    );
  const admin = createAdminClient();
  const { error } = await admin.from("painting_media").upsert(
    parsed.data.media.map((item) => ({ ...item, painting_id: id })),
    { onConflict: "storage_path" },
  );
  if (error)
    return NextResponse.json(
      { error: "Media metadata not saved" },
      { status: 503 },
    );
  await admin.from("admin_audit_log").insert({
    actor_user_id: user.id,
    action: "painting.media_uploaded",
    target_type: "painting",
    target_id: id,
    safe_metadata: { files: parsed.data.media.length },
  });
  const stripeSync = await syncPaintingCatalog(id);
  return NextResponse.json({ ok: true, stripeSync });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await adminIdentity();
  if (!user)
    return NextResponse.json(
      { error: "AAL2 administrator access required" },
      { status: 403 },
    );
  const id = (await params).id;
  const parsed = reorderSchema.safeParse(await request.json());
  if (
    !z.uuid().safeParse(id).success ||
    !parsed.success ||
    parsed.data.groupKeys.some((key) => parseMediaPositionToken(key) === null)
  )
    return NextResponse.json({ error: "Invalid image order" }, { status: 400 });

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_reorder_painting_media", {
    p_painting_id: id,
    p_group_keys: parsed.data.groupKeys,
  });
  if (error)
    return NextResponse.json(
      { error: "Image order not saved" },
      { status: 409 },
    );
  const admin = createAdminClient();
  await admin.from("admin_audit_log").insert({
    actor_user_id: user.id,
    action: "painting.media_reordered",
    target_type: "painting",
    target_id: id,
    safe_metadata: { images: parsed.data.groupKeys.length },
  });
  const stripeSync = await syncPaintingCatalog(id);
  return NextResponse.json({ ok: true, stripeSync });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await adminIdentity();
  if (!user)
    return NextResponse.json(
      { error: "AAL2 administrator access required" },
      { status: 403 },
    );
  const id = (await params).id;
  const parsed = removeSchema.safeParse(await request.json());
  const position = parsed.success
    ? parseMediaPositionToken(parsed.data.groupKey)
    : null;
  if (!z.uuid().safeParse(id).success || !parsed.success || position === null)
    return NextResponse.json({ error: "Invalid image" }, { status: 400 });

  const admin = createAdminClient();
  const { data: media, error: readError } = await admin
    .from("painting_media")
    .select("id, storage_path, variant")
    .eq("painting_id", id)
    .eq("position", position);
  if (readError || !media?.length)
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  const [
    { data: painting, error: paintingError },
    { count, error: countError },
  ] = await Promise.all([
    admin.from("paintings").select("status").eq("id", id).maybeSingle(),
    admin
      .from("painting_media")
      .select("id", { count: "exact", head: true })
      .eq("painting_id", id)
      .eq("variant", "main"),
  ]);
  if (paintingError || countError || !painting)
    return NextResponse.json(
      { error: "Photograph protection could not be checked. Try again." },
      { status: 503 },
    );
  if (
    painting.status === "reserved" ||
    (painting.status === "available" && (count ?? 0) <= 1)
  )
    return NextResponse.json(
      {
        error:
          "Keep a main photograph for published artwork. Reserved artwork cannot be changed during checkout.",
      },
      { status: 409 },
    );
  // Remove only the catalogue association. Retain public variants and private
  // masters so historical order snapshots and other references stay valid.
  // Storage reclamation requires a separate reviewed retention operation.
  const { error: deleteError } = await admin
    .from("painting_media")
    .delete()
    .eq("painting_id", id)
    .eq("position", position);
  if (deleteError)
    return NextResponse.json(
      { error: "Image details not removed" },
      { status: 503 },
    );

  await admin.from("admin_audit_log").insert({
    actor_user_id: user.id,
    action: "painting.media_removed",
    target_type: "painting",
    target_id: id,
    safe_metadata: { variants: media.length },
  });
  const stripeSync = await syncPaintingCatalog(id);
  return NextResponse.json({ ok: true, stripeSync });
}

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
    .max(30),
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
    parsed.data.groupKeys.some(
      (key) => parseMediaPositionToken(key) === null,
    )
  )
    return NextResponse.json({ error: "Invalid image order" }, { status: 400 });

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_reorder_painting_media", {
    p_painting_id: id,
    p_group_keys: parsed.data.groupKeys,
  });
  if (error)
    return NextResponse.json({ error: "Image order not saved" }, { status: 409 });
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
  if (
    !z.uuid().safeParse(id).success ||
    !parsed.success ||
    position === null
  )
    return NextResponse.json({ error: "Invalid image" }, { status: 400 });

  const admin = createAdminClient();
  const { data: media, error: readError } = await admin
    .from("painting_media")
    .select("id, storage_path, variant")
    .eq("painting_id", id)
    .eq("position", position);
  if (readError || !media?.length)
    return NextResponse.json({ error: "Image not found" }, { status: 404 });

  const originals = media
    .filter((item) => item.variant === "original")
    .map((item) => item.storage_path);
  const publicVariants = media
    .filter((item) => item.variant !== "original")
    .map((item) => item.storage_path);
  if (originals.length) {
    const removed = await admin.storage.from("artwork-originals").remove(originals);
    if (removed.error)
      return NextResponse.json({ error: "Original image not removed" }, { status: 503 });
  }
  if (publicVariants.length) {
    const removed = await admin.storage.from("artwork-public").remove(publicVariants);
    if (removed.error)
      return NextResponse.json({ error: "Published image not removed" }, { status: 503 });
  }
  const { error: deleteError } = await admin
    .from("painting_media")
    .delete()
    .eq("painting_id", id)
    .eq("position", position);
  if (deleteError)
    return NextResponse.json({ error: "Image details not removed" }, { status: 503 });

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

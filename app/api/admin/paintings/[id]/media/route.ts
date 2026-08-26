import { NextResponse } from "next/server";
import { z } from "zod";
import { getAccountIdentity } from "@/lib/auth/authorization";
import { createAdminClient } from "@/lib/supabase/admin";

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
export async function POST(
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
  return NextResponse.json({ ok: true });
}

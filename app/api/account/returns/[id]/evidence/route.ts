import { NextResponse } from "next/server";
import { z } from "zod";
import { getAccountIdentity } from "@/lib/auth/authorization";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  files: z
    .array(
      z.object({
        path: z.string().max(500),
        mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
        bytes: z
          .number()
          .int()
          .min(1)
          .max(5 * 1024 * 1024),
      }),
    )
    .min(1)
    .max(5),
});
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAccountIdentity();
  if (!user)
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const returnId = (await params).id;
  const parsed = schema.safeParse(await request.json());
  if (!z.uuid().safeParse(returnId).success || !parsed.success)
    return NextResponse.json({ error: "Invalid evidence" }, { status: 400 });
  const admin = createAdminClient();
  const { data: requestRecord } = await admin
    .from("return_requests")
    .select("id")
    .eq("id", returnId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!requestRecord)
    return NextResponse.json({ error: "Return unavailable" }, { status: 404 });
  const prefix = `${user.id}/${returnId}/`;
  for (const file of parsed.data.files) {
    if (!file.path.startsWith(prefix))
      return NextResponse.json(
        { error: "Invalid evidence path" },
        { status: 400 },
      );
    const name = file.path.slice(prefix.length);
    const { data } = await admin.storage
      .from("return-evidence")
      .list(`${user.id}/${returnId}`, { search: name, limit: 2 });
    const stored = data?.find((entry) => entry.name === name);
    const metadata = stored?.metadata as
      | { size?: number; mimetype?: string }
      | undefined;
    if (
      !stored ||
      Number(metadata?.size) !== file.bytes ||
      metadata?.mimetype !== file.mimeType
    )
      return NextResponse.json(
        { error: "Evidence could not be verified" },
        { status: 400 },
      );
  }
  const { error } = await admin.from("return_evidence").insert(
    parsed.data.files.map((file) => ({
      return_request_id: returnId,
      user_id: user.id,
      storage_path: file.path,
      mime_type: file.mimeType,
      bytes: file.bytes,
    })),
  );
  return error
    ? NextResponse.json({ error: "Evidence not recorded" }, { status: 503 })
    : NextResponse.json({ ok: true }, { status: 201 });
}

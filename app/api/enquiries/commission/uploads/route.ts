import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { uploadRequestSchema } from "@/lib/enquiries";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

const extensions = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export async function POST(request: Request) {
  try {
    if (
      !(await enforceRateLimit(request, {
        scope: "commission-upload",
        limit: 9,
        windowMs: 60 * 60 * 1000,
      }))
    ) {
      return NextResponse.json(
        { error: "Please wait before uploading more images." },
        { status: 429 },
      );
    }
    const parsed = uploadRequestSchema.safeParse(await request.json());
    if (!parsed.success)
      return NextResponse.json(
        {
          error: "Please choose up to three supported images under 8 MB each.",
        },
        { status: 400 },
      );
    const folder = randomUUID();
    const supabase = createAdminClient();
    const uploads = await Promise.all(
      parsed.data.files.map(async (file) => {
        const path = `pending/${folder}/${randomUUID()}.${extensions[file.contentType]}`;
        const { data, error } = await supabase.storage
          .from("commission-inspiration")
          .createSignedUploadUrl(path);
        if (error || !data?.token)
          throw error ?? new Error("missing-upload-token");
        return { ...file, path, token: data.token };
      }),
    );
    return NextResponse.json({ uploads });
  } catch {
    return NextResponse.json(
      { error: "We couldn't prepare the private upload. Please try again." },
      { status: 503 },
    );
  }
}

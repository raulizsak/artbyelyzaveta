import { NextResponse } from "next/server";
import { z } from "zod";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  email: z
    .string()
    .trim()
    .max(320)
    .email()
    .transform((value) => value.toLowerCase()),
});

export async function POST(request: Request) {
  try {
    if (
      !(await enforceRateLimit(request, {
        scope: "subscriber",
        limit: 8,
        windowMs: 60 * 60 * 1000,
      }))
    )
      return NextResponse.json(
        { error: "Please wait before trying again." },
        { status: 429 },
      );

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success)
      return NextResponse.json(
        { error: "Enter a valid email address." },
        { status: 400 },
      );

    const { error } = await createAdminClient().from("subscribers").upsert(
      {
        email: parsed.data.email,
        status: "active",
        source: "coming_soon",
      },
      { onConflict: "normalized_email" },
    );
    if (error) throw error;
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "We couldn't add you just now." },
      { status: 503 },
    );
  }
}

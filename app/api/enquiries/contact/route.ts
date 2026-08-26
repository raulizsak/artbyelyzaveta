import { NextResponse } from "next/server";
import { contactSchema } from "@/lib/enquiries";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    if (
      !(await enforceRateLimit(request, {
        scope: "contact",
        limit: 5,
        windowMs: 60 * 60 * 1000,
      }))
    ) {
      return NextResponse.json(
        { error: "Please wait before sending another enquiry." },
        { status: 429 },
      );
    }
    const parsed = contactSchema.safeParse(await request.json());
    if (!parsed.success)
      return NextResponse.json(
        { error: "Please review the required fields." },
        { status: 400 },
      );
    const { error } = await createAdminClient()
      .from("contact_enquiries")
      .insert(parsed.data);
    if (error) throw error;
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "We couldn't save your message. Please try again shortly." },
      { status: 503 },
    );
  }
}

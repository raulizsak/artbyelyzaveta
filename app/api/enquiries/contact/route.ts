import { after, NextResponse } from "next/server";
import { contactSchema } from "@/lib/enquiries";
import { triggerEmailOutbox } from "@/lib/email/outbox";
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
    const admin = createAdminClient();
    const { data: created, error } = await admin
      .from("contact_enquiries")
      .insert(parsed.data)
      .select("id, created_at")
      .single();
    if (error || !created) throw error ?? new Error("missing-enquiry");
    after(async () => {
      await triggerEmailOutbox();
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "We couldn't save your message. Please try again shortly." },
      { status: 503 },
    );
  }
}

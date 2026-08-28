import { NextResponse } from "next/server";
import { contactSchema } from "@/lib/enquiries";
import { sendShopNotification } from "@/lib/email/smtp2go";
import { describeEmailFailure } from "@/lib/email/transport";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatMelbourneDateTime } from "@/lib/date-time";

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
    try {
      const providerId = await sendShopNotification({
        subject: `New contact enquiry — ${parsed.data.subject}`,
        heading: "New contact enquiry",
        replyTo: parsed.data.email,
        rows: [
          ["Name", parsed.data.name],
          ["Email", parsed.data.email],
          ["Subject", parsed.data.subject],
          ["Submitted", formatMelbourneDateTime(created.created_at)],
        ],
        message: parsed.data.message,
      });
      await admin
        .from("contact_enquiries")
        .update({
          notification_status: "sent",
          notification_sent_at: new Date().toISOString(),
          notification_provider_id: providerId,
          notification_error: null,
        })
        .eq("id", created.id);
    } catch (notificationError) {
      const notificationFailure = describeEmailFailure(notificationError);
      console.error("Contact enquiry email failed:", notificationFailure);
      await admin
        .from("contact_enquiries")
        .update({
          notification_status: "failed",
          notification_error: notificationFailure,
        })
        .eq("id", created.id);
    }
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "We couldn't save your message. Please try again shortly." },
      { status: 503 },
    );
  }
}

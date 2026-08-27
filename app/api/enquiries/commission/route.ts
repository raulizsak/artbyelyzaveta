import { NextResponse } from "next/server";
import { commissionSchema } from "@/lib/enquiries";
import { sendShopNotification } from "@/lib/email/smtp2go";
import { describeEmailFailure } from "@/lib/email/transport";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    if (
      !(await enforceRateLimit(request, {
        scope: "commission",
        limit: 4,
        windowMs: 60 * 60 * 1000,
      }))
    ) {
      return NextResponse.json(
        { error: "Please wait before sending another commission enquiry." },
        { status: 429 },
      );
    }
    const parsed = commissionSchema.safeParse(await request.json());
    if (!parsed.success)
      return NextResponse.json(
        { error: "Please review the required fields and uploads." },
        { status: 400 },
      );
    const supabase = createAdminClient();
    for (const file of parsed.data.inspirationFiles) {
      const parts = file.path.split("/");
      const name = parts.pop()!;
      const folder = parts.join("/");
      const { data, error } = await supabase.storage
        .from("commission-inspiration")
        .list(folder, { search: name, limit: 2 });
      const stored = data?.find((entry) => entry.name === name);
      const metadata = stored?.metadata as
        | { size?: number; mimetype?: string }
        | undefined;
      if (
        error ||
        !stored ||
        Number(metadata?.size) !== file.size ||
        metadata?.mimetype !== file.contentType
      ) {
        return NextResponse.json(
          {
            error:
              "An inspiration image could not be verified. Please upload it again.",
          },
          { status: 400 },
        );
      }
    }
    const { inspirationFiles, ...enquiry } = parsed.data;
    const { data: created, error } = await supabase
      .from("commission_enquiries")
      .insert(enquiry)
      .select("id, created_at")
      .single();
    if (error || !created) throw error ?? new Error("missing-enquiry");
    if (inspirationFiles.length) {
      const { error: filesError } = await supabase
        .from("commission_inspiration_files")
        .insert(
          inspirationFiles.map((file) => ({
            commission_enquiry_id: created.id,
            storage_path: file.path,
            mime_type: file.contentType,
            bytes: file.size,
          })),
        );
      if (filesError) {
        await supabase
          .from("commission_enquiries")
          .delete()
          .eq("id", created.id);
        throw filesError;
      }
    }
    try {
      const providerId = await sendShopNotification({
        subject: `New commission enquiry — ${enquiry.subject}`,
        heading: "New commission enquiry",
        replyTo: enquiry.email,
        rows: [
          ["Name", enquiry.name],
          ["Email", enquiry.email],
          ["Phone", enquiry.phone],
          ["Subject", enquiry.subject],
          ["Dimensions", enquiry.dimensions],
          ["Budget", enquiry.budget],
          ["Timing", enquiry.timing],
          ["Submitted", new Date(created.created_at).toLocaleString("en-AU")],
          [
            "Inspiration files",
            inspirationFiles.length ? String(inspirationFiles.length) : "None",
          ],
          ["Additional notes", enquiry.notes],
        ],
        message: enquiry.inspiration,
      });
      await supabase
        .from("commission_enquiries")
        .update({
          notification_status: "sent",
          notification_sent_at: new Date().toISOString(),
          notification_provider_id: providerId,
          notification_error: null,
        })
        .eq("id", created.id);
    } catch (notificationError) {
      const notificationFailure = describeEmailFailure(notificationError);
      console.error("Commission enquiry email failed:", notificationFailure);
      await supabase
        .from("commission_enquiries")
        .update({
          notification_status: "failed",
          notification_error: notificationFailure,
        })
        .eq("id", created.id);
    }
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch {
    return NextResponse.json(
      {
        error:
          "We couldn't save your commission enquiry. Please try again shortly.",
      },
      { status: 503 },
    );
  }
}

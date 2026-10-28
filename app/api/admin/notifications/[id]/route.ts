import { z } from "zod";
import { getAccountIdentity } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";
const input = z.object({
  resolution: z.enum(["retry", "sent", "cancelled"]),
  note: z.string().trim().min(10).max(500),
  providerId: z.string().max(200).optional(),
  verified: z.literal(true),
});
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const identity = await getAccountIdentity();
  if (identity?.profile.role !== "admin" || identity.aal !== "aal2")
    return Response.json(
      { error: "Administrator MFA is required." },
      { status: 403 },
    );
  try {
    const id = (await params).id;
    const value = input.safeParse(await request.json());
    if (
      !z.uuid().safeParse(id).success ||
      !value.success ||
      (value.data.resolution === "sent" && !value.data.providerId?.trim())
    )
      return Response.json(
        { error: "Record the provider evidence and a reconciliation note." },
        { status: 400 },
      );
    const result = await (
      await createClient()
    ).rpc("resolve_email_delivery", {
      p_id: id,
      p_resolution: value.data.resolution,
      p_note: value.data.note,
      p_provider_id: value.data.providerId?.trim() || undefined,
    });
    if (result.error)
      return Response.json(
        { error: "Reconciliation could not be saved." },
        { status: 503 },
      );
    if (result.data !== true)
      return Response.json(
        {
          error:
            "This notification has changed. Refresh and review its status.",
        },
        { status: 409 },
      );
    return Response.json({ ok: true });
  } catch {
    return Response.json(
      { error: "Reconciliation is temporarily unavailable." },
      { status: 503 },
    );
  }
}

import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!isSupabaseConfigured()) throw new Error("configuration-unavailable");
    const database = await createClient();
    const { error } = await database
      .from("paintings")
      .select("id", { head: true })
      .limit(1)
      .abortSignal(AbortSignal.timeout(5000));
    if (error) throw error;
    return Response.json(
      { status: "ok" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { status: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

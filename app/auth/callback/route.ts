import { NextResponse } from "next/server";
import { SITE_URL } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import { safePreviewNext } from "@/lib/preview";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextParam = url.searchParams.get("next");
  const next = safePreviewNext(nextParam ?? "/account");
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // The RPC itself verifies the confirmed auth email before linking orders.
      await supabase.rpc("claim_my_guest_orders");
      return NextResponse.redirect(new URL(next, SITE_URL));
    }
  }
  return NextResponse.redirect(new URL("/login?error=auth-link", SITE_URL));
}

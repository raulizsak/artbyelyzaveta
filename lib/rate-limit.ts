import "server-only";

import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

type RateLimitOptions = { scope: string; limit: number; windowMs: number };

function requestKey(request: Request) {
  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  const source = forwarded || request.headers.get("x-real-ip") || "unknown";
  const pepper =
    process.env.RATE_LIMIT_SECRET ||
    process.env.SUPABASE_SECRET_KEY ||
    "local-development";
  return `\\x${createHash("sha256").update(`${pepper}:${source}`).digest("hex")}`;
}

export async function enforceRateLimit(
  request: Request,
  options: RateLimitOptions,
) {
  const supabase = createAdminClient();
  const keyHash = requestKey(request);
  const since = new Date(Date.now() - options.windowMs).toISOString();
  const { count, error } = await supabase
    .from("rate_limit_events")
    .select("id", { count: "exact", head: true })
    .eq("scope", options.scope)
    .eq("key_hash", keyHash)
    .gte("created_at", since);
  if (error) throw new Error("rate-limit-unavailable");
  if ((count ?? 0) >= options.limit) return false;
  const { error: insertError } = await supabase
    .from("rate_limit_events")
    .insert({ scope: options.scope, key_hash: keyHash });
  if (insertError) throw new Error("rate-limit-unavailable");
  return true;
}

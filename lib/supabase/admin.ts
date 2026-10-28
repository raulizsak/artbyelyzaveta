import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig, getSupabaseSecretKey } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";

export function createAdminClient() {
  const { url } = getSupabasePublicConfig();
  return createClient<Database>(url, getSupabaseSecretKey(), {
    global: { fetch: fetchWithTimeout },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

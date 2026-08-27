import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig, getSupabaseSecretKey } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

export function createAdminClient() {
  const { url } = getSupabasePublicConfig();
  return createClient<Database>(url, getSupabaseSecretKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

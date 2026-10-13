import { createClient } from "@supabase/supabase-js";
import { requireServiceRole, requireSupabase } from "@/lib/env";

export function createAdminClient() {
  const { url } = requireSupabase();
  const serviceRoleKey = requireServiceRole();

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

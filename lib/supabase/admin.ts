import "server-only"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

/**
 * Service-role Supabase client. Bypasses RLS and can call the GoTrue admin API
 * (`auth.admin.*`) to mint verification / recovery links and manage users.
 *
 * Never import this into a Client Component — the key must stay server-side.
 */
let cached: SupabaseClient | null = null

export function createAdminClient(): SupabaseClient {
  if (cached) return cached

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error("Supabase service-role credentials are not configured.")
  }

  cached = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return cached
}

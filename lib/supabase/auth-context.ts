import { createClient } from "@/lib/supabase/server"

export type AppRole = "submitter" | "judge" | "admin"

export type Profile = {
  id: string
  display_name: string
  role: AppRole
  created_at: string
}

export async function getAuthContext() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { supabase, user: null, profile: null }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, display_name, role, created_at")
    .eq("id", user.id)
    .maybeSingle()

  if (profileError || !profile) return { supabase, user, profile: null }
  return { supabase, user, profile: { ...profile, role: profile.role as AppRole } as Profile }
}

import { NextResponse } from "next/server"
import { getAuthContext } from "@/lib/supabase/auth-context"
import { canViewProject } from "@/lib/permissions"
import type { Profile } from "@/lib/supabase/auth-context"

type SupabaseServerClient = Awaited<ReturnType<typeof getAuthContext>>["supabase"]
type AuthUser = Awaited<ReturnType<typeof getAuthContext>>["user"]

export type ProjectAccess =
  | { ok: true; supabase: SupabaseServerClient; user: NonNullable<AuthUser>; profile: Profile; row: ProjectRow }
  | { ok: false; response: NextResponse }

export type ProjectRow = {
  id: string
  owner_id: string | null
  title: string
  developer: string | null
  folder_key: string
  status: string
  created_at: string
}

const PROJECT_COLUMNS = "id, owner_id, title, developer, folder_key, status, created_at"

/**
 * Loads a project row and verifies the signed-in user may touch it. Applicants
 * are scoped to submissions they own; reviewers and admins may open any project.
 *
 * Every project-scoped API route funnels through here so a hand-crafted URL can
 * never expose another applicant's archive, previews, or reports.
 */
export async function requireProjectAccess(projectId: string, notFoundMessage = "Project not found."): Promise<ProjectAccess> {
  const { supabase, user, profile } = await getAuthContext()
  if (!user || !profile) return { ok: false, response: NextResponse.json({ error: notFoundMessage }, { status: 404 }) }

  const { data: row, error } = await supabase
    .from("projects")
    .select(PROJECT_COLUMNS)
    .eq("id", projectId)
    .maybeSingle()
  if (error || !row) return { ok: false, response: NextResponse.json({ error: notFoundMessage }, { status: 404 }) }

  const projectRow = row as ProjectRow
  if (!canViewProject(profile.role, user.id, projectRow.owner_id)) {
    return { ok: false, response: NextResponse.json({ error: notFoundMessage }, { status: 404 }) }
  }
  return { ok: true, supabase, user, profile, row: projectRow }
}

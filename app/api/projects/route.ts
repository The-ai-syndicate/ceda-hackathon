import { NextResponse } from "next/server"
import { listStoredProjects } from "@/lib/r2-storage"
import { getAuthContext } from "@/lib/supabase/auth-context"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const { supabase, user, profile } = await getAuthContext()
  if (!user || !profile) return NextResponse.json({ error: "Authentication required." }, { status: 401 })

  try {
    let query = supabase
      .from("projects")
      .select("id, owner_id, title, developer, folder_key, status, created_at")
      .order("created_at", { ascending: false })
    if (profile.role === "submitter") {
      query = query.eq("owner_id", user.id)
    }
    const { data: rows, error } = await query
    if (error) throw error

    const storedProjects = await listStoredProjects()
    const storedById = new Map(storedProjects.map((project) => [project.id, project]))
    const projects = (rows || []).flatMap((row) => {
      const stored = storedById.get(row.id)
      return stored ? [{
        ...stored,
        title: row.title,
        developer: row.developer,
        createdAt: row.created_at,
        ownerId: row.owner_id,
        folderKey: row.folder_key,
        status: row.status,
      }] : []
    })
    return NextResponse.json(projects, { headers: { "Cache-Control": "private, no-store" } })
  } catch {
    return NextResponse.json({ error: "Saved projects could not be loaded." }, { status: 503 })
  }
}

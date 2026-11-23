import { NextResponse } from "next/server"
import { getStoredProject } from "@/lib/r2-storage"
import { requireProjectAccess } from "@/lib/supabase/project-access"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^submission-[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Project not found." }, { status: 404 })

  // Applicants are scoped to their own submissions; reviewers/admins see all.
  const access = await requireProjectAccess(id)
  if (!access.ok) return access.response
  const { row, user, profile } = access

  try {
    const stored = await getStoredProject(id)
    if (!stored) return NextResponse.json({ error: "Project not found." }, { status: 404 })
    return NextResponse.json({
      project: {
        ...stored,
        title: row.title,
        developer: row.developer,
        createdAt: row.created_at,
        ownerId: row.owner_id,
        folderKey: row.folder_key,
        status: row.status,
      },
      currentUserId: user.id,
      currentUserRole: profile.role,
      isOwner: row.owner_id === user.id,
    }, { headers: { "Cache-Control": "private, no-store" } })
  } catch {
    return NextResponse.json({ error: "Project data is unavailable." }, { status: 503 })
  }
}

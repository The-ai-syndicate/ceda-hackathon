import { NextResponse } from "next/server"
import { getStoredPreview } from "@/lib/r2-storage"
import { requireProjectAccess } from "@/lib/supabase/project-access"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; index: string }> }) {
  const { id, index: indexParam } = await params
  const previewIndex = Number(indexParam)
  if (!/^submission-[0-9a-f-]{36}$/i.test(id) || !Number.isInteger(previewIndex) || previewIndex < 0 || previewIndex > 4) {
    return NextResponse.json({ error: "Preview not found." }, { status: 404 })
  }

  const access = await requireProjectAccess(id, "Preview not found.")
  if (!access.ok) return access.response

  try {
    const preview = await getStoredPreview(id, previewIndex)
    return new Response(Buffer.from(preview.body), {
      headers: {
        "Content-Type": preview.contentType,
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": "inline",
      },
    })
  } catch {
    return NextResponse.json({ error: "Preview not found." }, { status: 404 })
  }
}

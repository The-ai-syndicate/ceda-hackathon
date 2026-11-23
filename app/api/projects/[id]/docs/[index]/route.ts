import { NextResponse } from "next/server"
import { getStoredDoc } from "@/lib/r2-storage"
import { requireProjectAccess } from "@/lib/supabase/project-access"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; index: string }> }) {
  const { id, index: indexParam } = await params
  const docIndex = Number(indexParam)
  if (!/^submission-[0-9a-f-]{36}$/i.test(id) || !Number.isInteger(docIndex) || docIndex < 0) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 })
  }

  const access = await requireProjectAccess(id, "Document not found.")
  if (!access.ok) return access.response

  try {
    const doc = await getStoredDoc(id, docIndex)
    return new Response(Buffer.from(doc.body), {
      headers: {
        "Content-Type": doc.contentType,
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": `inline; filename="${doc.fileName}"`,
      },
    })
  } catch {
    return NextResponse.json({ error: "Document not found." }, { status: 404 })
  }
}

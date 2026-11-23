import { NextResponse } from "next/server"
import { getStoredScreenshot } from "@/lib/r2-storage"
import { requireProjectAccess } from "@/lib/supabase/project-access"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; index: string }> }) {
  const { id, index: indexParam } = await params
  const screenshotIndex = Number(indexParam)
  if (!/^submission-[0-9a-f-]{36}$/i.test(id) || !Number.isInteger(screenshotIndex) || screenshotIndex < 0) {
    return NextResponse.json({ error: "Screenshot not found." }, { status: 404 })
  }

  const access = await requireProjectAccess(id, "Screenshot not found.")
  if (!access.ok) return access.response

  try {
    const screenshot = await getStoredScreenshot(id, screenshotIndex)
    return new Response(Buffer.from(screenshot.body), {
      headers: {
        "Content-Type": screenshot.contentType,
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": "inline",
      },
    })
  } catch {
    return NextResponse.json({ error: "Screenshot not found." }, { status: 404 })
  }
}

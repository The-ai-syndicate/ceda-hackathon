import { NextResponse } from "next/server"
import { getAuthContext } from "@/lib/supabase/auth-context"

export const dynamic = "force-dynamic"

export async function GET() {
  const { user, profile } = await getAuthContext()
  if (!user || !profile) return NextResponse.json({ error: "Authentication required." }, { status: 401 })
  return NextResponse.json({
    id: user.id,
    email: user.email,
    displayName: profile.display_name,
    role: profile.role,
  }, { headers: { "Cache-Control": "private, no-store" } })
}

import { NextResponse } from "next/server"
import { getAuthContext } from "@/lib/supabase/auth-context"
import { isAdmin } from "@/lib/permissions"
import { MOCK_AUDIT_LOG, type AuditCategory, type AuditEntry } from "@/lib/audit-log"

export const dynamic = "force-dynamic"

const CATEGORIES: AuditCategory[] = ["access", "submissions", "judging", "admin"]

/**
 * Admin-only audit trail.
 *
 * MOCK DATA: this returns `MOCK_AUDIT_LOG` rather than reading a table. The
 * response shape is exactly what `AuditLogView` consumes, so the day an
 * `audit_log` table exists the only change here is swapping the constant for a
 * Supabase query — no client changes required.
 *
 * Filtering is implemented server-side (and mirrored client-side for instant
 * feedback) so the same params work against a real table's SQL WHERE clause.
 */
export async function GET(request: Request) {
  const { user, profile } = await getAuthContext()
  if (!user) return NextResponse.json({ error: "Sign in to view the audit trail." }, { status: 401 })

  // The audit trail is administrator-only: it reveals judge activity, applicant
  // identities, and failed sign-in attempts with IPs.
  if (!isAdmin(profile?.role)) {
    return NextResponse.json({ error: "The audit trail is restricted to administrators." }, { status: 403 })
  }

  const url = new URL(request.url)
  const categoryParam = url.searchParams.get("category")
  const severityParam = url.searchParams.get("severity")
  const query = (url.searchParams.get("q") || "").trim().toLowerCase()
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 100, 1), 500)

  let entries: AuditEntry[] = MOCK_AUDIT_LOG

  if (categoryParam && CATEGORIES.includes(categoryParam as AuditCategory)) {
    entries = entries.filter((entry) => entry.category === categoryParam)
  }
  if (severityParam) {
    const severities = severityParam.split(",")
    entries = entries.filter((entry) => severities.includes(entry.severity))
  }
  if (query) {
    entries = entries.filter((entry) => {
      const haystack = [
        entry.summary,
        entry.action,
        entry.actor.name,
        entry.actor.email,
        entry.target?.label,
        entry.target?.id,
        entry.ipAddress,
      ].join(" ").toLowerCase()
      return haystack.includes(query)
    })
  }

  return NextResponse.json(
    { entries: entries.slice(0, limit), total: entries.length, mock: true },
    { headers: { "Cache-Control": "private, no-store" } },
  )
}

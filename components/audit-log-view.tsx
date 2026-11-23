"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"
import { formatDistanceToNow } from "date-fns"
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  Fingerprint,
  KeyRound,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Upload,
  UserCog,
  X,
  type LucideIcon,
} from "lucide-react"
import {
  AUDIT_ACTION_META,
  AUDIT_CATEGORY_LABELS,
  AUDIT_ACTOR_ROLES,
  type AuditActorRole,
  type AuditCategory,
  type AuditEntry,
  type AuditSeverity,
} from "@/lib/audit-log"

type AuditResponse = { entries: AuditEntry[]; total: number; mock: boolean }

const fetcher = async (url: string): Promise<AuditResponse> => {
  const response = await fetch(url)
  if (!response.ok) {
    if (response.status === 403) throw new Error("forbidden")
    throw new Error("The audit trail could not be loaded.")
  }
  return response.json()
}

/** Category → timeline icon. */
const CATEGORY_ICON: Record<AuditCategory, LucideIcon> = {
  access: KeyRound,
  submissions: Upload,
  judging: ShieldCheck,
  admin: UserCog,
}

/** Severity → badge + dot palette. Kept in one place so the timeline and
 *  detail panel can never drift apart. */
const SEVERITY_STYLES: Record<AuditSeverity, { label: string; badge: string; dot: string; ring: string }> = {
  info: { label: "Info", badge: "border-[#E7DED1] bg-[#FAF8F4] text-[#8C7B6A]", dot: "bg-[#8C7B6A]", ring: "ring-[#F3EEE6]" },
  notice: { label: "Notice", badge: "border-[#C9BFAE] bg-[#F3EEE6] text-[#5D4037]", dot: "bg-[#B85621]", ring: "ring-[#F3EEE6]" },
  warning: { label: "Warning", badge: "border-amber-200 bg-amber-50 text-amber-700", dot: "bg-amber-500", ring: "ring-amber-100" },
  critical: { label: "Critical", badge: "border-rose-200 bg-rose-50 text-rose-700", dot: "bg-rose-500", ring: "ring-rose-100" },
}

const CATEGORY_FILTERS: Array<{ value: AuditCategory | "all"; label: string }> = [
  { value: "all", label: "All activity" },
  { value: "access", label: "Access" },
  { value: "submissions", label: "Submissions" },
  { value: "judging", label: "Judging" },
  { value: "admin", label: "Administration" },
]

const ROLE_LABELS: Record<AuditActorRole, string> = {
  admin: "Administrator",
  judge: "Judge",
  submitter: "Applicant",
  system: "System",
}

function PageHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="mb-7">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#B85621]">{eyebrow}</p>
      <h1 className="text-2xl font-semibold tracking-[-0.03em] text-[#2A2118] sm:text-[28px]">{title}</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5D4037]">{description}</p>
    </div>
  )
}

function Metric({ label, value, note, icon: Icon, tone }: { label: string; value: string | number; note: string; icon: LucideIcon; tone?: "danger" }) {
  return (
    <div className="rounded-xl border border-[#E7DED1] bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-xs text-[#8C7B6A]">{label}</span>
        <Icon className={`size-4 ${tone === "danger" ? "text-rose-500/80" : "text-[#B85621]/70"}`} strokeWidth={1.8} aria-hidden="true" />
      </div>
      <p className={`text-2xl font-semibold tracking-tight ${tone === "danger" ? "text-rose-600" : "text-[#2A2118]"}`}>{value}</p>
      <p className="mt-1 text-[11px] text-[#8C7B6A]">{note}</p>
    </div>
  )
}

function Timestamp({ iso }: { iso: string }) {
  const date = new Date(iso)
  return (
    <time dateTime={iso} title={date.toLocaleString()} className="text-[10px] text-[#8C7B6A]">
      {formatDistanceToNow(date, { addSuffix: true })}
    </time>
  )
}

function ActorBadge({ role }: { role: AuditActorRole }) {
  const isSystem = role === "system"
  return (
    <span className={`rounded-md border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] ${
      isSystem ? "border-[#E7DED1] bg-[#FAF8F4] text-[#8C7B6A]" : role === "admin" ? "border-[#6E2C24]/20 bg-[#6E2C24]/[0.06] text-[#6E2C24]" : role === "judge" ? "border-[#0F9B8E]/25 bg-[#0F9B8E]/[0.08] text-[#0B7468]" : "border-[#C9BFAE] bg-[#F3EEE6] text-[#5D4037]"
    }`}>
      {ROLE_LABELS[role]}
    </span>
  )
}

/** One row in the timeline. Expands in place to reveal the full record. */
function AuditRow({ entry }: { entry: AuditEntry }) {
  const [open, setOpen] = useState(false)
  const severity = SEVERITY_STYLES[entry.severity]
  const Icon = CATEGORY_ICON[entry.category]
  const actionLabel = AUDIT_ACTION_META[entry.action]?.label ?? entry.action
  const hasDetail = Boolean(entry.changes?.length || entry.ipAddress || entry.userAgent || entry.target)

  return (
    <article className="border-b border-[#F3EEE6] last:border-0">
      <button
        type="button"
        onClick={() => hasDetail && setOpen((value) => !value)}
        aria-expanded={hasDetail ? open : undefined}
        className={`flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors ${hasDetail ? "hover:bg-[#FAF8F4]" : "cursor-default"}`}
      >
        <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-[#E7DED1] bg-[#FAF8F4] ring-4 ${severity.ring}`}>
          <Icon className="size-4 text-[#6E2C24]" strokeWidth={1.8} aria-hidden="true" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-xs font-semibold text-[#2A2118]">{actionLabel}</span>
            <span className={`rounded-md border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] ${severity.badge}`}>{severity.label}</span>
            <ActorBadge role={entry.actor.role} />
            <Timestamp iso={entry.createdAt} />
          </span>
          <span className="mt-1 block text-xs leading-5 text-[#5D4037]">{entry.summary}</span>
          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-[#8C7B6A]">
            <span className="truncate">{entry.actor.name}</span>
            <span aria-hidden="true">·</span>
            <span className="truncate">{entry.actor.email}</span>
            {entry.target && (<><span aria-hidden="true">·</span><span className="truncate font-mono">{entry.target.type}/{entry.target.id}</span></>)}
          </span>
        </span>

        {hasDetail && <ChevronDown className={`mt-1.5 size-3.5 shrink-0 text-[#8C7B6A] transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />}
      </button>

      {open && (
        <div className="border-t border-[#F3EEE6] bg-[#FCFAF7] px-4 py-3 pl-[60px]">
          <dl className="grid gap-x-6 gap-y-2 text-[11px] sm:grid-cols-2">
            {entry.target && (
              <div className="min-w-0">
                <dt className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#8C7B6A]">Target</dt>
                <dd className="mt-0.5 truncate text-[#2A2118]">{entry.target.label}</dd>
              </div>
            )}
            <div className="min-w-0">
              <dt className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#8C7B6A]">Recorded</dt>
              <dd className="mt-0.5 text-[#2A2118]">{new Date(entry.createdAt).toLocaleString()}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#8C7B6A]">Source</dt>
              <dd className="mt-0.5 font-mono text-[#2A2118]">{entry.source}</dd>
            </div>
            {entry.ipAddress && (
              <div className="min-w-0">
                <dt className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#8C7B6A]">IP address</dt>
                <dd className="mt-0.5 font-mono text-[#2A2118]">{entry.ipAddress}</dd>
              </div>
            )}
            {entry.userAgent && (
              <div className="min-w-0 sm:col-span-2">
                <dt className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#8C7B6A]">User agent</dt>
                <dd className="mt-0.5 break-words text-[#5D4037]">{entry.userAgent}</dd>
              </div>
            )}
          </dl>

          {entry.changes?.length ? (
            <div className="mt-3 space-y-1.5">
              <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#8C7B6A]">Changes</p>
              {entry.changes.map((change) => (
                <div key={`${change.field}-${change.from}-${change.to}`} className="flex flex-wrap items-center gap-1.5 font-mono text-[10px]">
                  <span className="text-[#5D4037]">{change.field}</span>
                  <span className="rounded bg-rose-50 px-1.5 py-0.5 text-rose-700 line-through">{change.from}</span>
                  <ArrowRight className="size-3 text-[#8C7B6A]" aria-hidden="true" />
                  <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700">{change.to}</span>
                </div>
              ))}
            </div>
          ) : null}

          <p className="mt-3 font-mono text-[9px] text-[#B5A895]">{entry.id}</p>
        </div>
      )}
    </article>
  )
}

type SeverityFilter = AuditSeverity | "all"

export function AuditLogView() {
  const [category, setCategory] = useState<AuditCategory | "all">("all")
  const [severity, setSeverity] = useState<SeverityFilter>("all")
  const [roleFilter, setRoleFilter] = useState<AuditActorRole | "all">("all")
  const [query, setQuery] = useState("")

  // Server-side filtering (category + text) keeps the shape identical once this
  // reads a real table; the extra client-side filters are instant/derived.
  const url = useMemo(() => {
    const params = new URLSearchParams({ limit: "200" })
    if (category !== "all") params.set("category", category)
    if (query.trim()) params.set("q", query.trim())
    return `/api/audit-log?${params.toString()}`
  }, [category, query])

  const { data, error, isLoading, mutate, isValidating } = useSWR<AuditResponse>(url, fetcher, {
    keepPreviousData: true,
    revalidateOnFocus: false,
  })

  const entries = useMemo(() => data?.entries ?? [], [data])

  const filtered = useMemo(() => entries.filter((entry) => {
    if (severity !== "all" && entry.severity !== severity) return false
    if (roleFilter !== "all" && entry.actor.role !== roleFilter) return false
    return true
  }), [entries, severity, roleFilter])

  const stats = useMemo(() => {
    const critical = entries.filter((entry) => entry.severity === "critical" || entry.severity === "warning").length
    const actors = new Set(entries.map((entry) => entry.actor.id))
    return {
      total: data?.total ?? entries.length,
      alerts: critical,
      actors: actors.has("unknown") ? actors.size - 1 : actors.size,
      latest: entries[0]?.createdAt,
    }
  }, [entries, data])

  const isForbidden = error instanceof Error && error.message === "forbidden"
  const hasActiveFilters = category !== "all" || severity !== "all" || roleFilter !== "all" || query.trim().length > 0

  const resetFilters = () => {
    setCategory("all")
    setSeverity("all")
    setRoleFilter("all")
    setQuery("")
  }

  return (
    <section aria-labelledby="audit-heading">
      <PageHeading
        eyebrow="Governance"
        title="Audit trail"
        description="An append-only record of sign-ins, submissions, scoring, and role changes across the workspace. Administrators use it to answer “who did what, and when?” during review disputes."
      />

      {isForbidden ? (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-rose-600" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-rose-800">The audit trail is restricted to administrators</p>
              <p className="mt-1 text-xs leading-5 text-rose-700">It exposes judge activity, applicant identities, and failed sign-in attempts with IP addresses. Ask an administrator if you need an export.</p>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Events recorded" value={stats.total} note="Most recent activity first" icon={Activity} />
            <Metric label="Warnings & critical" value={stats.alerts} note="Failed sign-ins and denials" icon={AlertTriangle} tone={stats.alerts > 0 ? "danger" : undefined} />
            <Metric label="Distinct actors" value={stats.actors} note="Accounts that triggered an event" icon={Fingerprint} />
            <Metric label="Latest event" value={stats.latest ? formatDistanceToNow(new Date(stats.latest), { addSuffix: false }) : "—"} note={stats.latest ? "ago · live tail" : "No events yet"} icon={RefreshCw} />
          </div>

          <div className="mb-4 flex flex-col gap-3 rounded-xl border border-[#E7DED1] bg-white p-3 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[#8C7B6A]" aria-hidden="true" />
                <label htmlFor="audit-search" className="sr-only">Search the audit trail</label>
                <input
                  id="audit-search"
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search actor, email, project, IP…"
                  className="h-9 w-full rounded-lg border border-[#E7DED1] bg-[#FAF8F4] pl-8 pr-8 text-xs text-[#2A2118] outline-none transition-colors placeholder:text-[#B5A895] focus:border-[#C9961E] focus:bg-white"
                />
                {query && (
                  <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-[#8C7B6A] hover:bg-[#F3EEE6] hover:text-[#2A2118]">
                    <X className="size-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="audit-role" className="sr-only">Filter by actor role</label>
                <select
                  id="audit-role"
                  value={roleFilter}
                  onChange={(event) => setRoleFilter(event.target.value as AuditActorRole | "all")}
                  className="h-9 rounded-lg border border-[#E7DED1] bg-white px-2 text-[11px] text-[#2A2118] outline-none focus:border-[#C9961E]"
                >
                  <option value="all">All roles</option>
                  {AUDIT_ACTOR_ROLES.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
                </select>
                <label htmlFor="audit-severity" className="sr-only">Filter by severity</label>
                <select
                  id="audit-severity"
                  value={severity}
                  onChange={(event) => setSeverity(event.target.value as SeverityFilter)}
                  className="h-9 rounded-lg border border-[#E7DED1] bg-white px-2 text-[11px] text-[#2A2118] outline-none focus:border-[#C9961E]"
                >
                  <option value="all">Any severity</option>
                  <option value="info">Info</option>
                  <option value="notice">Notice</option>
                  <option value="warning">Warning</option>
                  <option value="critical">Critical</option>
                </select>
                <button
                  type="button"
                  onClick={() => void mutate()}
                  disabled={isValidating}
                  aria-label="Refresh audit trail"
                  className="flex size-9 items-center justify-center rounded-lg border border-[#E7DED1] bg-white text-[#6E2C24] transition-colors hover:bg-[#F3EEE6] disabled:opacity-50"
                >
                  <RefreshCw className={`size-3.5 ${isValidating ? "animate-spin" : ""}`} aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by category">
              {CATEGORY_FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  aria-pressed={category === filter.value}
                  onClick={() => setCategory(filter.value)}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    category === filter.value
                      ? "bg-[#6E2C24] text-white"
                      : "border border-[#E7DED1] bg-white text-[#5D4037] hover:bg-[#F3EEE6]"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
              {hasActiveFilters && (
                <button type="button" onClick={resetFilters} className="ml-auto text-[11px] font-medium text-[#B85621] hover:underline">
                  Reset filters
                </button>
              )}
            </div>
          </div>

          {error && !isForbidden && (
            <p role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              The audit trail could not be loaded. Refresh to retry.
            </p>
          )}

          <div className="overflow-hidden rounded-xl border border-[#E7DED1] bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-[#E7DED1] px-4 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8C7B6A]">
                {filtered.length} event{filtered.length === 1 ? "" : "s"}
                {hasActiveFilters ? " matching" : ""}
              </p>
              {data?.mock && <span className="rounded-md border border-[#E0B33A]/30 bg-[#E0B33A]/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-[#8A6D12]">Sample data</span>}
            </div>

            {isLoading && !data ? (
              <div className="space-y-3 p-4" aria-hidden="true">
                {[0, 1, 2, 3, 4].map((row) => (
                  <div key={row} className="flex items-start gap-3">
                    <div className="size-8 animate-pulse rounded-lg bg-[#F3EEE6]" />
                    <div className="flex-1 space-y-2">
                      <div className="h-2.5 w-40 animate-pulse rounded bg-[#F3EEE6]" />
                      <div className="h-2 w-full max-w-md animate-pulse rounded bg-[#F3EEE6]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filtered.length ? (
              <div>{filtered.map((entry) => <AuditRow key={entry.id} entry={entry} />)}</div>
            ) : (
              <div className="px-5 py-12 text-center">
                <Activity className="mx-auto mb-3 size-5 text-[#8C7B6A]" aria-hidden="true" />
                <p className="text-sm font-medium text-[#2A2118]">{hasActiveFilters ? "No events match these filters" : "No recorded activity yet"}</p>
                <p className="mt-1 text-xs text-[#8C7B6A]">{hasActiveFilters ? "Try a different category, severity, or search term." : "Sign-ins, submissions, and role changes will appear here."}</p>
                {hasActiveFilters && <button type="button" onClick={resetFilters} className="mt-3 text-[11px] font-medium text-[#B85621] hover:underline">Reset filters</button>}
              </div>
            )}
          </div>

          <p className="mt-5 max-w-3xl text-[10px] leading-4 text-[#8C7B6A]">
            Entries are append-only: nothing in this interface edits or deletes history. This screen is currently showing sample data — the audit log table has not been provisioned yet, so no real event has been recorded.
          </p>
        </>
      )}
    </section>
  )
}

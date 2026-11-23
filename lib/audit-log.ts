import type { AppRole } from "@/lib/supabase/auth-context"

/**
 * MOCK DATA ONLY.
 *
 * There is no `audit_log` table yet, so this module fabricates a deterministic
 * trail of administrative actions. When the real table lands, swap `MOCK_AUDIT_LOG`
 * for a `supabase.from("audit_log").select(...)` read in
 * `app/api/audit-log/route.ts` — the shapes below are the contract the UI consumes,
 * so `AuditLogView` needs no changes.
 */

/** What an entry records. Grouped by domain so the UI can filter by category. */
export type AuditActionType =
  | "auth.login"
  | "auth.login_failed"
  | "auth.signup"
  | "auth.password_reset"
  | "project.submitted"
  | "project.deleted"
  | "project.stage_changed"
  | "judging.evaluation_saved"
  | "admin.role_granted"
  | "admin.role_revoked"
  | "admin.access_denied"

export type AuditCategory = "access" | "submissions" | "judging" | "admin"

export type AuditSeverity = "info" | "notice" | "warning" | "critical"

export type AuditActorRole = AppRole | "system"

export type AuditEntry = {
  id: string
  /** ISO timestamp of when the action happened. */
  createdAt: string
  action: AuditActionType
  category: AuditCategory
  severity: AuditSeverity
  actor: {
    id: string
    name: string
    email: string
    role: AuditActorRole
  }
  /** The entity acted upon, e.g. a project or user. Absent for pure auth events. */
  target?: {
    type: "project" | "user" | "session" | "system"
    id: string
    label: string
  }
  /** Human-readable sentence shown in the timeline. */
  summary: string
  /** Optional before/after detail for changed fields (stage moves, roles). */
  changes?: Array<{ field: string; from: string; to: string }>
  /** Request origin, when known. */
  ipAddress?: string
  userAgent?: string
  /** Where the event was recorded. */
  source: "web" | "api" | "system"
}

/** Metadata for rendering an action in the UI: label, icon color, category. */
export const AUDIT_ACTION_META: Record<AuditActionType, { label: string; category: AuditCategory }> = {
  "auth.login": { label: "Signed in", category: "access" },
  "auth.login_failed": { label: "Failed sign-in", category: "access" },
  "auth.signup": { label: "Account created", category: "access" },
  "auth.password_reset": { label: "Password reset", category: "access" },
  "project.submitted": { label: "Project submitted", category: "submissions" },
  "project.deleted": { label: "Project deleted", category: "submissions" },
  "project.stage_changed": { label: "Stage changed", category: "submissions" },
  "judging.evaluation_saved": { label: "Evaluation saved", category: "judging" },
  "admin.role_granted": { label: "Role granted", category: "admin" },
  "admin.role_revoked": { label: "Role revoked", category: "admin" },
  "admin.access_denied": { label: "Access denied", category: "admin" },
}

export const AUDIT_CATEGORY_LABELS: Record<AuditCategory, string> = {
  access: "Access",
  submissions: "Submissions",
  judging: "Judging",
  admin: "Administration",
}

/** Ordered list of roles for filtering; "system" covers automated events. */
export const AUDIT_ACTOR_ROLES: AuditActorRole[] = ["admin", "judge", "submitter", "system"]

/**
 * Fixed reference point so the mock trail reads identically on every render
 * (no `Date.now()` in module scope — that would drift server vs. client and
 * break hydration). Entries are timestamped relative to this instant.
 */
const NOW = Date.parse("2026-05-14T16:42:00.000Z")

/** Build an ISO timestamp `minutesAgo` minutes before the fixed reference time. */
function at(minutesAgo: number) {
  return new Date(NOW - minutesAgo * 60_000).toISOString()
}

const AMARA = { id: "u_admin_01", name: "Amara Okafor", email: "admin@cedahack.com", role: "admin" as const }
const DESMOND = { id: "u_admin_02", name: "Desmond Ferreira", email: "desmond@cedahack.com", role: "admin" as const }
const LIN = { id: "u_judge_01", name: "Lin Zhao", email: "judge@cedahack.com", role: "judge" as const }
const PRIYA = { id: "u_judge_02", name: "Priya Raman", email: "priya.raman@cedahack.com", role: "judge" as const }
const SIPHO = { id: "u_sub_01", name: "Sipho Ndlovu", email: "hacker@cedahack.com", role: "submitter" as const }
const MAYA = { id: "u_sub_02", name: "Maya Santoro", email: "maya.santoro@example.com", role: "submitter" as const }
const SYSTEM = { id: "system", name: "CEDA system", email: "system@cedahack.com", role: "system" as const }

const AGENT_IPS = ["102.132.44.18", "41.13.201.77", "196.24.8.140", "154.68.212.9", "45.221.66.31"]
const AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/125.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) Firefox/126.0",
]

/**
 * The fabricated trail, newest first. Deliberately includes a failed sign-in
 * burst and an access-denied event so the admin surface has something worth
 * investigating, not just a happy-path list.
 */
export const MOCK_AUDIT_LOG: AuditEntry[] = [
  {
    id: "aud_1041", createdAt: at(3), action: "project.stage_changed", category: "submissions", severity: "notice",
    actor: AMARA, target: { type: "project", id: "proj_eco_trace", label: "EcoTrace — supply chain carbon ledger" },
    summary: "Amara Okafor moved “EcoTrace” from Review to Feedback.",
    changes: [{ field: "status", from: "review", to: "feedback" }],
    ipAddress: AGENT_IPS[0], userAgent: AGENTS[0], source: "web",
  },
  {
    id: "aud_1040", createdAt: at(14), action: "judging.evaluation_saved", category: "judging", severity: "info",
    actor: LIN, target: { type: "project", id: "proj_medisync", label: "MediSync — offline clinic triage" },
    summary: "Lin Zhao saved an evaluation for “MediSync” with a weighted score of 4.3.",
    ipAddress: AGENT_IPS[2], userAgent: AGENTS[2], source: "web",
  },
  {
    id: "aud_1039", createdAt: at(26), action: "admin.access_denied", category: "admin", severity: "critical",
    actor: MAYA, target: { type: "user", id: "u_sub_02", label: "Maya Santoro" },
    summary: "Maya Santoro attempted to load the judge management API and was refused (insufficient role).",
    ipAddress: AGENT_IPS[3], userAgent: AGENTS[1], source: "api",
  },
  {
    id: "aud_1038", createdAt: at(31), action: "auth.login_failed", category: "access", severity: "warning",
    actor: { id: "unknown", name: "Unknown", email: "admin@cedahack.co", role: "system" },
    summary: "Failed sign-in for a near-miss admin address (admin@cedahack.co).",
    ipAddress: AGENT_IPS[4], userAgent: AGENTS[1], source: "web",
  },
  {
    id: "aud_1037", createdAt: at(33), action: "auth.login_failed", category: "access", severity: "warning",
    actor: { id: "unknown", name: "Unknown", email: "admin@cedahack.co", role: "system" },
    summary: "Repeated failed sign-in from the same address — second attempt in two minutes.",
    ipAddress: AGENT_IPS[4], userAgent: AGENTS[1], source: "web",
  },
  {
    id: "aud_1036", createdAt: at(51), action: "admin.role_granted", category: "admin", severity: "notice",
    actor: DESMOND, target: { type: "user", id: "u_judge_02", label: "Priya Raman" },
    summary: "Desmond Ferreira promoted Priya Raman from Submitter to Judge.",
    changes: [{ field: "role", from: "submitter", to: "judge" }],
    ipAddress: AGENT_IPS[1], userAgent: AGENTS[1], source: "web",
  },
  {
    id: "aud_1035", createdAt: at(68), action: "project.submitted", category: "submissions", severity: "info",
    actor: SIPHO, target: { type: "project", id: "proj_medisync", label: "MediSync — offline clinic triage" },
    summary: "Sipho Ndlovu submitted a new project archive (147 files, 8.2 MB).",
    ipAddress: AGENT_IPS[2], userAgent: AGENTS[2], source: "web",
  },
  {
    id: "aud_1034", createdAt: at(84), action: "judging.evaluation_saved", category: "judging", severity: "info",
    actor: PRIYA, target: { type: "project", id: "proj_eco_trace", label: "EcoTrace — supply chain carbon ledger" },
    summary: "Priya Raman revised an evaluation for “EcoTrace” — weighted score moved 3.9 → 4.4.",
    changes: [{ field: "weighted_score", from: "3.90", to: "4.40" }],
    ipAddress: AGENT_IPS[1], userAgent: AGENTS[1], source: "web",
  },
  {
    id: "aud_1033", createdAt: at(96), action: "auth.signup", category: "access", severity: "info",
    actor: MAYA, target: { type: "user", id: "u_sub_02", label: "Maya Santoro" },
    summary: "Maya Santoro created an account (default role: Submitter).",
    ipAddress: AGENT_IPS[3], userAgent: AGENTS[1], source: "web",
  },
  {
    id: "aud_1032", createdAt: at(112), action: "auth.password_reset", category: "access", severity: "notice",
    actor: LIN, target: { type: "session", id: "sess_lin_01", label: "Recovery flow" },
    summary: "Lin Zhao completed a password reset via email link.",
    ipAddress: AGENT_IPS[2], userAgent: AGENTS[2], source: "web",
  },
  {
    id: "aud_1031", createdAt: at(140), action: "project.stage_changed", category: "submissions", severity: "notice",
    actor: DESMOND, target: { type: "project", id: "proj_rural_pay", label: "RuralPay — offline mobile wallet" },
    summary: "Desmond Ferreira moved “RuralPay” from Review to Approved.",
    changes: [{ field: "status", from: "review", to: "approved" }],
    ipAddress: AGENT_IPS[1], userAgent: AGENTS[1], source: "web",
  },
  {
    id: "aud_1030", createdAt: at(173), action: "project.deleted", category: "submissions", severity: "warning",
    actor: AMARA, target: { type: "project", id: "proj_test_upload", label: "Untitled test upload" },
    summary: "Amara Okafor deleted “Untitled test upload” and its R2 objects.",
    ipAddress: AGENT_IPS[0], userAgent: AGENTS[0], source: "web",
  },
  {
    id: "aud_1029", createdAt: at(196), action: "admin.role_revoked", category: "admin", severity: "notice",
    actor: AMARA, target: { type: "user", id: "u_judge_03", label: "Neil Adeyemi" },
    summary: "Amara Okafor revoked judge access from Neil Adeyemi.",
    changes: [{ field: "role", from: "judge", to: "submitter" }],
    ipAddress: AGENT_IPS[0], userAgent: AGENTS[0], source: "web",
  },
  {
    id: "aud_1028", createdAt: at(238), action: "auth.login", category: "access", severity: "info",
    actor: AMARA, target: { type: "session", id: "sess_admin_01", label: "Email + password" },
    summary: "Amara Okafor signed in.",
    ipAddress: AGENT_IPS[0], userAgent: AGENTS[0], source: "web",
  },
  {
    id: "aud_1027", createdAt: at(300), action: "project.submitted", category: "submissions", severity: "info",
    actor: MAYA, target: { type: "project", id: "proj_eco_trace", label: "EcoTrace — supply chain carbon ledger" },
    summary: "Maya Santoro submitted a new project archive (96 files, 5.7 MB).",
    ipAddress: AGENT_IPS[3], userAgent: AGENTS[1], source: "web",
  },
  {
    id: "aud_1026", createdAt: at(412), action: "auth.login", category: "access", severity: "info",
    actor: LIN, target: { type: "session", id: "sess_judge_01", label: "Email + password" },
    summary: "Lin Zhao signed in.",
    ipAddress: AGENT_IPS[2], userAgent: AGENTS[2], source: "web",
  },
  {
    id: "aud_1025", createdAt: at(520), action: "project.stage_changed", category: "submissions", severity: "notice",
    actor: SYSTEM, target: { type: "system", id: "scheduler", label: "Review deadline job" },
    summary: "System closed the review window and moved 3 submissions to Feedback.",
    changes: [{ field: "status", from: "review", to: "feedback" }],
    source: "system",
  },
  {
    id: "aud_1024", createdAt: at(640), action: "auth.signup", category: "access", severity: "info",
    actor: SIPHO, target: { type: "user", id: "u_sub_01", label: "Sipho Ndlovu" },
    summary: "Sipho Ndlovu created an account (default role: Submitter).",
    ipAddress: AGENT_IPS[2], userAgent: AGENTS[2], source: "web",
  },
]

import type { AppRole } from "@/lib/supabase/auth-context"

/**
 * Single source of truth for what each role may see and do. Mirrored on the
 * server (`canOwnProject`, API route guards) and in the UI (sidebar navigation,
 * dashboard actions, repository tabs) so an applicant never lands on the
 * reviewer surfaces by URL or by stale state.
 */
export type DashboardView = "projects" | "reports" | "security" | "storage" | "judges"

export type ViewerRole = AppRole | null | undefined

/** Applicants can create submissions; judges never can. */
export function canSubmitProject(role: ViewerRole) {
  return role === "submitter" || role === "admin"
}

export function isReviewer(role: ViewerRole) {
  return role === "judge" || role === "admin"
}

export function isAdmin(role: ViewerRole) {
  return role === "admin"
}

export { isAdmin as canManageJudges }

/**
 * Judges score submissions. Applicants never see or write evaluations, and
 * admins oversee the workflow rather than scoring, so only judges qualify.
 */
export function canEvaluateProject(role: ViewerRole) {
  return role === "judge"
}

/**
 * The Judging surface (rubric form, panel consensus, per-judge cards) is for
 * judges and admins only. Applicants must never render it — not even disabled —
 * because the rubric itself is confidential to the review panel.
 */
export function canAccessJudging(role: ViewerRole) {
  return isReviewer(role)
}

/** Admins move submissions through the workflow stages. */
export function canUpdateProjectStage(role: ViewerRole) {
  return role === "admin"
}

/** Owners (applicants) and admins may edit or remove a submission. */
export function canManageProject(role: ViewerRole, userId: string | null | undefined, ownerId: string | null | undefined) {
  if (!role) return false
  if (role === "admin") return true
  if (role === "judge") return false
  return Boolean(userId && ownerId && userId === ownerId)
}

/**
 * Project-detail access: an applicant may only open their own submissions,
 * reviewers open any submission, admins open everything.
 */
export function canViewProject(role: ViewerRole, userId: string | null | undefined, ownerId: string | null | undefined) {
  if (!role) return false
  if (role === "judge" || role === "admin") return true
  return Boolean(userId && ownerId && userId === ownerId)
}

/** Views each role may open. Applicants get an applicant-only dashboard. */
export function viewsForRole(role: ViewerRole): DashboardView[] {
  if (role === "admin") return ["projects", "reports", "security", "storage", "judges"]
  if (role === "judge") return ["projects", "reports", "security"]
  return ["projects", "reports"]
}

export function canOpenView(role: ViewerRole, view: DashboardView) {
  return viewsForRole(role).includes(view)
}

/** The view a role should land on when the requested one is not permitted. */
export function defaultViewForRole(role: ViewerRole): DashboardView {
  void role
  return "projects"
}

/** Judges and admins see the review panel and per-judge evaluations. */
export function canSeePanelScores(role: ViewerRole) {
  return isReviewer(role)
}

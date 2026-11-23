import { NextResponse } from "next/server"
import { requireProjectAccess } from "@/lib/supabase/project-access"
import { canAccessJudging, canEvaluateProject, canSeePanelScores } from "@/lib/permissions"

export const dynamic = "force-dynamic"

const CRITERIA = [
  "general_access",
  "functionality",
  "user_experience",
  "technical_requirements",
  "innovation_creativity",
  "presentation",
] as const

const DECISIONS = ["undecided", "advance", "revise", "reject"] as const

/**
 * Judges and admins see the full review panel. An applicant only ever sees
 * their own submission's aggregated outcome — no per-judge scores, no judge
 * names, no internal feedback — so the review panel stays confidential.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const access = await requireProjectAccess(id)
  if (!access.ok) return access.response
  const { supabase, user, profile, row } = access

  const { data: evaluations, error } = await supabase
    .from("evaluations")
    .select("id, project_id, judge_id, general_access, functionality, user_experience, technical_requirements, innovation_creativity, presentation, feedback, decision, weighted_score, updated_at")
    .eq("project_id", id)
    .order("updated_at", { ascending: false })
  if (error) return NextResponse.json({ error: "Evaluations could not be loaded." }, { status: 503 })

  if (!canSeePanelScores(profile.role)) {
    // Applicant view: aggregate only, and only for their own project.
    if (row.owner_id !== user.id) return NextResponse.json({ error: "Evaluations could not be loaded." }, { status: 403 })
    const count = evaluations?.length ?? 0
    const average = count ? (evaluations || []).reduce((sum, evaluation) => sum + Number(evaluation.weighted_score), 0) / count : null
    return NextResponse.json({
      aggregate: { evaluationCount: count, averageWeightedScore: average === null ? null : Number(average.toFixed(1)) },
      evaluations: [],
    }, { headers: { "Cache-Control": "private, no-store" } })
  }

  const judgeIds = [...new Set((evaluations || []).map((evaluation) => evaluation.judge_id))]
  const profileNames = new Map<string, string>()
  const { data: judges } = judgeIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", judgeIds)
    : { data: [] }
  for (const judge of judges || []) profileNames.set(judge.id, judge.display_name)

  return NextResponse.json((evaluations || []).map((evaluation) => ({
    ...evaluation,
    judge_name: evaluation.judge_id === user.id ? profile.display_name : profileNames.get(evaluation.judge_id) || "Evaluator",
  })), { headers: { "Cache-Control": "private, no-store" } })
}

/** Clamp a submitted score to the 0–5 rubric range, rejecting non-numbers. */
function readScore(value: unknown) {
  const score = Number(value)
  if (!Number.isFinite(score)) return null
  return Math.min(5, Math.max(0, Math.round(score * 2) / 2))
}

/**
 * Scoring is a judge-only write. It is deliberately a server route rather than
 * a browser-side Supabase upsert so an applicant cannot score a project by
 * replaying the request against the database directly — the role check runs
 * here, with the service-scoped server client, not in the UI.
 */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const access = await requireProjectAccess(id)
  if (!access.ok) return access.response
  const { supabase, user, profile } = access

  // Applicants (and any non-judge) are refused outright, regardless of payload.
  if (!canAccessJudging(profile.role)) {
    return NextResponse.json({ error: "Scoring is restricted to the review panel." }, { status: 403 })
  }
  if (!canEvaluateProject(profile.role) && profile.role !== "admin") {
    return NextResponse.json({ error: "Scoring is restricted to the review panel." }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Evaluation payload could not be read." }, { status: 400 })
  }

  const scores: Record<string, number> = {}
  for (const criterion of CRITERIA) {
    const score = readScore(body[criterion])
    if (score === null) return NextResponse.json({ error: `Invalid score for ${criterion}.` }, { status: 400 })
    scores[criterion] = score
  }

  const decision = String(body.decision ?? "undecided")
  if (!DECISIONS.includes(decision as (typeof DECISIONS)[number])) {
    return NextResponse.json({ error: "Invalid recommendation." }, { status: 400 })
  }

  const feedback = String(body.feedback ?? "").slice(0, 4000)

  // Weighted score mirrors the rubric weights shown in the UI.
  const weighted = (
    scores.general_access * 15 +
    scores.functionality * 20 +
    scores.user_experience * 15 +
    scores.technical_requirements * 25 +
    scores.innovation_creativity * 10 +
    scores.presentation * 15
  ) / 5

  const { error } = await supabase.from("evaluations").upsert({
    project_id: id,
    judge_id: user.id,
    ...scores,
    feedback,
    decision,
    weighted_score: Number(weighted.toFixed(2)),
  }, { onConflict: "project_id,judge_id" })

  if (error) return NextResponse.json({ error: "Your evaluation could not be saved." }, { status: 503 })
  return NextResponse.json({ ok: true, weightedScore: Number(weighted.toFixed(2)) })
}

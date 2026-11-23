"use client"

import { useEffect, useMemo, useState, type FormEvent } from "react"
import Link from "next/link"
import useSWR from "swr"
import { ArrowLeft, ChevronRight, Code2, File, FileText, GitBranch, LockKeyhole, Users } from "lucide-react"
import { toast } from "sonner"
import type { Project } from "@/lib/data"
import { createClient } from "@/lib/supabase/client"
import { codeTokens } from "@/components/project-folder/project-preview"
import type { AppRole } from "@/lib/supabase/auth-context"
import { canAccessJudging, canEvaluateProject } from "@/lib/permissions"

type ProjectResponse = { project: Project; currentUserId: string; currentUserRole: AppRole; isOwner?: boolean }
type UserSummary = { id: string; email: string | null; displayName: string; role: AppRole }
type RepositoryFile = { path: string; size: number; kind: "text" | "image" | "binary" }
type RepositoryResponse = { files: RepositoryFile[]; selected: null | { path: string; size: number; kind: "text" | "image" | "binary"; content: string | null; truncated: boolean } }
type Evaluation = {
  id: string
  project_id: string
  judge_id: string
  judge_name: string
  general_access: number
  functionality: number
  user_experience: number
  technical_requirements: number
  innovation_creativity: number
  presentation: number
  feedback: string
  decision: "undecided" | "advance" | "revise" | "reject"
  weighted_score: number
  updated_at: string
}
type Criterion = "general_access" | "functionality" | "user_experience" | "technical_requirements" | "innovation_creativity" | "presentation"

const criteria: Array<{ key: Criterion; label: string; weight: number; description: string }> = [
  { key: "general_access", label: "Essential access & hosting", weight: 15, description: "Browser access, registration, authentication, recovery, hosting, availability." },
  { key: "functionality", label: "Functionality", weight: 20, description: "Submission, collaborative evaluation, feedback, reporting, and notifications." },
  { key: "user_experience", label: "User experience & design", weight: 15, description: "Clarity, accessibility, navigation, labels, and visual quality." },
  { key: "technical_requirements", label: "Technical requirements", weight: 25, description: "Access control, performance, auditability, security, compatibility, scalability." },
  { key: "innovation_creativity", label: "Innovation & creativity", weight: 10, description: "Additional useful capabilities beyond the baseline requirements." },
  { key: "presentation", label: "Presentation & documentation", weight: 15, description: "Demo clarity, technical documentation, and communication." },
]

const jsonFetcher = async <T,>(url: string): Promise<T> => {
  const response = await fetch(url)
  if (!response.ok) throw new Error("Project data could not be loaded.")
  return response.json()
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function FileTree({ files, selectedPath, onSelect }: { files: RepositoryFile[]; selectedPath: string | null; onSelect: (path: string) => void }) {
  const [filter, setFilter] = useState("")
  const filtered = useMemo(() => files.filter((file) => file.path.toLowerCase().includes(filter.toLowerCase())), [files, filter])
  return (
    <aside className="flex min-h-[360px] flex-col border-b border-[#E7DED1] bg-[#FAF8F4] md:w-[270px] md:shrink-0 md:border-b-0 md:border-r">
      <div className="border-b border-[#E7DED1] px-3 py-3">
        <label htmlFor="repository-file-filter" className="sr-only">Filter files</label>
        <input id="repository-file-filter" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Go to file" className="h-8 w-full rounded-md border border-[#E7DED1] bg-white px-2.5 text-xs text-[#2A2118] outline-none placeholder:text-[#B8A99A] focus:border-[#C9961E]" />
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {filtered.map((file) => {
          const depth = Math.max(0, file.path.split("/").length - 1)
          const Icon = file.kind === "text" ? FileText : File
          return (
            <button key={file.path} type="button" onClick={() => onSelect(file.path)} aria-current={selectedPath === file.path ? "page" : undefined} title={file.path} className={`flex w-full items-center gap-2 rounded-md py-1.5 pr-2 text-left text-[11px] transition-colors ${selectedPath === file.path ? "bg-[#C9961E]/10 text-[#6E2C24]" : "text-[#5D4037] hover:bg-[#F3EEE6] hover:text-[#2A2118]"}`} style={{ paddingLeft: 8 + Math.min(depth, 5) * 12 }}>
              <Icon className="size-3.5 shrink-0 text-[#8C7B6A]" aria-hidden="true" />
              <span className="truncate">{file.path.split("/").pop()}</span>
            </button>
          )
        })}
        {!filtered.length && <p className="px-2 py-4 text-center text-[11px] text-[#8C7B6A]">No matching files</p>}
      </div>
      <div className="border-t border-[#E7DED1] px-3 py-2 text-[10px] text-[#8C7B6A]">{files.length.toLocaleString()} files</div>
    </aside>
  )
}

function RepositoryFiles({ projectId }: { projectId: string }) {
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const repositoryKey = `/api/projects/${encodeURIComponent(projectId)}/repository`
  const { data: repository, error: repositoryError } = useSWR<RepositoryResponse>(repositoryKey, jsonFetcher)

  useEffect(() => {
    if (!selectedPath && repository?.files.length) {
      setSelectedPath(repository.files.find((file) => file.path.toLowerCase() === "readme.md")?.path || repository.files[0].path)
    }
  }, [repository, selectedPath])

  const selectedKey = selectedPath ? `${repositoryKey}?path=${encodeURIComponent(selectedPath)}` : null
  const { data: selectedFile, isLoading: isFileLoading, error: fileError } = useSWR<RepositoryResponse>(selectedKey, jsonFetcher)

  return (
    <section className="overflow-hidden rounded-xl border border-[#E7DED1] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E7DED1] px-4 py-3">
        <div className="flex min-w-0 items-center gap-1.5 text-xs">
          <Link href="/" className="text-[#6E2C24] hover:text-[#8A3B2A]">Projects</Link><ChevronRight className="size-3 text-[#C9BFAE]" aria-hidden="true" />
          <span className="truncate font-semibold text-[#2A2118]">{selectedPath || "Repository"}</span>
        </div>
      </div>

      <div className="flex flex-col md:flex-row">
          {repositoryError ? <div role="alert" className="p-5 text-sm text-rose-600">Repository files are unavailable for this account.</div> : repository ? <FileTree files={repository.files} selectedPath={selectedPath} onSelect={setSelectedPath} /> : <div className="min-h-[360px] w-full animate-pulse bg-[#F3EEE6]" />}
          <div className="min-w-0 flex-1 bg-white">
            <div className="flex h-10 items-center justify-between border-b border-[#E7DED1] px-4 text-[11px] text-[#8C7B6A]">
              <span className="truncate font-mono">{selectedPath || "Select a file"}</span>
              {selectedFile?.selected && <span className="ml-3 shrink-0">{formatFileSize(selectedFile.selected.size)}</span>}
            </div>
            {fileError ? <div role="alert" className="p-5 text-sm text-rose-600">This file could not be opened.</div> : isFileLoading || !selectedFile ? <div className="min-h-[360px] animate-pulse bg-[#F3EEE6]" /> : selectedFile.selected?.kind !== "text" ? (
              <div className="flex min-h-[360px] flex-col items-center justify-center gap-2 text-center text-[#8C7B6A]"><File className="size-6" aria-hidden="true" /><p className="text-sm">Binary file</p><p className="text-xs">This file is available in the private archive, but is not rendered as text.</p></div>
            ) : (
              <div className="max-h-[620px] overflow-auto py-3 font-mono text-[11px] leading-[1.7]">
                <pre className="grid min-w-max grid-cols-[44px_1fr] pr-5 text-[#3E2723]"><code className="contents">{(selectedFile.selected.content || "").split("\n").slice(0, 5000).map((line, index) => <span key={index} className="contents"><span className="select-none border-r border-[#E7DED1] pr-3 text-right text-[#B8A99A]">{index + 1}</span><span className="pl-4">{codeTokens(line || " ")}</span></span>)}</code></pre>
                {selectedFile.selected.truncated && <p className="mt-3 px-5 text-[10px] text-amber-700">File preview truncated to keep the browser responsive.</p>}
              </div>
            )}
        </div>
      </div>
    </section>
  )
}

function ProjectJudgingPanel({ projectId }: { projectId: string }) {
  const supabase = useMemo(() => createClient(), [])
  const [scores, setScores] = useState<Record<Criterion, number>>({
    general_access: 0, functionality: 0, user_experience: 0, technical_requirements: 0, innovation_creativity: 0, presentation: 0,
  })
  const [feedback, setFeedback] = useState("")
  const [decision, setDecision] = useState<Evaluation["decision"]>("undecided")
  const [hasDraftChanges, setHasDraftChanges] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState("")
  const { data: user } = useSWR<UserSummary>("/api/me", jsonFetcher)
  const { data: evaluations = [], error: evaluationsError, mutate: mutateEvaluations } = useSWR<Evaluation[]>(`/api/projects/${encodeURIComponent(projectId)}/evaluations`, jsonFetcher)

  const ownEvaluation = evaluations.find((evaluation) => evaluation.judge_id === user?.id)
  useEffect(() => {
    if (!ownEvaluation || hasDraftChanges) return
    setScores({
      general_access: ownEvaluation.general_access,
      functionality: ownEvaluation.functionality,
      user_experience: ownEvaluation.user_experience,
      technical_requirements: ownEvaluation.technical_requirements,
      innovation_creativity: ownEvaluation.innovation_creativity,
      presentation: ownEvaluation.presentation,
    })
    setFeedback(ownEvaluation.feedback)
    setDecision(ownEvaluation.decision)
  }, [ownEvaluation?.updated_at, ownEvaluation?.id, hasDraftChanges])

  useEffect(() => {
    const channel = supabase
      .channel(`project-evaluations-${projectId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "evaluations", filter: `project_id=eq.${projectId}` }, () => { void mutateEvaluations() })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [projectId, supabase, mutateEvaluations])

  const averageScore = evaluations.length ? evaluations.reduce((sum, evaluation) => sum + Number(evaluation.weighted_score), 0) / evaluations.length : 0
  const judgeCanEvaluate = user?.role === "judge" || user?.role === "admin"
  const calculateWeightedScore = () => criteria.reduce((sum, criterion) => sum + scores[criterion.key] * criterion.weight, 0) / 5

  async function saveEvaluation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user || !judgeCanEvaluate) return
    setIsSaving(true)
    setSaveError("")
    // Saved through the server route so the judge-only role check is enforced
    // server-side rather than relying on this component's UI state.
    const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/evaluations`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...scores, feedback: feedback.trim(), decision }),
    })
    if (!response.ok) setSaveError(response.status === 403 ? "Your account is not permitted to submit evaluations." : "Your evaluation could not be saved. Please try again.")
    else {
      setHasDraftChanges(false)
      await mutateEvaluations()
      toast.success("Evaluation saved and shared with the review panel.")
    }
    setIsSaving(false)
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(300px,.9fr)]">
      <section className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#B85621]">CEDA judging rubric</p><h2 className="mt-1 text-lg font-semibold text-[#2A2118]">Evaluation criteria</h2></div>
          <div className="rounded-lg border border-[#E7DED1] bg-[#FAF8F4] px-3 py-2 text-right"><p className="text-[10px] text-[#8C7B6A]">Weighted score</p><p className="text-lg font-semibold text-[#2A2118]">{calculateWeightedScore().toFixed(1)}<span className="ml-0.5 text-xs text-[#8C7B6A]">/100</span></p></div>
        </div>
        {!judgeCanEvaluate && <p className="rounded-lg border border-[#E0B33A]/30 bg-[#E0B33A]/10 px-3 py-2 text-xs text-[#6E2C24]">Your account can view feedback but does not currently have judge access.</p>}
        <form onSubmit={saveEvaluation} className="flex flex-col gap-4">
          {criteria.map((criterion) => (
            <label key={criterion.key} className="flex flex-col gap-2 rounded-lg border border-[#E7DED1] bg-[#FAF8F4] p-3.5">
              <span className="flex items-center justify-between gap-3"><span className="text-xs font-medium text-[#2A2118]">{criterion.label}</span><span className="text-[10px] text-[#8C7B6A]">{criterion.weight}% · <strong className="text-[#5D4037]">{scores[criterion.key]}/5</strong></span></span>
              <span className="text-[10px] leading-4 text-[#8C7B6A]">{criterion.description}</span>
              <input type="range" min="0" max="5" step="0.5" value={scores[criterion.key]} disabled={!judgeCanEvaluate || isSaving} onChange={(event) => { setScores((previous) => ({ ...previous, [criterion.key]: Number(event.target.value) })); setHasDraftChanges(true) }} aria-label={`${criterion.label} score`} className="w-full accent-[#6E2C24] disabled:opacity-40" />
            </label>
          ))}
          <label className="flex flex-col gap-2 text-xs font-medium text-[#5D4037]">Feedback for the team<textarea value={feedback} disabled={!judgeCanEvaluate || isSaving} onChange={(event) => { setFeedback(event.target.value); setHasDraftChanges(true) }} rows={4} maxLength={4000} className="resize-y rounded-lg border border-[#E7DED1] bg-white px-3 py-2.5 text-sm font-normal text-[#2A2118] outline-none placeholder:text-[#B8A99A] focus:border-[#C9961E] disabled:opacity-40" placeholder="Share constructive, actionable feedback." /></label>
          <label className="flex flex-col gap-2 text-xs font-medium text-[#5D4037]">Recommendation<select value={decision} disabled={!judgeCanEvaluate || isSaving} onChange={(event) => { setDecision(event.target.value as Evaluation["decision"]); setHasDraftChanges(true) }} className="h-10 rounded-lg border border-[#E7DED1] bg-[#FAF8F4] px-3 text-sm text-[#2A2118] outline-none focus:border-[#C9961E] disabled:opacity-40"><option value="undecided">Undecided</option><option value="advance">Advance</option><option value="revise">Revise</option><option value="reject">Do not advance</option></select></label>
          {saveError && <p role="alert" className="text-xs text-rose-600">{saveError}</p>}
          {judgeCanEvaluate && <button type="submit" disabled={isSaving || !hasDraftChanges} className="inline-flex h-10 items-center justify-center rounded-lg bg-[#6E2C24] px-4 text-sm font-medium text-white transition-colors hover:bg-[#8A3B2A] disabled:cursor-not-allowed disabled:opacity-45">{isSaving ? "Saving…" : ownEvaluation ? "Update evaluation" : "Submit evaluation"}</button>}
        </form>
      </section>

      <aside className="flex flex-col gap-3">
        <section className="rounded-xl border border-[#E7DED1] bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex items-center justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#B85621]">Live panel</p><h2 className="mt-1 text-sm font-semibold text-[#2A2118]">Judge consensus</h2></div><span className="flex items-center gap-1.5 text-[10px] text-emerald-700"><span className="size-1.5 rounded-full bg-emerald-500" />Live</span></div>
          <div className="flex items-end gap-2"><p className="text-3xl font-semibold tracking-tight text-[#2A2118]">{evaluations.length ? averageScore.toFixed(1) : "—"}</p><p className="pb-1 text-xs text-[#8C7B6A]">/100 weighted average</p></div>
          <p className="mt-1 text-[11px] text-[#8C7B6A]">{evaluations.length} submitted judge {evaluations.length === 1 ? "evaluation" : "evaluations"}</p>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#F3EEE6]"><div className="h-full rounded-full bg-emerald-500 transition-[width]" style={{ width: `${Math.min(100, averageScore)}%` }} /></div>
          {evaluationsError && <p role="alert" className="mt-3 text-[11px] text-rose-600">Evaluation data could not be loaded.</p>}
        </section>
        <section className="flex flex-col gap-2 rounded-xl border border-[#E7DED1] bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-1 flex items-center justify-between"><h2 className="text-sm font-semibold text-[#2A2118]">Panel submissions</h2><span className="text-[10px] text-[#8C7B6A]">Updates live</span></div>
          {evaluations.length ? evaluations.map((evaluation) => (
            <article key={evaluation.id} className="rounded-lg border border-[#E7DED1] bg-[#FAF8F4] p-3">
              <div className="flex items-center justify-between gap-2"><span className="truncate text-xs font-medium text-[#2A2118]">{evaluation.judge_name || "Judge"}</span><span className="text-xs font-semibold text-[#5D4037]">{Number(evaluation.weighted_score).toFixed(1)}</span></div>
              <p className="mt-1 text-[10px] uppercase tracking-wider text-[#5D4037]">{evaluation.decision}</p>
              {evaluation.feedback && <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-[11px] leading-5 text-[#5D4037]">{evaluation.feedback}</p>}
            </article>
          )) : <p className="py-6 text-center text-xs text-[#8C7B6A]">Evaluations appear here as judges submit them.</p>}
        </section>
      </aside>
    </div>
  )
}

export function ProjectRepository({ projectId }: { projectId: string }) {
  const supabase = useMemo(() => createClient(), [])
  const [activeTab, setActiveTab] = useState<"code" | "judging">("code")
  const [stageError, setStageError] = useState("")
  const [isUpdatingStage, setIsUpdatingStage] = useState(false)
  const { data: result, error: projectError, mutate: mutateProject } = useSWR<ProjectResponse>(`/api/projects/${encodeURIComponent(projectId)}`, jsonFetcher)
  const project = result?.project

  // The judging surface is reviewer-only. Applicants (and anyone whose role is
  // still loading) get the read-only code view and never mount the rubric.
  const judgeView = canAccessJudging(result?.currentUserRole)

  useEffect(() => {
    if (!judgeView) setActiveTab("code")
  }, [judgeView])

  useEffect(() => {
    const channel = supabase
      .channel(`project-stage-${projectId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "projects", filter: `id=eq.${projectId}` }, () => { void mutateProject() })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [projectId, supabase, mutateProject])

  async function updateStage(status: NonNullable<Project["status"]>) {
    setStageError("")
    setIsUpdatingStage(true)
    const { error } = await supabase.from("projects").update({ status }).eq("id", projectId)
    if (error) setStageError("Project stage could not be updated.")
    else await mutateProject()
    setIsUpdatingStage(false)
  }

  if (projectError) return <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">Project could not be loaded or you do not have access.</div>
  if (!project) return <div className="min-h-[420px] animate-pulse rounded-xl border border-[#E7DED1] bg-[#FAF8F4]" />

  return (
    <div className="flex flex-col gap-5">
      <header>
        <Link href="/" className="mb-5 inline-flex items-center gap-2 text-xs text-[#8C7B6A] hover:text-[#5D4037]"><ArrowLeft className="size-3.5" aria-hidden="true" />All projects</Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><h1 className="truncate text-xl font-semibold text-[#6E2C24] sm:text-2xl">{project.title}</h1><span className="rounded-full border border-[#E7DED1] px-2 py-0.5 text-[10px] text-[#8C7B6A]">Private</span></div>
            <p className="mt-1 text-xs text-[#8C7B6A]">{project.developer} <span className="px-1 text-[#C9BFAE]">/</span> <span className="font-mono">{project.id}</span></p>
            {project.summary && (
              <section aria-labelledby="idea-summary-heading" className="mt-4 max-w-3xl rounded-xl border border-[#E7DED1] bg-white p-4 shadow-sm">
                <h2 id="idea-summary-heading" className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#B85621]">
                  <FileText className="size-3.5" aria-hidden="true" />Idea summary
                  {result?.isOwner && <span className="rounded-full border border-[#E7DED1] px-1.5 py-0.5 text-[9px] font-medium normal-case tracking-normal text-[#8C7B6A]">Yours</span>}
                </h2>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#5D4037]">{project.summary}</p>
              </section>
            )}
            {project.aiReport?.purpose && <p className="mt-3 max-w-3xl text-xs leading-5 text-[#8C7B6A]"><span className="font-medium text-[#5D4037]">AI assessment:</span> {project.aiReport.purpose}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {result?.currentUserRole === "admin" ? (
                <label className="flex items-center gap-2 text-[11px] text-[#8C7B6A]">Workflow stage
                  <select value={project.status || "submitted"} disabled={isUpdatingStage} onChange={(event) => void updateStage(event.target.value as NonNullable<Project["status"]>)} className="h-8 rounded-md border border-[#E7DED1] bg-[#FAF8F4] px-2 text-xs text-[#2A2118] outline-none focus:border-[#C9961E] disabled:opacity-50">
                    <option value="submitted">Submitted</option><option value="review">In review</option><option value="feedback">Feedback</option><option value="approved">Approved</option><option value="awarded">Awarded</option><option value="rejected">Not selected</option>
                  </select>
                </label>
              ) : <span className="rounded-md border border-[#E7DED1] bg-[#FAF8F4] px-2.5 py-1 text-[10px] capitalize text-[#5D4037]">{project.status || "submitted"}</span>}
              {stageError && <span role="alert" className="text-[11px] text-rose-600">{stageError}</span>}
            </div>
          </div>
          <span className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-700"><LockKeyhole className="size-3.5" aria-hidden="true" />Authorized repository view</span>
        </div>
      </header>

      <section className="overflow-hidden rounded-xl border border-[#E7DED1] bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-[#E7DED1] bg-[#FAF8F4] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2 text-xs"><GitBranch className="size-4 text-[#8C7B6A]" aria-hidden="true" /><span className="font-medium text-[#5D4037]">ZIP snapshot</span><ChevronRight className="size-3 text-[#C9BFAE]" aria-hidden="true" /><span className="truncate text-[#8C7B6A]">{project.fileCount} files</span></div>
          {judgeView && (
            <nav aria-label="Repository sections" className="flex items-center gap-1 rounded-lg border border-[#E7DED1] bg-white p-1">
              <button type="button" onClick={() => setActiveTab("code")} aria-pressed={activeTab === "code"} className={`rounded-md px-3 py-1.5 text-[11px] font-medium ${activeTab === "code" ? "bg-[#6E2C24] text-white" : "text-[#8C7B6A] hover:text-[#5D4037]"}`}><Code2 className="mr-1.5 inline size-3.5" aria-hidden="true" />Code</button>
              <button type="button" onClick={() => setActiveTab("judging")} aria-pressed={activeTab === "judging"} className={`rounded-md px-3 py-1.5 text-[11px] font-medium ${activeTab === "judging" ? "bg-[#6E2C24] text-white" : "text-[#8C7B6A] hover:text-[#5D4037]"}`}><Users className="mr-1.5 inline size-3.5" aria-hidden="true" />Judging</button>
            </nav>
          )}
        </div>
        {judgeView && activeTab === "judging" ? <div className="p-4 sm:p-6"><ProjectJudgingPanel projectId={projectId} /></div> : <RepositoryFiles projectId={projectId} />}
      </section>
    </div>
  )
}

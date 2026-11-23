"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  X, Link as LinkIcon, Image as ImageIcon, FileText, CheckCircle2, Loader2, AlertCircle,
  ShieldCheck, Circle, Lock, Type, FolderArchive,
} from "lucide-react"
import type { Project } from "@/lib/data"
import {
  SUBMISSION_LIMITS,
  validateSubmissionDraft,
  type SubmissionField,
} from "@/lib/submission-validation"

type UploadStage = "idle" | "uploading" | "checks" | "ai" | "storage" | "done" | "error"

const STAGES: Array<{ key: UploadStage; label: string; note: string }> = [
  { key: "uploading", label: "Uploading submission", note: "Sending your screenshots, documentation and source archive to the server over a secure connection." },
  { key: "checks", label: "Checking attachments", note: "Validating file types, sizes and count limits, and verifying the ZIP archive." },
  { key: "ai", label: "Running automated review", note: "Summarising your idea and project files into a judge-ready brief." },
  { key: "storage", label: "Saving to private storage", note: "Persisting your attachments and review report to the private CEDA bucket." },
]

interface SubmissionModalProps {
  open: boolean
  onClose: () => void
  onSubmitted: (project: Project) => void
  /** A ZIP the applicant picked before opening the modal; seeds the source-code field. */
  initialArchive?: File | null
}

const CHECKLIST: Array<{ field: SubmissionField; label: string; required: true }> = [
  { field: "title", label: "Project title", required: true },
  { field: "summary", label: "Idea summary", required: true },
  { field: "projectUrl", label: "Project link", required: true },
  { field: "screenshots", label: "Screenshots", required: true },
  { field: "documentation", label: "Documentation", required: true },
  { field: "declaration", label: "Declaration", required: true },
]

export function SubmissionModal({ open, onClose, onSubmitted, initialArchive = null }: SubmissionModalProps) {
  const [title, setTitle] = useState("")
  const [summary, setSummary] = useState("")
  const [screenshots, setScreenshots] = useState<File[]>([])
  const [projectUrl, setProjectUrl] = useState("")
  const [docs, setDocs] = useState<File[]>([])
  const [archive, setArchive] = useState<File | null>(null)
  const [declared, setDeclared] = useState(false)
  const [showErrors, setShowErrors] = useState(false)
  const [stage, setStage] = useState<UploadStage>("idle")
  const [error, setError] = useState("")
  const screenshotInputRef = useRef<HTMLInputElement>(null)
  const docInputRef = useRef<HTMLInputElement>(null)
  const archiveInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) {
      setTitle("")
      setSummary("")
      setScreenshots([])
      setProjectUrl("")
      setDocs([])
      setArchive(null)
      setDeclared(false)
      setShowErrors(false)
      setStage("idle")
      setError("")
      return
    }
    // Carry a ZIP the applicant chose from the dashboard upload card straight
    // into the source-code field, so they are not asked to pick it twice.
    if (initialArchive) {
      if (!/\.zip$/i.test(initialArchive.name)) {
        setError("The source archive must be a .zip file. Export your project folder as a ZIP and try again.")
      } else if (initialArchive.size > SUBMISSION_LIMITS.archiveMaxBytes) {
        setError(`The source archive must be ${Math.round(SUBMISSION_LIMITS.archiveMaxBytes / (1024 * 1024))} MB or smaller.`)
      } else {
        setArchive(initialArchive)
      }
    }
  }, [open, initialArchive])

  const draft = useMemo(
    () => ({
      title,
      summary,
      projectUrl,
      screenshotCount: screenshots.length,
      documentationCount: docs.length,
      archiveCount: archive ? 1 : 0,
      declared,
    }),
    [title, summary, projectUrl, screenshots.length, docs.length, archive, declared],
  )

  const issues = useMemo(() => validateSubmissionDraft(draft), [draft])
  const complete = issues.length === 0
  const issueFor = (field: SubmissionField) => (showErrors ? issues.find((i) => i.field === field)?.message : undefined)
  const isDone = (field: SubmissionField) => !issues.some((i) => i.field === field)

  if (!open) return null

  const canSubmit = complete && stage === "idle"

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const addScreenshots = (files: File[]) => {
    setError("")
    const oversized = files.find((f) => f.size > SUBMISSION_LIMITS.screenshotMaxBytes)
    if (oversized) {
      setError(`"${oversized.name}" exceeds the 8 MB per-screenshot limit.`)
      return
    }
    setScreenshots((prev) => {
      const next = [...prev, ...files]
      if (next.length > SUBMISSION_LIMITS.screenshotMaxCount) {
        setError(`Upload at most ${SUBMISSION_LIMITS.screenshotMaxCount} screenshots.`)
        return prev
      }
      return next
    })
  }

  const addDocs = (files: File[]) => {
    setError("")
    const oversized = files.find((f) => f.size > SUBMISSION_LIMITS.documentationMaxBytes)
    if (oversized) {
      setError(`"${oversized.name}" exceeds the 15 MB per-document limit.`)
      return
    }
    setDocs((prev) => {
      const next = [...prev, ...files]
      if (next.length > SUBMISSION_LIMITS.documentationMaxCount) {
        setError(`Upload at most ${SUBMISSION_LIMITS.documentationMaxCount} documentation files.`)
        return prev
      }
      return next
    })
  }

  const addArchive = (file: File) => {
    setError("")
    if (file.size > SUBMISSION_LIMITS.archiveMaxBytes) {
      setError(`The source archive must be ${Math.round(SUBMISSION_LIMITS.archiveMaxBytes / (1024 * 1024))} MB or smaller.`)
      return
    }
    if (!/\.zip$/i.test(file.name)) {
      setError("The source archive must be a .zip file. Export your project folder as a ZIP and try again.")
      return
    }
    setArchive(file)
  }

  const currentStageIndex = STAGES.findIndex((s) => s.key === stage)
  const progressPercent = stage === "done" ? 100 : stage === "error" ? 0 : stage === "idle" ? 0 : Math.round(((currentStageIndex + 1) / STAGES.length) * 100)

  const handleSubmit = async () => {
    if (!canSubmit) {
      setShowErrors(true)
      return
    }
    setError("")
    setStage("uploading")

    const form = new FormData()
    form.append("title", title.trim())
    form.append("summary", summary.trim())
    form.append("projectUrl", projectUrl.trim())
    form.append("declared", "true")
    screenshots.forEach((file) => form.append("screenshots", file))
    docs.forEach((file) => form.append("documentation", file))
    if (archive) form.append("archive", archive)

    const stageTimers: ReturnType<typeof setTimeout>[] = []
    const scheduleStage = (next: UploadStage, delay: number) => {
      stageTimers.push(setTimeout(() => setStage(next), delay))
    }
    scheduleStage("checks", 700)
    scheduleStage("ai", 1600)
    scheduleStage("storage", 3400)

    try {
      const response = await fetch("/api/analyze", { method: "POST", body: form })
      const result = await response.json()
      stageTimers.forEach(clearTimeout)
      if (!response.ok) throw new Error(result.error || "Could not process this submission.")
      setStage("done")
      setTimeout(() => {
        onSubmitted(result.project)
        onClose()
      }, 600)
    } catch (err) {
      stageTimers.forEach(clearTimeout)
      setStage("error")
      setError(err instanceof Error ? err.message : "Could not process this submission.")
    }
  }

  const busy = stage === "uploading" || stage === "checks" || stage === "ai" || stage === "storage"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget && stage === "idle") onClose() }}>
      <div className="w-full max-w-2xl rounded-2xl border border-[#E7DED1] bg-white shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#E7DED1] px-5 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-[#2A2118]">
              <Lock className="size-4 text-[#B85621]" /> Secure idea submission
            </h2>
            <p className="text-xs text-[#8C7B6A]">Every field below is required. Your submission is private to you and the review panel.</p>
          </div>
          {stage === "idle" && (
            <button onClick={onClose} className="rounded-md p-1.5 text-[#8C7B6A] hover:bg-[#F3EEE6] hover:text-[#2A2118]">
              <X className="size-4" />
            </button>
          )}
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-5">
          {stage === "done" ? (
            <div className="flex flex-col items-center py-10 text-center">
              <CheckCircle2 className="size-12 text-emerald-600 mb-3" />
              <p className="text-base font-medium text-[#2A2118]">Submission received</p>
              <p className="text-sm text-[#8C7B6A] mt-1">Your idea has been saved and sent to the review panel.</p>
            </div>
          ) : busy ? (
            <div className="py-4">
              <div className="mb-5">
                <div className="flex items-center justify-between text-xs text-[#8C7B6A] mb-2">
                  <span className="font-medium text-[#6E2C24]">{STAGES[currentStageIndex]?.label}</span>
                  <span>{progressPercent}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-[#F3EEE6] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#6E2C24] via-[#B85621] to-[#C9961E] transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
              <div className="space-y-3">
                {STAGES.map((s, idx) => {
                  const stageDone = idx < currentStageIndex
                  const isCurrent = idx === currentStageIndex
                  return (
                    <div key={s.key} className="flex items-start gap-3">
                      <div className="mt-0.5 shrink-0">
                        {stageDone ? (
                          <CheckCircle2 className="size-4 text-emerald-600" />
                        ) : isCurrent ? (
                          <Loader2 className="size-4 text-[#B85621] animate-spin" />
                        ) : (
                          <div className="size-4 rounded-full border-2 border-[#E7DED1]" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className={`text-sm font-medium ${isCurrent ? "text-[#2A2118]" : stageDone ? "text-[#5D4037]" : "text-[#B8A99A]"}`}>{s.label}</p>
                        <p className={`text-xs mt-0.5 ${isCurrent || stageDone ? "text-[#8C7B6A]" : "text-[#B8A99A]"}`}>{s.note}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : stage === "error" ? (
            <div className="flex flex-col items-start gap-3 py-6">
              <div className="flex items-center gap-2 text-rose-700">
                <AlertCircle className="size-5" />
                <p className="font-medium">Submission failed</p>
              </div>
              <p className="text-sm text-[#5D4037]">{error}</p>
              <button onClick={() => setStage("idle")} className="mt-2 rounded-lg bg-[#6E2C24] px-4 py-2 text-sm font-medium text-white hover:bg-[#8A3B2A]">
                Try again
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="rounded-lg border border-[#E7DED1] bg-[#FAF8F4] px-3 py-2.5">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-[#5D4037]">
                  <ShieldCheck className="size-3.5 text-[#B85621]" /> Submission checklist
                  <span className="ml-auto font-normal text-[#8C7B6A]">{CHECKLIST.length - issues.length}/{CHECKLIST.length} complete</span>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-3">
                  {CHECKLIST.map((item) => (
                    <span key={item.field} className="flex items-center gap-1.5 text-xs">
                      {isDone(item.field) ? (
                        <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600" />
                      ) : (
                        <Circle className="size-3.5 shrink-0 text-[#C9BFAE]" />
                      )}
                      <span className={isDone(item.field) ? "text-[#5D4037]" : "text-[#8C7B6A]"}>{item.label}</span>
                    </span>
                  ))}
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  <AlertCircle className="mt-0.5 size-3.5 shrink-0" /> {error}
                </div>
              )}

              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-[#2A2118]">
                  <Type className="size-4 text-[#B85621]" /> Project title <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  maxLength={SUBMISSION_LIMITS.titleMax}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Ledger — real-time SME cash-flow forecasting"
                  className={`w-full rounded-lg border bg-white px-3 py-2 text-sm text-[#2A2118] placeholder:text-[#B8A99A] outline-none focus:border-[#C9961E] ${issueFor("title") ? "border-rose-300" : "border-[#E7DED1]"}`}
                />
                {issueFor("title") && <p className="mt-1 text-xs text-rose-600">{issueFor("title")}</p>}
              </div>

              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-[#2A2118]">
                  <FileText className="size-4 text-[#B85621]" /> Idea summary <span className="text-rose-600">*</span>
                </label>
                <textarea
                  value={summary}
                  maxLength={SUBMISSION_LIMITS.summaryMax}
                  onChange={(e) => setSummary(e.target.value)}
                  rows={4}
                  placeholder="What does it do, who is it for, and what problem does it solve? Reviewers read this first."
                  className={`w-full resize-none rounded-lg border bg-white px-3 py-2 text-sm text-[#2A2118] placeholder:text-[#B8A99A] outline-none focus:border-[#C9961E] ${issueFor("summary") ? "border-rose-300" : "border-[#E7DED1]"}`}
                />
                <div className="mt-1 flex items-center justify-between">
                  {issueFor("summary") ? <p className="text-xs text-rose-600">{issueFor("summary")}</p> : <span className="text-xs text-[#8C7B6A]">Minimum {SUBMISSION_LIMITS.summaryMin} characters.</span>}
                  <span className="text-xs text-[#B8A99A]">{summary.trim().length}/{SUBMISSION_LIMITS.summaryMax}</span>
                </div>
              </div>

              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-[#2A2118]">
                  <ImageIcon className="size-4 text-[#B85621]" /> Screenshots <span className="text-rose-600">*</span>
                </label>
                <input ref={screenshotInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { const files = Array.from(e.currentTarget.files || []); if (files.length) addScreenshots(files); e.currentTarget.value = "" }} />
                <button type="button" onClick={() => screenshotInputRef.current?.click()} className="mb-2 flex w-full items-center justify-between rounded-lg border border-dashed border-[#C9BFAE] bg-[#FAF8F4] px-4 py-3 text-left hover:border-[#B85621]">
                  <span className="text-sm text-[#5D4037]">{screenshots.length ? `${screenshots.length} screenshot(s) added` : `Upload 1–${SUBMISSION_LIMITS.screenshotMaxCount} screenshots (max 8 MB each)`}</span>
                  <ImageIcon className="size-4 text-[#8C7B6A]" />
                </button>
                {screenshots.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {screenshots.map((file, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1.5 rounded-md bg-[#F3EEE6] px-2 py-1 text-xs text-[#5D4037]">
                        {file.name}
                        <button onClick={() => setScreenshots((prev) => prev.filter((_, i) => i !== idx))} className="text-[#8C7B6A] hover:text-rose-600"><X className="size-3" /></button>
                      </span>
                    ))}
                  </div>
                )}
                {issueFor("screenshots") && <p className="mt-1 text-xs text-rose-600">{issueFor("screenshots")}</p>}
              </div>

              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-[#2A2118]">
                  <LinkIcon className="size-4 text-[#B85621]" /> Project link <span className="text-rose-600">*</span>
                </label>
                <input
                  type="url"
                  value={projectUrl}
                  onChange={(e) => setProjectUrl(e.target.value)}
                  placeholder="https://github.com/your-project or live URL"
                  className={`w-full rounded-lg border bg-white px-3 py-2 text-sm text-[#2A2118] placeholder:text-[#B8A99A] outline-none focus:border-[#C9961E] ${issueFor("projectUrl") ? "border-rose-300" : "border-[#E7DED1]"}`}
                />
                {issueFor("projectUrl") && <p className="mt-1 text-xs text-rose-600">{issueFor("projectUrl")}</p>}
              </div>

              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-[#2A2118]">
                  <FileText className="size-4 text-[#B85621]" /> Documentation <span className="text-rose-600">*</span>
                </label>
                <input ref={docInputRef} type="file" multiple className="hidden" onChange={(e) => { const files = Array.from(e.currentTarget.files || []); if (files.length) addDocs(files); e.currentTarget.value = "" }} />
                <button type="button" onClick={() => docInputRef.current?.click()} className="mb-2 flex w-full items-center justify-between rounded-lg border border-dashed border-[#C9BFAE] bg-[#FAF8F4] px-4 py-3 text-left hover:border-[#B85621]">
                  <span className="text-sm text-[#5D4037]">{docs.length ? `${docs.length} document(s) added` : `Upload README, docs, or supporting files (max ${SUBMISSION_LIMITS.documentationMaxCount})`}</span>
                  <FileText className="size-4 text-[#8C7B6A]" />
                </button>
                {docs.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {docs.map((file, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1.5 rounded-md bg-[#F3EEE6] px-2 py-1 text-xs text-[#5D4037]">
                        {file.name} ({formatSize(file.size)})
                        <button onClick={() => setDocs((prev) => prev.filter((_, i) => i !== idx))} className="text-[#8C7B6A] hover:text-rose-600"><X className="size-3" /></button>
                      </span>
                    ))}
                  </div>
                )}
                {issueFor("documentation") && <p className="mt-1 text-xs text-rose-600">{issueFor("documentation")}</p>}
              </div>

              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-[#2A2118]">
                  <FolderArchive className="size-4 text-[#B85621]" /> Source code
                  <span className="rounded bg-[#F3EEE6] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#8C7B6A]">Optional</span>
                </label>
                <input
                  ref={archiveInputRef}
                  type="file"
                  accept=".zip,application/zip"
                  className="hidden"
                  onChange={(e) => { const file = e.currentTarget.files?.[0]; if (file) addArchive(file); e.currentTarget.value = "" }}
                />
                {archive ? (
                  <div className="flex items-center gap-2 rounded-lg border border-[#E7DED1] bg-[#FAF8F4] px-3 py-2.5">
                    <FolderArchive className="size-4 shrink-0 text-[#B85621]" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-[#2A2118]">{archive.name}</p>
                      <p className="text-xs text-[#8C7B6A]">
                        {formatSize(archive.size)} · verified and stored privately when you submit
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setArchive(null)}
                      className="shrink-0 rounded-md p-1 text-[#8C7B6A] hover:bg-[#F3EEE6] hover:text-rose-600"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => archiveInputRef.current?.click()}
                    className="flex w-full items-center justify-between rounded-lg border border-dashed border-[#C9BFAE] bg-[#FAF8F4] px-4 py-3 text-left hover:border-[#B85621]"
                  >
                    <span className="text-sm text-[#5D4037]">
                      Attach your project as a .zip (max {Math.round(SUBMISSION_LIMITS.archiveMaxBytes / (1024 * 1024))} MB)
                    </span>
                    <FolderArchive className="size-4 text-[#8C7B6A]" />
                  </button>
                )}
                <p className="mt-1 text-xs text-[#8C7B6A]">
                  Optional. Zip your project folder so reviewers can inspect the real file structure. The archive is checked
                  for integrity and kept private.
                </p>
                {issueFor("archive") && <p className="mt-1 text-xs text-rose-600">{issueFor("archive")}</p>}
              </div>

              <label className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 ${issueFor("declaration") ? "border-rose-300 bg-rose-50/50" : "border-[#E7DED1] bg-[#FAF8F4]"}`}>
                <input type="checkbox" checked={declared} onChange={(e) => setDeclared(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-[#6E2C24]" />
                <span className="text-xs leading-relaxed text-[#5D4037]">
                  <span className="font-medium text-[#2A2118]">Declaration <span className="text-rose-600">*</span></span>
                  <br />
                  I confirm this work is my own or my team&apos;s, that it contains no third-party secrets or licence violations, and that I understand it will be reviewed by the CEDA panel and may be scored.
                </span>
              </label>
              {issueFor("declaration") && <p className="-mt-2 text-xs text-rose-600">{issueFor("declaration")}</p>}
            </div>
          )}
        </div>

        {stage === "idle" && (
          <div className="flex items-center justify-between gap-3 border-t border-[#E7DED1] px-5 py-4">
            <span className="text-xs text-[#8C7B6A]">
              {complete ? (
                <span className="inline-flex items-center gap-1.5 text-emerald-700"><ShieldCheck className="size-3.5" /> Ready to submit</span>
              ) : showErrors ? (
                <span className="inline-flex items-center gap-1.5 text-rose-600"><AlertCircle className="size-3.5" /> {issues.length} field{issues.length === 1 ? "" : "s"} need attention</span>
              ) : (
                `${issues.length} required field${issues.length === 1 ? "" : "s"} remaining`
              )}
            </span>
            <div className="flex gap-3">
              <button onClick={onClose} className="rounded-lg border border-[#E7DED1] bg-white px-4 py-2 text-sm font-medium text-[#5D4037] hover:bg-[#F3EEE6]">Cancel</button>
              <button
                onClick={handleSubmit}
                disabled={!complete}
                title={complete ? undefined : "Complete all required fields to submit"}
                className="rounded-lg bg-[#6E2C24] px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[#8A3B2A] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Submit project
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

"use client"

import { useEffect, useRef, useState } from "react"
import useSWR from "swr"
import { ArrowUpRight, FileText, FolderOpen, LockKeyhole, ShieldAlert, ShieldCheck, Users } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { Project } from "@/lib/data"
import { ProjectReport } from "@/components/project-folder/project-report"

function PageHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="mb-7">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#B85621]">{eyebrow}</p>
      <h1 className="text-2xl font-semibold tracking-[-0.03em] text-[#2A2118] sm:text-[28px]">{title}</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5D4037]">{description}</p>
    </div>
  )
}

function Metric({ label, value, note, icon: Icon }: { label: string; value: string | number; note: string; icon: typeof FileText }) {
  return (
    <div className="rounded-xl border border-[#E7DED1] bg-white p-4 sm:p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-xs text-[#8C7B6A]">{label}</span>
        <Icon className="size-4 text-[#B85621]/70" strokeWidth={1.8} aria-hidden="true" />
      </div>
      <p className="text-2xl font-semibold tracking-tight text-[#2A2118]">{value}</p>
      <p className="mt-1 text-[11px] text-[#8C7B6A]">{note}</p>
    </div>
  )
}

export function ReportsView({ projects, audience = "reviewer" }: { projects: Project[]; audience?: "applicant" | "reviewer" }) {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const reports = projects.filter((project) => project.aiReport)
  const isApplicant = audience === "applicant"

  useEffect(() => {
    if (selectedProject && dialogRef.current && !dialogRef.current.open) dialogRef.current.showModal()
  }, [selectedProject])

  return (
    <section aria-labelledby="reports-heading">
      <PageHeading
        eyebrow="Project intelligence"
        title={isApplicant ? "My submission reports" : "Submission reports"}
        description={isApplicant
          ? "The analysis generated from your own uploaded archive. This is the same summary the review panel sees, plus guidance on what to improve."
          : "Judge-ready summaries and evidence-based capability reviews generated from each project archive."}
      />
      <div className="mb-7 grid gap-3 sm:grid-cols-3">
        <Metric label={isApplicant ? "My submissions" : "Submissions"} value={projects.length} note={isApplicant ? "Archives you uploaded" : "Stored in the private CEDA bucket"} icon={FolderOpen} />
        <Metric label="Reports ready" value={reports.length} note="Generated from uploaded project files" icon={FileText} />
        <Metric label="Advanced builds" value={reports.filter((project) => project.aiReport?.technicalComplexity === "Advanced").length} note="AI-assessed technical complexity" icon={ArrowUpRight} />
      </div>
      <div className="flex flex-col gap-3">
        {reports.length ? reports.map((project) => (
          <article key={project.id} className="flex flex-col gap-4 rounded-xl border border-[#E7DED1] bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-sm font-semibold text-[#2A2118]">{project.title}</h2>
                <span className="rounded-md border border-[#E0B33A]/30 bg-[#E0B33A]/10 px-2 py-0.5 text-[10px] text-[#8A6D12]">{project.aiReport?.technicalComplexity}</span>
              </div>
              <p className="mt-1 text-xs text-[#8C7B6A]">{project.developer} · {project.fileCount} files · {project.technologies?.slice(0, 4).join(" · ") || "Stack not detected"}</p>
              <p className="mt-3 line-clamp-2 max-w-3xl text-xs leading-5 text-[#5D4037]">{project.aiReport?.judgeSummary}</p>
            </div>
            <button type="button" onClick={() => setSelectedProject(project)} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-[#E7DED1] bg-[#FAF8F4] px-3 py-2 text-xs font-medium text-[#6E2C24] transition-colors hover:bg-[#6E2C24] hover:text-white">
              <FileText className="size-3.5" aria-hidden="true" /> View report
            </button>
          </article>
        )) : (
          <div className="rounded-xl border border-dashed border-[#C9BFAE] bg-[#FAF8F4] px-5 py-10 text-center">
            <FileText className="mx-auto mb-3 size-5 text-[#8C7B6A]" aria-hidden="true" />
            <p className="text-sm font-medium text-[#2A2118]">No reports yet</p>
            <p className="mt-1 text-xs text-[#8C7B6A]">{isApplicant ? "Upload a project ZIP to generate your submission report." : "Upload a project ZIP to generate its submission report."}</p>
          </div>
        )}
      </div>
      {selectedProject && <ProjectReport project={selectedProject} dialogRef={dialogRef} onClose={() => setSelectedProject(null)} />}
    </section>
  )
}

export function SecurityView({ projects }: { projects: Project[] }) {
  const staticFindings = projects.flatMap((project) => (project.securityFindings || [])
    .filter((finding) => finding.severity !== "low")
    .map((finding) => ({ ...finding, projectTitle: project.title })))
  const dependencyFindings = projects.flatMap((project) => (project.dependencyFindings || [])
    .map((finding) => ({ ...finding, projectTitle: project.title })))
  const totalFindings = staticFindings.length + dependencyFindings.length

  return (
    <section aria-labelledby="security-heading">
      <PageHeading eyebrow="Review center" title="Security findings" description="Static code indicators and OSV dependency matches from uploaded submissions. These checks are triage signals, not a malware verdict or complete audit." />
      <div className="mb-7 grid gap-3 sm:grid-cols-3">
        <Metric label="Projects scanned" value={projects.length} note="Archive integrity and static checks" icon={ShieldCheck} />
        <Metric label="Code review items" value={staticFindings.length} note="Secrets, scripts, and suspicious patterns" icon={ShieldAlert} />
        <Metric label="Dependency matches" value={dependencyFindings.length} note="OSV lookups from supported lockfiles" icon={FileText} />
      </div>
      {totalFindings ? (
        <div className="flex flex-col gap-3">
          {staticFindings.map((finding, index) => (
            <article key={`${finding.projectTitle}-${finding.title}-${index}`} className="rounded-xl border border-[#E7DED1] bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className={`rounded-md px-2 py-1 text-[10px] font-semibold ${finding.severity === "high" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>{finding.severity.toUpperCase()}</span>
                <h2 className="text-sm font-medium text-[#2A2118]">{finding.title}</h2>
                <span className="text-[11px] text-[#8C7B6A]">{finding.projectTitle}{finding.file ? ` · ${finding.file}` : ""}</span>
              </div>
              <p className="text-xs leading-5 text-[#5D4037]">{finding.detail}</p>
            </article>
          ))}
          {dependencyFindings.map((finding, index) => (
            <article key={`${finding.id}-${index}`} className="rounded-xl border border-[#E0B33A]/30 bg-[#E0B33A]/[0.06] p-4 sm:p-5">
              <div className="mb-2 flex flex-wrap items-center gap-2"><span className="rounded-md bg-[#E0B33A]/20 px-2 py-1 text-[10px] font-semibold text-[#8A6D12]">OSV · {finding.severity}</span><h2 className="text-sm font-medium text-[#2A2118]">{finding.package}@{finding.version} · {finding.id}</h2><span className="text-[11px] text-[#8C7B6A]">{finding.projectTitle}</span></div>
              <p className="text-xs leading-5 text-[#5D4037]">{finding.summary}</p>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-[#E7DED1] bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-3 flex items-center gap-2 text-emerald-700"><ShieldCheck className="size-4" aria-hidden="true" /><h2 className="text-sm font-medium">No high or medium indicators flagged</h2></div>
          <p className="text-xs leading-5 text-[#5D4037]">{projects.length ? "Static heuristics found no review items and no OSV matches were recorded. A clean result does not certify that a project is safe." : "Upload a project ZIP to run archive integrity checks, inspect suspicious patterns, and query supported lockfiles against OSV."}</p>
        </div>
      )}
      <p className="mt-5 text-[10px] leading-4 text-[#8C7B6A]">Submitted code and install hooks are never executed. Dependency results are limited to supported lockfiles and the packages queried during analysis.</p>
    </section>
  )
}

export function StorageView({ projects }: { projects: Project[] }) {
  const storedProjects = projects.filter((project) => project.storedInR2)
  return (
    <section aria-labelledby="storage-heading">
      <PageHeading eyebrow="Infrastructure" title="Project storage" description="Private R2 object storage for project archives, generated previews, and review reports." />
      <div className="mb-7 rounded-2xl border border-[#E7DED1] bg-gradient-to-br from-[#FAF8F4] to-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-[#E7DED1] bg-[#FAF8F4] text-emerald-700"><LockKeyhole className="size-5" aria-hidden="true" /></div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8C7B6A]">Cloudflare R2 bucket</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-[#2A2118]">ceda</h2>
              <p className="mt-1 text-xs text-[#8C7B6A]">Private bucket · {storedProjects.length} project folders</p>
            </div>
          </div>
          <div className="rounded-lg border border-[#E7DED1] bg-[#FAF8F4] px-3 py-2 font-mono text-[11px] text-[#5D4037]">projects/&lt;project-id&gt;/</div>
        </div>
        <div className="mt-5 grid gap-2 border-t border-[#E7DED1] pt-4 text-[11px] text-[#5D4037] sm:grid-cols-3">
          <p><span className="font-mono text-[#6E2C24]">source.zip</span> · original archive</p>
          <p><span className="font-mono text-[#6E2C24]">project.json</span> · analysis report</p>
          <p><span className="font-mono text-[#6E2C24]">previews/</span> · optimized screenshots</p>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {storedProjects.length ? storedProjects.map((project) => (
          <article key={project.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E7DED1] bg-white px-4 py-3 shadow-sm">
            <div className="flex min-w-0 items-center gap-3">
              <FolderOpen className="size-4 shrink-0 text-[#B85621]/70" aria-hidden="true" />
              <div className="min-w-0"><p className="truncate text-xs font-medium text-[#2A2118]">{project.title}</p><p className="truncate font-mono text-[10px] text-[#8C7B6A]">projects/{project.id}/</p></div>
            </div>
            <span className="text-[10px] text-[#8C7B6A]">{project.fileCount} files · {project.images?.length || 0} previews</span>
          </article>
        )) : <p className="rounded-xl border border-dashed border-[#C9BFAE] bg-[#FAF8F4] px-4 py-6 text-center text-xs text-[#8C7B6A]">Project folders appear here after ZIP submissions are uploaded.</p>}
      </div>
      <p className="mt-5 text-[10px] leading-4 text-[#8C7B6A]">The bucket stays private. The gallery serves analyzed metadata and preview images through the app; the original ZIP is not exposed by the preview API.</p>
    </section>
  )
}

type AdminUser = { user_id: string; email: string; display_name: string; role: "submitter" | "judge" | "admin"; created_at: string }

async function fetchAdminUsers(): Promise<AdminUser[]> {
  const { data, error } = await createClient().rpc("admin_list_users")
  if (error) throw new Error("Judge roster could not be loaded.")
  return (data || []) as AdminUser[]
}

export function JudgesView() {
  const { data: users = [], error, mutate } = useSWR<AdminUser[]>("admin-user-directory", fetchAdminUsers)
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null)
  const [actionError, setActionError] = useState("")

  async function updateRole(userId: string, role: AdminUser["role"]) {
    setUpdatingUserId(userId)
    setActionError("")
    const { error: updateError } = await createClient().rpc("admin_set_user_role", { p_user_id: userId, p_role: role })
    if (updateError) setActionError("Role update was rejected. Only an administrator can promote reviewers.")
    else await mutate()
    setUpdatingUserId(null)
  }

  return (
    <section aria-labelledby="judges-heading">
      <PageHeading eyebrow="Access control" title="Judge management" description="Accounts sign up as submitters. Promote approved evaluators here; changes take effect immediately through database role checks." />
      <div className="mb-5 flex items-center gap-3 rounded-xl border border-[#E7DED1] bg-white p-4 shadow-sm">
        <div className="flex size-9 items-center justify-center rounded-lg border border-[#E7DED1] bg-[#FAF8F4] text-[#6E2C24]"><Users className="size-4" aria-hidden="true" /></div>
        <div><p className="text-xs font-medium text-[#2A2118]">{users.filter((user) => user.role === "judge").length} active judges</p><p className="mt-0.5 text-[10px] text-[#8C7B6A]">Each judge has one independent score per project.</p></div>
      </div>
      {actionError && <p role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{actionError}</p>}
      {error ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700">Judge roster is restricted to administrators.</p> : (
        <div className="overflow-hidden rounded-xl border border-[#E7DED1] bg-white shadow-sm">
          <div className="grid grid-cols-[minmax(0,1fr)_140px] border-b border-[#E7DED1] px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8C7B6A] sm:grid-cols-[minmax(0,1fr)_180px_140px]"><span>Account</span><span className="hidden sm:block">Joined</span><span className="text-right">Role</span></div>
          {users.map((user) => (
            <div key={user.user_id} className="grid grid-cols-[minmax(0,1fr)_140px] items-center gap-3 border-b border-[#F3EEE6] px-4 py-3 last:border-0 sm:grid-cols-[minmax(0,1fr)_180px_140px]">
              <div className="min-w-0"><p className="truncate text-xs font-medium text-[#2A2118]">{user.display_name || "CEDA user"}</p><p className="truncate text-[10px] text-[#8C7B6A]">{user.email}</p></div>
              <span className="hidden text-[10px] text-[#8C7B6A] sm:block">{new Date(user.created_at).toLocaleDateString()}</span>
              <label className="sr-only" htmlFor={`role-${user.user_id}`}>Role for {user.display_name || user.email}</label>
              <select id={`role-${user.user_id}`} value={user.role} disabled={updatingUserId === user.user_id} onChange={(event) => void updateRole(user.user_id, event.target.value as AdminUser["role"])} className="h-8 w-full rounded-md border border-[#E7DED1] bg-[#FAF8F4] px-2 text-[11px] text-[#2A2118] outline-none focus:border-[#C9961E] disabled:opacity-50">
                <option value="submitter">Submitter</option><option value="judge">Judge</option><option value="admin">Administrator</option>
              </select>
            </div>
          ))}
          {!users.length && <p className="px-4 py-8 text-center text-xs text-[#8C7B6A]">No registered accounts yet. Users can sign up, then be promoted here.</p>}
        </div>
      )}
    </section>
  )
}

"use client"

import type { ReactNode, RefObject } from "react"
import type { Project } from "@/lib/data"

function ReportSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="border-t border-[#E7DED1] pt-3"><h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8C7B6A]">{title}</h3>{children}</section>
}

export function ProjectReport({ project, dialogRef, onClose }: { project: Project; dialogRef: RefObject<HTMLDialogElement | null>; onClose?: () => void }) {
  const report = project.aiReport
  const stackGroups: Array<[string, string[]]> = report ? [
    ["Languages", report.languages], ["Frameworks", report.frameworks], ["Databases", report.databases], ["APIs & integrations", report.apisAndIntegrations],
  ] : []
  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={`report-title-${project.id}`}
      className="fixed inset-0 m-auto max-h-[min(86vh,720px)] w-[min(680px,calc(100vw-32px))] overflow-y-auto rounded-2xl border border-[#E7DED1] bg-white p-0 text-[#2A2118] shadow-2xl backdrop:bg-black/40"
      onClick={(event) => { if (event.target === event.currentTarget) dialogRef.current?.close() }}
      onClose={onClose}
    >
      <div className="flex items-start justify-between gap-5 border-b border-[#E7DED1] px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <p className="mb-1 text-[10px] uppercase tracking-[0.18em] text-[#B85621]">Submission intelligence</p>
          <h2 id={`report-title-${project.id}`} className="truncate text-lg font-semibold text-[#2A2118]">{project.title}</h2>
          <p className="mt-1 text-xs text-[#8C7B6A]">{project.developer} · {project.fileCount} files analysed · {project.securityStatus || project.processingStatus} · Private R2 storage</p>
        </div>
        <button type="button" onClick={() => dialogRef.current?.close()} className="rounded-md px-2 py-1 text-xs text-[#8C7B6A] hover:bg-[#F3EEE6] hover:text-[#2A2118]" aria-label="Close project report">Close</button>
      </div>
      <div className="flex flex-col gap-5 px-5 py-5 sm:px-6">
        {report ? <>
          <section className="rounded-xl border border-[#E7DED1] bg-[#FAF8F4] p-4">
            <div className="mb-2 flex items-center justify-between gap-4">
              <h3 className="text-sm font-medium text-[#2A2118]">Capability assessment</h3>
              <span className="text-xs text-[#8C7B6A]">{report.technicalComplexity} · {report.capabilityScore}/100</span>
            </div>
            <p className="text-sm leading-6 text-[#5D4037]">{report.judgeSummary}</p>
          </section>
          <ReportSection title="Purpose and functionality"><p className="text-sm leading-6 text-[#5D4037]">{report.purpose}</p><p className="mt-2 text-sm leading-6 text-[#8C7B6A]">{report.functionality}</p></ReportSection>
          <ReportSection title="Detected stack">
            <div className="grid gap-3 sm:grid-cols-2">
              {stackGroups.map(([label, values]) => (
                <div key={label}><p className="mb-1 text-[11px] text-[#8C7B6A]">{label}</p><p className="text-xs leading-5 text-[#5D4037]">{values.join(" · ") || "Not identified from available files"}</p></div>
              ))}
            </div>
          </ReportSection>
          <ReportSection title="Architecture"><p className="text-sm leading-6 text-[#5D4037]">{report.architecture}</p></ReportSection>
          <ReportSection title="Build & execution verification"><p className="text-sm leading-6 text-[#5D4037]">{report.buildVerification}</p><p className="mt-2 text-[11px] text-[#8C7B6A]">Project code and install scripts are never executed by this analyzer.</p></ReportSection>
          <ReportSection title="Project strengths"><ul className="list-disc space-y-1 pl-4 text-sm text-[#5D4037]">{report.strengths.length ? report.strengths.map((item, index) => <li key={index}>{item}</li>) : <li>No specific strengths were confidently identified.</li>}</ul></ReportSection>
          <ReportSection title="Code quality"><p className="text-sm leading-6 text-[#5D4037]">{report.codeQuality}</p></ReportSection>
          <ReportSection title="Security review">
            <p className="mb-2 text-[11px] leading-5 text-[#8C7B6A]">Static heuristics and an OSV check of up to 80 resolved npm, pnpm, or Yarn lockfile entries. No submitted code was executed. This is triage, not a malware verdict or comprehensive audit.</p>
            {project.securityFindings?.map((finding, index) => <div key={`${finding.title}-${index}`} className="mb-2 rounded-lg border border-[#E7DED1] p-3"><p className="text-xs font-medium text-[#2A2118]">{finding.severity.toUpperCase()} · {finding.title}{finding.file ? ` · ${finding.file}` : ""}</p><p className="mt-1 text-xs leading-5 text-[#8C7B6A]">{finding.detail}</p></div>)}
            {project.dependencyFindings?.map((finding, index) => <div key={`${finding.id}-${index}`} className="mb-2 rounded-lg border border-[#E0B33A]/30 bg-[#E0B33A]/[0.06] p-3"><p className="text-xs font-medium text-[#8A6D12]">OSV · {finding.package}@{finding.version} · {finding.id}</p><p className="mt-1 text-xs leading-5 text-[#5D4037]">{finding.summary} · Severity: {finding.severity}</p></div>)}
            {report.securityReviewNotes.map((note, index) => <p key={index} className="mt-2 text-xs leading-5 text-[#8C7B6A]">{note}</p>)}
          </ReportSection>
          <ReportSection title="Originality assessment"><p className="text-sm leading-6 text-[#5D4037]">{report.originalityAssessment}</p><p className="mt-2 text-[11px] text-[#8C7B6A]">No external plagiarism or originality database was queried.</p></ReportSection>
          <p className="text-[10px] leading-4 text-[#B8A99A]">AI assessments may be incomplete or incorrect. Build and runtime verification were not performed.</p>
        </> : <p className="text-sm text-[#8C7B6A]">No report is available for this project.</p>}
      </div>
    </dialog>
  )
}

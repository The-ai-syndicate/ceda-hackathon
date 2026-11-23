"use client"

import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { projects as initialProjects, type Project } from "@/lib/data"
import { ProjectFolder } from "@/components/project-folder"
import { Toaster, toast } from "sonner"
import { FullpageLoader } from "@/components/fullpage-loader"
import { motion } from "framer-motion"
import { NewProjectSlot } from "@/components/new-project-slot"
import { Sidebar, type DashboardView } from "@/components/sidebar"
import { JudgesView, ReportsView, SecurityView, StorageView } from "@/components/insight-views"
import { AuditLogView } from "@/components/audit-log-view"
import { SubmissionModal } from "@/components/submission-modal"
import { createClient } from "@/lib/supabase/client"
import { canManageProject, canOpenView, canSubmitProject, isReviewer } from "@/lib/permissions"
import type { AppRole } from "@/lib/supabase/auth-context"
import useSWR from "swr"

const projectFetcher = async (url: string): Promise<Project[]> => {
  const response = await fetch(url)
  if (!response.ok) throw new Error("Saved projects could not be loaded.")
  return response.json()
}

type UserSummary = { id: string; email: string | null; displayName: string; role: AppRole }
const userFetcher = async (url: string): Promise<UserSummary> => {
  const response = await fetch(url)
  if (!response.ok) throw new Error("User profile could not be loaded.")
  return response.json()
}

export default function ClipsPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [newProjects, setNewProjects] = useState<(Project & { isNew?: boolean; isVisible?: boolean })[]>([])
  // Applicants start with no rows: their projects arrive from /api/projects, which is
  // already scoped to their own submissions, and an empty state is better than a flash.
  const { data: fetchedProjects, error: projectsError, mutate: mutateProjects } = useSWR<Project[]>("/api/projects", projectFetcher, { fallbackData: initialProjects, revalidateOnFocus: false })
  const { data: userProfile } = useSWR<UserSummary>("/api/me", userFetcher)
  const role = userProfile?.role
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set())
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [activeView, setActiveView] = useState<DashboardView>("projects")
  const [submissionOpen, setSubmissionOpen] = useState(false)
  const [pendingArchive, setPendingArchive] = useState<File | null>(null)
  const animatingRef = useRef(false)
  const [showContent, setShowContent] = useState(false)
  const mainRef = useRef<HTMLElement>(null)

  const projects = useMemo(() => fetchedProjects ?? [], [fetchedProjects])
  const isApplicant = role === "submitter"
  const isReviewerView = isReviewer(role)

  useEffect(() => {
    if (!userProfile) return
    const requestedView = new URLSearchParams(window.location.search).get("view") as DashboardView | null
    // Applicants cannot deep-link into reviewer views, even with a crafted URL.
    if (requestedView && canOpenView(userProfile.role, requestedView)) {
      setActiveView(requestedView)
      return
    }
    setActiveView("projects")
  }, [userProfile])

  useEffect(() => {
    const hasNewInvisible = newProjects.some((p) => p.isNew && !p.isVisible)
    if (hasNewInvisible && !animatingRef.current) {
      animatingRef.current = true
      const timer = setTimeout(() => {
        setNewProjects((prev) => prev.map((p) => (p.isNew && !p.isVisible ? { ...p, isVisible: true } : p)))
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [newProjects])

  useEffect(() => {
    const hasVisibleNew = newProjects.some((p) => p.isNew && p.isVisible)
    if (hasVisibleNew) {
      const timer = setTimeout(() => {
        setNewProjects((prev) => prev.map((p) => ({ ...p, isNew: false })))
        animatingRef.current = false
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [newProjects])

  useEffect(() => {
    if (!userProfile) return
    const supabase = createClient()
    const channel = supabase
      .channel("dashboard-projects")
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, () => {
        void mutateProjects()
      })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [userProfile, mutateProjects])

  const allProjects = useMemo(() => {
    const temporaryIds = new Set(newProjects.map((project) => project.id))
    return [...newProjects, ...projects.filter((project) => !temporaryIds.has(project.id))]
  }, [newProjects, projects])

  const handleProjectUpload = useCallback((file: File) => {
    // Opening the modal is the primary action, exactly like the header button.
    // Any ZIP already picked on the card is handed to the modal instead of lost.
    setPendingArchive(/\.zip$/i.test(file.name) ? file : null)
    setSubmissionOpen(true)
  }, [])

  const handleSubmissionSubmitted = useCallback((project: Project) => {
    setNewProjects((prev) => [{ ...project, isNew: true, isVisible: true }, ...prev])
    void mutateProjects((current = []) => [project, ...current.filter((p) => p.id !== project.id)], { revalidate: false })
    toast.success(`Analysed and saved ${project.fileCount} project files`)
  }, [mutateProjects])

  const handleRemoveFolder = useCallback((projectId: string) => {
    setRemovingIds((prev) => new Set(prev).add(projectId))
    setTimeout(() => {
      setNewProjects((prev) => prev.filter((p) => String(p.id) !== projectId))
      setRemovingIds((prev) => {
        const next = new Set(prev)
        next.delete(projectId)
        return next
      })
    }, 400)
  }, [])

  const handleFolderClick = useCallback((projectId: string) => {
    router.push(`/projects/${encodeURIComponent(projectId)}`)
  }, [router])

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 2000)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!isLoading) {
      const timer = setTimeout(() => {
        setShowContent(true)
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [isLoading])

  if (isLoading) {
    return <FullpageLoader duration={2000} />
  }

  const heading = isApplicant ? "My projects" : isReviewerView ? "Hackathon projects" : "Hackathon projects"
  const subheading = isApplicant
    ? allProjects.length
      ? "Your submissions and their review reports. Only you and the review panel can see these."
      : "Submit your first project archive to appear in front of the review panel."
    : null

  return (
    <div className="min-h-screen bg-[#FAF8F4]">
      <Toaster
        position="bottom-center"
        toastOptions={{
          style: {
            background: "#FFFFFF",
            border: "1px solid #E7DED1",
            color: "#2A2118",
            borderRadius: "12px",
            boxShadow: "0 8px 30px rgba(110,44,36,0.12)",
          },
        }}
      />

      <Sidebar activeView={activeView} onNavigate={setActiveView} projectCount={allProjects.length} userRole={role} userEmail={userProfile?.email || undefined} />

      <SubmissionModal
        open={submissionOpen}
        onClose={() => { setSubmissionOpen(false); setPendingArchive(null) }}
        onSubmitted={handleSubmissionSubmitted}
        initialArchive={pendingArchive}
      />

      <div
        className="transition-all duration-700 ease-out"
        style={{
          opacity: showContent ? 1 : 0,
          transform: showContent ? "translateY(0) scale(1)" : "translateY(20px) scale(0.98)",
        }}
      >
        <main ref={mainRef} className="min-h-screen px-4 pb-10 pt-6 sm:px-8 sm:pt-8 lg:ml-[248px]">
          <div className="mx-auto w-full max-w-[1180px]">
            {activeView === "projects" ? (
              <>
            <div className="mb-1 flex h-12 items-center justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <h1 className="text-xl font-semibold text-[#2A2118] tracking-tight">{heading}</h1>
                {projectsError && <span role="alert" className="truncate text-[11px] text-rose-600">R2 storage unavailable</span>}
              </div>
              {canSubmitProject(role) && (
                <button
                  className="text-sm font-medium text-white rounded-lg transition-colors py-1.5 bg-[#6E2C24] px-3 hover:bg-[#8A3B2A]"
                  onClick={() => setSubmissionOpen(true)}
                >
                  Upload project
                </button>
              )}
            </div>
            {subheading && <p className="mb-5 max-w-2xl text-xs leading-5 text-[#8C7B6A]">{subheading}</p>}
            {!subheading && <div className="mb-5 h-1" />}

            <div className="grid justify-items-start gap-6 sm:grid-cols-2 2xl:grid-cols-3">
              {canSubmitProject(role) && (
                <motion.div
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: 0.05, ease: [0.32, 0.72, 0, 1] }}
                >
                  <NewProjectSlot onFileSelected={handleProjectUpload} onOpen={() => { setPendingArchive(null); setSubmissionOpen(true) }} isAnalyzing={isAnalyzing} />
                </motion.div>
              )}
              {allProjects.length === 0 && (
                <div className="rounded-xl border border-dashed border-[#C9BFAE] bg-[#FAF8F4] px-5 py-8 text-sm text-[#8C7B6A]">
                  {isApplicant ? "You have not submitted a project yet. Use “Upload project” or drop a ZIP on the empty slot." : isReviewerView ? "No submissions are ready for review yet." : "No projects are available for this account."}
                </div>
              )}
              {allProjects.map((project, idx) => {
                const isRemoving = removingIds.has(String(project.id))
                // Only the owner (or an admin) gets edit/remove affordances on a folder.
                const canManage = canManageProject(role, userProfile?.id, project.ownerId)
                return (
                  <motion.div
                    key={project.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{
                      opacity: isRemoving ? 0 : 1,
                      scale: isRemoving ? 0.95 : 1,
                      y: 0,
                    }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{
                      duration: 0.35,
                      delay: Math.min(idx * 0.03, 0.3),
                      ease: [0.32, 0.72, 0, 1],
                      layout: { duration: 0.4, ease: [0.32, 0.72, 0, 1] },
                    }}
                  >
                    <ProjectFolder
                      project={project}
                      index={idx}
                      onRemove={canManage ? () => handleRemoveFolder(String(project.id)) : undefined}
                      onCancel={canManage ? () => handleRemoveFolder(String(project.id)) : undefined}
                      onClick={() => handleFolderClick(String(project.id))}
                    />
                  </motion.div>
                )
              })}
            </div>
              </>
            ) : activeView === "reports" ? (
              <ReportsView projects={allProjects} audience={isApplicant ? "applicant" : "reviewer"} />
            ) : activeView === "security" && canOpenView(role, "security") ? (
              <SecurityView projects={allProjects} />
            ) : activeView === "judges" && canOpenView(role, "judges") ? (
              <JudgesView />
            ) : activeView === "storage" && canOpenView(role, "storage") ? (
              <StorageView projects={allProjects} />
            ) : activeView === "audit" && canOpenView(role, "audit") ? (
              <AuditLogView />
            ) : (
              <ReportsView projects={allProjects} audience={isApplicant ? "applicant" : "reviewer"} />
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

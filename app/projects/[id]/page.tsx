"use client"

import { useParams, useRouter } from "next/navigation"
import useSWR from "swr"
import { ProjectRepository } from "@/components/project-repository"
import { Sidebar, type DashboardView } from "@/components/sidebar"
import type { Project } from "@/lib/data"

type UserSummary = { id: string; email: string | null; displayName: string; role: "submitter" | "judge" | "admin" }

const jsonFetcher = async <T,>(url: string): Promise<T> => {
  const response = await fetch(url)
  if (!response.ok) throw new Error("Project data could not be loaded.")
  return response.json()
}

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const projectId = params.id
  const { data: user } = useSWR<UserSummary>("/api/me", jsonFetcher)
  const { data: projects = [] } = useSWR<Project[]>("/api/projects", jsonFetcher)

  function navigate(view: DashboardView) {
    router.push(view === "projects" ? "/" : `/?view=${encodeURIComponent(view)}`)
  }

  return (
    <div className="min-h-screen bg-[#FAF8F4]">
      <Sidebar activeView="projects" onNavigate={navigate} projectCount={projects.length} userRole={user?.role} userEmail={user?.email || undefined} />
      <main className="min-h-screen px-4 pb-10 pt-6 sm:px-8 sm:pt-8 lg:ml-[248px]">
        <div className="mx-auto w-full max-w-[1180px]">
          <ProjectRepository projectId={projectId} />
        </div>
      </main>
    </div>
  )
}

"use client"

import { useRouter } from "next/navigation"
import Image from "next/image"
import { createClient } from "@/lib/supabase/client"
import type { AppRole } from "@/lib/supabase/auth-context"
import { canSubmitProject, isReviewer, viewsForRole, type DashboardView } from "@/lib/permissions"
import {
  Database,
  FileText,
  FolderOpen,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  Upload,
  Users,
  type LucideIcon,
} from "lucide-react"

export type { DashboardView } from "@/lib/permissions"

interface SidebarProps {
  activeView: DashboardView
  onNavigate: (view: DashboardView) => void
  projectCount: number
  userRole?: AppRole
  userEmail?: string
}

type NavItem = { label: string; view: DashboardView; icon: LucideIcon }
type NavGroup = { label: string; items: NavItem[] }

/** Applicant navigation: only their own submissions and their reports. */
const applicantGroups: NavGroup[] = [
  {
    label: "MY SUBMISSIONS",
    items: [
      { label: "My projects", view: "projects", icon: FolderOpen },
      { label: "My reports", view: "reports", icon: FileText },
    ],
  },
]

/** Reviewer navigation: every submission, reports, and security triage. */
const reviewerGroups: NavGroup[] = [
  {
    label: "REVIEW",
    items: [
      { label: "All submissions", view: "projects", icon: LayoutDashboard },
      { label: "Reports", view: "reports", icon: FileText },
      { label: "Security", view: "security", icon: ShieldCheck },
    ],
  },
]

const infrastructureGroup: NavGroup = {
  label: "INFRASTRUCTURE",
  items: [{ label: "Storage", view: "storage", icon: Database }],
}

const adminGroup: NavGroup = {
  label: "ADMIN",
  items: [{ label: "Judges", view: "judges", icon: Users }],
}

export function navigationGroupsForRole(role?: AppRole): NavGroup[] {
  const allowed = viewsForRole(role)
  const groups = role === "submitter" ? applicantGroups : reviewerGroups
  const candidates: NavGroup[] = [
    ...groups,
    ...(allowed.includes("storage") ? [infrastructureGroup] : []),
    ...(allowed.includes("judges") ? [adminGroup] : []),
  ]
  return candidates
    .map((group) => ({ ...group, items: group.items.filter((item) => allowed.includes(item.view)) }))
    .filter((group) => group.items.length > 0)
}

function roleLabel(role?: AppRole) {
  if (role === "admin") return "Administrator"
  if (role === "judge") return "Judge"
  if (role === "submitter") return "Applicant"
  return "Member"
}

function NavigationItems({ activeView, onNavigate, userRole }: Pick<SidebarProps, "activeView" | "onNavigate" | "userRole">) {
  const groups = navigationGroupsForRole(userRole)
  return (
    <nav aria-label="Dashboard navigation" className="flex min-w-0 gap-1 overflow-x-auto lg:flex-col lg:gap-6">
      {groups.map((group) => (
        <div key={group.label} className="flex shrink-0 items-center gap-1 lg:flex-col lg:items-stretch lg:gap-1">
          <p className="hidden px-3 pb-1 pt-2 text-[10px] font-semibold tracking-[0.14em] text-[#8C7B6A] lg:block">{group.label}</p>
          {group.items.map(({ label, view, icon: Icon }) => {
            const isActive = activeView === view
            return (
              <button
                key={view}
                type="button"
                aria-current={isActive ? "page" : undefined}
                onClick={() => onNavigate(view)}
                className={`flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-left text-[13px] font-medium transition-colors lg:w-full ${
                  isActive
                    ? "bg-[#6E2C24] text-white shadow-sm"
                    : "text-[#5D4037] hover:bg-[#F3EEE6] hover:text-[#2A2118]"
                }`}
              >
                <Icon className={`size-[17px] ${isActive ? "text-white" : "text-[#8C7B6A]"}`} strokeWidth={1.8} aria-hidden="true" />
                <span className="whitespace-nowrap">{label}</span>
              </button>
            )
          })}
        </div>
      ))}
    </nav>
  )
}

function Brand() {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl overflow-hidden border border-[#E7DED1] bg-[#FAF7F2]">
        <Image src="/logo-mark.png" alt="CEDA" width={28} height={28} className="size-7 object-contain" priority />
      </div>
      <div className="min-w-0">
        <p className="text-[14px] font-semibold tracking-[-0.02em] text-[#2A2118]">CEDA</p>
        <p className="truncate text-[10px] text-[#8C7B6A]">Hackathon workspace</p>
      </div>
    </div>
  )
}

/** The workspace card describes the applicant's own space, not the review queue. */
function WorkspaceCard({ userRole, projectCount }: { userRole?: AppRole; projectCount: number }) {
  const isApplicant = userRole === "submitter"
  const subtitle = isApplicant
    ? `Your submissions · ${projectCount} project${projectCount === 1 ? "" : "s"}`
    : userRole === "admin"
      ? "Submission review · all projects"
      : "Submission review"
  return (
    <div role="group" aria-label="Current workspace" className="mx-4 mt-5 flex items-center gap-3 rounded-xl border border-[#E7DED1] bg-[#FAF8F4] px-3 py-3 text-left">
      <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#8A3B2A] to-[#6E2C24] text-[11px] font-semibold text-white">{isApplicant ? "M" : "H"}</div>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] font-medium text-[#2A2118]">{isApplicant ? "My workspace" : "Hackathon 2026"}</span>
        <span className="block truncate text-[10px] text-[#8C7B6A]">{subtitle}</span>
      </span>
      <span className="text-[9px] font-medium uppercase tracking-[0.12em] text-[#0F9B8E]">Active</span>
    </div>
  )
}

function StorageFooter({ userRole, projectCount }: { userRole?: AppRole; projectCount: number }) {
  const isApplicant = userRole === "submitter"
  const Icon = isApplicant ? Upload : Database
  const title = isApplicant ? "Your files" : "R2 bucket"
  const detail = isApplicant
    ? `${projectCount} archive${projectCount === 1 ? "" : "s"} · private`
    : `ceda · ${projectCount} projects`
  return (
    <div className="flex items-center gap-3 rounded-xl bg-[#FAF8F4] px-3 py-3">
      <div className="flex size-8 items-center justify-center rounded-lg border border-[#E7DED1] bg-white text-[#0F9B8E]">
        <Icon className="size-4" strokeWidth={1.8} aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium text-[#2A2118]">{title}</p>
        <p className="truncate text-[10px] text-[#8C7B6A]">{detail}</p>
      </div>
      <span className="size-1.5 rounded-full bg-[#0F9B8E]" aria-label="Storage configured" />
    </div>
  )
}

export function Sidebar({ activeView, onNavigate, projectCount, userRole, userEmail }: SidebarProps) {
  const router = useRouter()
  const isApplicant = userRole === "submitter"

  const handleSignOut = async () => {
    await createClient().auth.signOut()
    router.replace("/login")
    router.refresh()
  }

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col border-r border-[#E7DED1] bg-white lg:flex">
        <div className="flex h-[72px] items-center border-b border-[#E7DED1] px-5">
          <Brand />
        </div>

        <WorkspaceCard userRole={userRole} projectCount={projectCount} />

        <div className="flex-1 overflow-y-auto px-3 py-5">
          <NavigationItems activeView={activeView} onNavigate={onNavigate} userRole={userRole} />
        </div>

        <div className="border-t border-[#E7DED1] p-4">
          <StorageFooter userRole={userRole} projectCount={projectCount} />
          <div className="mt-3 flex items-center gap-2 px-1">
            <p className="min-w-0 flex-1 truncate text-[10px] text-[#8C7B6A]">
              <span className="block truncate text-[#5D4037]">{roleLabel(userRole)}</span>
              <span className="block truncate">{userEmail || "Signed in"}</span>
            </p>
            <button type="button" onClick={handleSignOut} aria-label="Sign out" className="rounded-md p-1.5 text-[#8C7B6A] transition-colors hover:bg-[#F3EEE6] hover:text-[#2A2118]">
              <LogOut className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-30 border-b border-[#E7DED1] bg-white/95 px-4 py-3 backdrop-blur-xl lg:hidden">
        <div className="mb-3 flex items-center justify-between gap-3">
          <Brand />
          <div className="flex shrink-0 items-center gap-2">
            <span className="flex items-center gap-1.5 text-[10px] text-[#8C7B6A]">{isApplicant ? <Upload className="size-3.5" aria-hidden="true" /> : <Database className="size-3.5" aria-hidden="true" />} {isApplicant ? roleLabel(userRole) : "ceda"}</span>
            {isReviewer(userRole) && !canSubmitProject(userRole) && <span className="text-[9px] uppercase tracking-[0.12em] text-[#B85621]">Review</span>}
            <button type="button" onClick={handleSignOut} aria-label="Sign out" className="rounded-md p-1.5 text-[#8C7B6A] hover:bg-[#F3EEE6] hover:text-[#2A2118]"><LogOut className="size-3.5" aria-hidden="true" /></button>
          </div>
        </div>
        <NavigationItems activeView={activeView} onNavigate={onNavigate} userRole={userRole} />
      </header>
    </>
  )
}

export interface Project {
  id: string
  title: string
  clipCount: number
  createdAt: string
  images: string[]
  isGenerating?: boolean
  progress?: number
  eta?: string
  isFailed?: boolean
  previewKind?: "frontend" | "backend" | "fullstack" | "architecture" | "technical"
  snippets?: Array<{ fileName: string; code: string }>
  technologies?: string[]
  fileCount?: number
  fileNames?: string[]
  developer?: string
  processingStatus?: string
  securityStatus?: string
  storedInR2?: boolean
  ownerId?: string
  folderKey?: string
  status?: "submitted" | "review" | "feedback" | "approved" | "awarded" | "rejected"
  projectUrl?: string
  /** Applicant-written idea summary captured at submission time. */
  summary?: string
  screenshots?: string[]
  documentationFiles?: Array<{ name: string; url: string; size: number }>
  /** Present when the applicant attached a verified source archive (ZIP). */
  sourceArchive?: { url: string; name: string; size: number }
  aiReport?: {
    languages: string[]
    frameworks: string[]
    databases: string[]
    apisAndIntegrations: string[]
    purpose: string
    architecture: string
    strengths: string[]
    functionality: string
    buildVerification: string
    codeQuality: string
    capabilityScore: number
    technicalComplexity: "Starter" | "Intermediate" | "Advanced"
    originalityAssessment: string
    judgeSummary: string
    securityReviewNotes: string[]
  }
  securityFindings?: Array<{ severity: "high" | "medium" | "low"; title: string; detail: string; file?: string }>
  dependencyFindings?: Array<{ package: string; version: string; id: string; summary: string; severity: string }>
}

export const projects: Project[] = []

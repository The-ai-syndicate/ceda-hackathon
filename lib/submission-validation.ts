/**
 * Mandatory-field contract for idea submissions. Shared by the submission UI
 * (to show a live checklist and disable submit) and the `/api/analyze` route
 * (to reject incomplete or tampered payloads). Client checks are a convenience;
 * the server is the authority.
 *
 * Submissions are idea-first: applicants describe and illustrate the idea with a
 * link, screenshots, and documentation. A source archive (ZIP) is optional and,
 * when supplied, is verified server-side before it is stored and summarised.
 */
export const SUBMISSION_LIMITS = {
  screenshotMaxCount: 8,
  screenshotMaxBytes: 8 * 1024 * 1024,
  documentationMaxCount: 10,
  documentationMaxBytes: 15 * 1024 * 1024,
  titleMin: 3,
  titleMax: 120,
  summaryMin: 80,
  summaryMax: 2000,
  /** Source archives are optional, but at most one may be attached. */
  archiveMaxCount: 1,
  archiveMaxBytes: 40 * 1024 * 1024,
} as const

export type SubmissionField =
  | "title"
  | "summary"
  | "projectUrl"
  | "screenshots"
  | "documentation"
  | "archive"
  | "declaration"

export type SubmissionDraft = {
  title: string
  summary: string
  projectUrl: string
  screenshotCount: number
  documentationCount: number
  /** 0 or 1 — the source archive is optional. */
  archiveCount?: number
  declared: boolean
}

export type SubmissionIssue = { field: SubmissionField; message: string }

const URL_PATTERN = /^https?:\/\/[^\s]+$/i

/**
 * Returns every unmet requirement. An empty array means the draft is complete
 * and safe to submit. Order matches the visual checklist.
 */
export function validateSubmissionDraft(draft: SubmissionDraft): SubmissionIssue[] {
  const issues: SubmissionIssue[] = []
  const title = draft.title.trim()
  const summary = draft.summary.trim()
  const projectUrl = draft.projectUrl.trim()

  if (title.length < SUBMISSION_LIMITS.titleMin) {
    issues.push({ field: "title", message: `Title must be at least ${SUBMISSION_LIMITS.titleMin} characters.` })
  } else if (title.length > SUBMISSION_LIMITS.titleMax) {
    issues.push({ field: "title", message: `Title must be ${SUBMISSION_LIMITS.titleMax} characters or fewer.` })
  }

  if (summary.length < SUBMISSION_LIMITS.summaryMin) {
    issues.push({ field: "summary", message: `Summary must be at least ${SUBMISSION_LIMITS.summaryMin} characters so reviewers can assess the idea.` })
  } else if (summary.length > SUBMISSION_LIMITS.summaryMax) {
    issues.push({ field: "summary", message: `Summary must be ${SUBMISSION_LIMITS.summaryMax} characters or fewer.` })
  }

  if (!projectUrl) {
    issues.push({ field: "projectUrl", message: "A project link is required." })
  } else if (!URL_PATTERN.test(projectUrl)) {
    issues.push({ field: "projectUrl", message: "Project link must be a valid http(s) URL." })
  }

  if (draft.screenshotCount < 1) {
    issues.push({ field: "screenshots", message: "At least one screenshot is required." })
  } else if (draft.screenshotCount > SUBMISSION_LIMITS.screenshotMaxCount) {
    issues.push({ field: "screenshots", message: `Upload at most ${SUBMISSION_LIMITS.screenshotMaxCount} screenshots.` })
  }

  if (draft.documentationCount < 1) {
    issues.push({ field: "documentation", message: "At least one documentation file is required." })
  } else if (draft.documentationCount > SUBMISSION_LIMITS.documentationMaxCount) {
    issues.push({ field: "documentation", message: `Upload at most ${SUBMISSION_LIMITS.documentationMaxCount} documentation files.` })
  }

  // The archive is optional; only an excess count is a violation.
  const archiveCount = draft.archiveCount ?? 0
  if (archiveCount > SUBMISSION_LIMITS.archiveMaxCount) {
    issues.push({ field: "archive", message: "Attach only one source archive." })
  }

  if (!draft.declared) {
    issues.push({ field: "declaration", message: "You must confirm the declaration before submitting." })
  }

  return issues
}

/** Convenience predicate for UI state. */
export function isSubmissionComplete(draft: SubmissionDraft): boolean {
  return validateSubmissionDraft(draft).length === 0
}

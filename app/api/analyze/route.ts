import { NextResponse } from "next/server"
import {
  buildIdeaProject,
  createIdeaIntelligence,
  ideaReportFallback,
  readDocumentationExcerpts,
} from "@/lib/idea-intelligence"
import { applicantAlertRecipients, sendEmail, submissionAlertEmail } from "@/lib/email"
import { deleteStoredProject, persistProject, type SubmissionAssets } from "@/lib/r2-storage"
import { ArchiveRejectedError, ARCHIVE_LIMITS, describeArchive, hasZipSignature, inspectSourceArchive } from "@/lib/source-archive"
import { REVIEW_ENGINE_LABEL } from "@/lib/review-engine"
import { getAuthContext } from "@/lib/supabase/auth-context"
import { SUBMISSION_LIMITS, validateSubmissionDraft } from "@/lib/submission-validation"

export const runtime = "nodejs"
export const maxDuration = 60

const MAX_ATTACHMENT_BYTES =
  SUBMISSION_LIMITS.screenshotMaxBytes * SUBMISSION_LIMITS.screenshotMaxCount +
  SUBMISSION_LIMITS.documentationMaxBytes * SUBMISSION_LIMITS.documentationMaxCount +
  ARCHIVE_LIMITS.maxBytes

/** Notifies the applicant and the admin mailbox that a submission was received. */
async function sendApplicantAlert(input: {
  request: Request
  ownerEmail: string
  projectTitle: string
  projectId: string
  developer?: string
  projectUrl?: string
  screenshotCount: number
  documentationCount: number
  capabilityScore?: number
  judgeSummary?: string
  ideaSummary?: string
}) {
  try {
    const recipients = applicantAlertRecipients(input.ownerEmail)
    if (!recipients.length) return
    const origin = new URL(input.request.url).origin
    const message = submissionAlertEmail({
      projectTitle: input.projectTitle,
      projectId: input.projectId,
      developer: input.developer,
      ownerEmail: input.ownerEmail,
      projectUrl: input.projectUrl,
      screenshotCount: input.screenshotCount,
      documentationCount: input.documentationCount,
      capabilityScore: input.capabilityScore,
      judgeSummary: input.judgeSummary,
      ideaSummary: input.ideaSummary,
      dashboardUrl: `${origin}/projects/${input.projectId}`,
    })
    await sendEmail({ to: recipients, subject: message.subject, html: message.html, text: message.text })
  } catch {
    // An alert failure must never fail the submission itself.
  }
}

export async function POST(request: Request) {
  const auth = await getAuthContext()
  if (!auth.user || !auth.profile) return NextResponse.json({ error: "Sign in before submitting an idea." }, { status: 401 })
  if (auth.profile.role !== "submitter" && auth.profile.role !== "admin") return NextResponse.json({ error: "This account cannot submit ideas." }, { status: 403 })

  const contentLength = Number(request.headers.get("content-length") || 0)
  if (contentLength > MAX_ATTACHMENT_BYTES) {
    const totalMb = Math.round(MAX_ATTACHMENT_BYTES / (1024 * 1024))
    return NextResponse.json({ error: `Attachments must total ${totalMb} MB or less.` }, { status: 413 })
  }

  try {
    const form = await request.formData()

    const projectUrl = typeof form.get("projectUrl") === "string" ? String(form.get("projectUrl")).trim() : undefined
    if (projectUrl && !/^https?:\/\//i.test(projectUrl)) return NextResponse.json({ error: "Project link must be a valid http(s) URL." }, { status: 400 })

    const title = typeof form.get("title") === "string" ? String(form.get("title")).trim() : ""
    const summary = typeof form.get("summary") === "string" ? String(form.get("summary")).trim() : ""
    const declared = form.get("declared") === "true"

    const screenshotFiles = form.getAll("screenshots").filter((entry): entry is File => entry instanceof File)
    const docFiles = form.getAll("documentation").filter((entry): entry is File => entry instanceof File)
    const archiveFiles = form.getAll("archive").filter((entry): entry is File => entry instanceof File)

    // Server-side authority for the mandatory-field contract. The UI mirrors
    // this list, but a crafted request must never register an incomplete idea.
    const issues = validateSubmissionDraft({
      title,
      summary,
      projectUrl: projectUrl ?? "",
      screenshotCount: screenshotFiles.length,
      documentationCount: docFiles.length,
      archiveCount: archiveFiles.length,
      declared,
    })
    if (issues.length) {
      return NextResponse.json({ error: issues[0].message, issues }, { status: 422 })
    }
    const oversizedScreenshot = screenshotFiles.find((file) => file.size > SUBMISSION_LIMITS.screenshotMaxBytes)
    if (oversizedScreenshot) return NextResponse.json({ error: `"${oversizedScreenshot.name}" exceeds the 8 MB screenshot limit.` }, { status: 413 })
    const oversizedDoc = docFiles.find((file) => file.size > SUBMISSION_LIMITS.documentationMaxBytes)
    if (oversizedDoc) return NextResponse.json({ error: `"${oversizedDoc.name}" exceeds the 15 MB document limit.` }, { status: 413 })
    const notAnImage = screenshotFiles.find((file) => !file.type.startsWith("image/"))
    if (notAnImage) return NextResponse.json({ error: `"${notAnImage.name}" is not an image file. Upload screenshots as PNG, JPG, or WebP.` }, { status: 422 })

    const screenshotBytes = await Promise.all(screenshotFiles.map(async (file) => new Uint8Array(await file.arrayBuffer())))
    const docBytes = await Promise.all(docFiles.map(async (file) => new Uint8Array(await file.arrayBuffer())))

    // The archive is optional, but a file that claims to be a ZIP must actually
    // be one. Verify by magic bytes + a real unzip before storing or summarizing.
    let archiveSummary: Awaited<ReturnType<typeof inspectSourceArchive>> | undefined
    let archiveAsset: { name: string; bytes: Uint8Array } | undefined
    const archiveFile = archiveFiles[0]
    if (archiveFile) {
      if (archiveFile.size > ARCHIVE_LIMITS.maxBytes) {
        return NextResponse.json(
          { error: `The source archive must be ${Math.round(ARCHIVE_LIMITS.maxBytes / (1024 * 1024))} MB or smaller.` },
          { status: 413 },
        )
      }
      const archiveBytes = new Uint8Array(await archiveFile.arrayBuffer())
      if (!hasZipSignature(archiveBytes)) {
        return NextResponse.json(
          { error: "That file is not a valid ZIP archive. Export your project folder as a .zip and try again." },
          { status: 422 },
        )
      }
      try {
        archiveSummary = await inspectSourceArchive(archiveBytes)
      } catch (error) {
        if (error instanceof ArchiveRejectedError) {
          return NextResponse.json({ error: error.message }, { status: 422 })
        }
        throw error
      }
      archiveAsset = { name: archiveFile.name, bytes: archiveBytes }
    }

    const assets: SubmissionAssets = {
      screenshots: screenshotFiles.map((file, index) => ({ name: file.name, bytes: screenshotBytes[index], contentType: file.type || "image/png" })),
      documentation: docFiles.map((file, index) => ({ name: file.name, bytes: docBytes[index], contentType: file.type || "application/octet-stream", size: file.size })),
      archive: archiveAsset,
    }

    const excerpts = readDocumentationExcerpts(assets.documentation!.map((document) => ({ name: document.name, bytes: document.bytes })))
    let aiReport = ideaReportFallback
    let aiStatus: string = `${REVIEW_ENGINE_LABEL} unavailable`
    try {
      aiReport = await createIdeaIntelligence({
        title,
        summary,
        projectUrl,
        screenshotCount: screenshotFiles.length,
        documentation: assets.documentation!.map((document) => ({
          name: document.name,
          size: document.size,
          text: excerpts.find((excerpt) => excerpt.name === document.name)?.text,
        })),
        archive: archiveSummary,
      })
      aiStatus = `${REVIEW_ENGINE_LABEL} complete`
    } catch {
      aiStatus = `${REVIEW_ENGINE_LABEL} unavailable`
    }

    const attachmentNote = `${screenshotFiles.length} screenshot${screenshotFiles.length === 1 ? "" : "s"} · ${docFiles.length} document${docFiles.length === 1 ? "" : "s"}`
    const archiveNote = archiveSummary ? ` · ${describeArchive(archiveSummary)}` : ""

    const project = buildIdeaProject({
      title,
      summary,
      projectUrl,
      developer: auth.profile.display_name || auth.user.email || "CEDA applicant",
      report: aiReport,
      processingStatus: `${attachmentNote}${archiveNote} · ${aiStatus}`,
      archive: archiveSummary
        ? { fileCount: archiveSummary.fileCount, fileNames: archiveSummary.fileNames }
        : undefined,
    })

    try {
      const storedProject = await persistProject(project, assets)
      const { error: registryError } = await auth.supabase.from("projects").insert({
        id: project.id,
        owner_id: auth.user.id,
        title: project.title,
        developer: project.developer || "",
        folder_key: `projects/${project.id}/`,
      })
      if (registryError) {
        await deleteStoredProject(project.id).catch(() => undefined)
        return NextResponse.json({ error: "The submission could not be registered for review. Please retry." }, { status: 503 })
      }
      await sendApplicantAlert({
        request,
        ownerEmail: auth.user.email ?? "",
        projectTitle: project.title,
        projectId: project.id,
        developer: project.developer,
        projectUrl,
        screenshotCount: assets.screenshots!.length,
        documentationCount: assets.documentation!.length,
        capabilityScore: aiReport.capabilityScore,
        judgeSummary: aiReport.judgeSummary,
        ideaSummary: summary,
      })
      return NextResponse.json({ project: { ...storedProject, ownerId: auth.user.id, folderKey: `projects/${project.id}/`, status: "submitted" } })
    } catch (error) {
      // Surface the underlying cause in the server log; the client only needs the
      // retryable message. Without this the failure is invisible in production.
      console.error("[analyze] storage/registry step failed", {
        projectId: project.id,
        name: error instanceof Error ? error.name : typeof error,
        message: error instanceof Error ? error.message : String(error),
        code: (error as { Code?: string })?.Code,
        // The originating frame is what identifies the failing call; without it
        // this log only ever shows the symptom (e.g. a Buffer.from type error).
        stack: error instanceof Error ? error.stack : undefined,
      })
      return NextResponse.json({ error: "This submission could not be saved for judging. Please retry." }, { status: 503 })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not process this submission."
    const status = /must be|too many|exceeds|not an image/i.test(message) ? 422 : 400
    return NextResponse.json({ error: message }, { status })
  }
}

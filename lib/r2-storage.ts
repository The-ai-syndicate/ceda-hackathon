import {
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"
import type { Project } from "@/lib/data"

const R2_ACCOUNT_ID = "ad21c08348579151eca8d11ee8f07d01"
const R2_BUCKET = "ceda"
const PROJECT_PREFIX = "projects/"

let client: S3Client | undefined

function getR2Client() {
  if (client) return client
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  if (!accessKeyId || !secretAccessKey) throw new Error("R2 object-storage credentials are unavailable.")
  client = new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
  })
  return client
}

const projectPrefix = (projectId: string) => `${PROJECT_PREFIX}${projectId}/`

export interface SubmissionAssets {
  screenshots?: Array<{ name: string; bytes: Uint8Array; contentType: string }>
  documentation?: Array<{ name: string; bytes: Uint8Array; contentType: string; size: number }>
  /** Verified source archive; stored once as `source.zip` in the project folder. */
  archive?: { name: string; bytes: Uint8Array }
}

/**
 * `transformToByteArray()` yields a Uint8Array in browsers but a Node Buffer in
 * server runtimes, and the AWS SDK also accepts plain ArrayBuffers. Round-tripping
 * through the shared ArrayBuffer view makes the upload identical either way.
 */
const toBody = (bytes: ArrayBufferView | ArrayBuffer) => Buffer.from(
  bytes instanceof ArrayBuffer
    ? new Uint8Array(bytes)
    : new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength),
)

export async function persistProject(project: Project, assets: SubmissionAssets = {}): Promise<Project> {
  const r2 = getR2Client()
  const prefix = projectPrefix(project.id)
  const storedImages = await Promise.all(project.images.map(async (image, index) => {
    const match = /^data:image\/webp;base64,([A-Za-z0-9+/=]+)$/.exec(image)
    if (!match) throw new Error("Project preview image format is invalid.")
    const key = `${prefix}previews/${String(index + 1).padStart(2, "0")}.webp`
    await r2.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: Buffer.from(match[1], "base64"),
      ContentType: "image/webp",
      CacheControl: "private, max-age=3600",
    }))
    return `/api/projects/${encodeURIComponent(project.id)}/previews/${index}`
  }))

  const storedScreenshots = await Promise.all((assets.screenshots || []).map(async (screenshot, index) => {
    const ext = screenshot.contentType.split("/")[1] || "png"
    const key = `${prefix}screenshots/${String(index + 1).padStart(2, "0")}.${ext}`
    await r2.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: toBody(screenshot.bytes),
      ContentType: screenshot.contentType,
      CacheControl: "private, max-age=3600",
    }))
    return `/api/projects/${encodeURIComponent(project.id)}/screenshots/${index}`
  }))

  const storedDocs = await Promise.all((assets.documentation || []).map(async (doc, index) => {
    const key = `${prefix}docs/${index}-${doc.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`
    await r2.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: toBody(doc.bytes),
      ContentType: doc.contentType,
      CacheControl: "private, max-age=3600",
    }))
    return { name: doc.name, url: `/api/projects/${encodeURIComponent(project.id)}/docs/${index}`, size: doc.size }
  }))

  const storedProject: Project = {
    ...project,
    images: storedImages,
    screenshots: storedScreenshots,
    documentationFiles: storedDocs,
    storedInR2: true,
  }

  // The archive is uploaded before project.json so the pointer file never
  // advertises a repository that was not successfully stored.
  if (assets.archive) {
    if (!assets.archive.bytes.byteLength) throw new Error("Source archive is empty.")
    await r2.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: `${prefix}source.zip`,
      Body: toBody(assets.archive.bytes),
      ContentType: "application/zip",
      CacheControl: "private, no-store",
      Metadata: { originalName: encodeURIComponent(assets.archive.name).slice(0, 200) },
    }))
    storedProject.sourceArchive = {
      url: `/api/projects/${encodeURIComponent(project.id)}/repository`,
      name: assets.archive.name,
      size: assets.archive.bytes.byteLength,
    }
  }

  await r2.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: `${prefix}project.json`,
    Body: JSON.stringify(storedProject),
    ContentType: "application/json; charset=utf-8",
    CacheControl: "private, no-store",
  }))
  return storedProject
}

export async function listStoredProjects(): Promise<Project[]> {
  const r2 = getR2Client()
  const prefixes: string[] = []
  let continuationToken: string | undefined
  do {
    const page = await r2.send(new ListObjectsV2Command({
      Bucket: R2_BUCKET,
      Prefix: PROJECT_PREFIX,
      Delimiter: "/",
      MaxKeys: 1000,
      ContinuationToken: continuationToken,
    }))
    prefixes.push(...(page.CommonPrefixes || []).flatMap((item) => item.Prefix ? [item.Prefix] : []))
    continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined
  } while (continuationToken && prefixes.length < 200)

  const projects: Project[] = []
  for (let index = 0; index < Math.min(prefixes.length, 200); index += 8) {
    const batch = await Promise.all(prefixes.slice(index, index + 8).map(async (prefix) => {
      try {
        const result = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: `${prefix}project.json` }))
        if (!result.Body) return null
        const project = JSON.parse(await result.Body.transformToString("utf-8")) as Project
        return project && typeof project.id === "string" && project.id.startsWith("submission-") ? project : null
      } catch {
        return null
      }
    }))
    projects.push(...batch.filter((project): project is Project => project !== null))
  }
  return projects.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function getStoredPreview(projectId: string, previewIndex: number) {
  const result = await getR2Client().send(new GetObjectCommand({
    Bucket: R2_BUCKET,
    Key: `${projectPrefix(projectId)}previews/${String(previewIndex + 1).padStart(2, "0")}.webp`,
  }))
  if (!result.Body) throw new Error("Preview not found.")
  return {
    body: await result.Body.transformToByteArray(),
    contentType: result.ContentType || "image/webp",
  }
}

export async function getStoredScreenshot(projectId: string, index: number) {
  const prefix = projectPrefix(projectId)
  const list = await getR2Client().send(new ListObjectsV2Command({ Bucket: R2_BUCKET, Prefix: `${prefix}screenshots/`, MaxKeys: 20 }))
  const keys = (list.Contents || []).map((item) => item.Key).filter((key): key is string => Boolean(key))
  const key = keys.sort()[index]
  if (!key) throw new Error("Screenshot not found.")
  const result = await getR2Client().send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }))
  if (!result.Body) throw new Error("Screenshot not found.")
  return {
    body: await result.Body.transformToByteArray(),
    contentType: result.ContentType || "image/png",
  }
}

export async function getStoredDoc(projectId: string, index: number) {
  const prefix = projectPrefix(projectId)
  const list = await getR2Client().send(new ListObjectsV2Command({ Bucket: R2_BUCKET, Prefix: `${prefix}docs/`, MaxKeys: 20 }))
  const keys = (list.Contents || []).map((item) => item.Key).filter((key): key is string => Boolean(key))
  const key = keys.sort()[index]
  if (!key) throw new Error("Document not found.")
  const result = await getR2Client().send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }))
  if (!result.Body) throw new Error("Document not found.")
  return {
    body: await result.Body.transformToByteArray(),
    contentType: result.ContentType || "application/octet-stream",
    fileName: key.split("/").pop()?.replace(/^\d+-/, "") || "document",
  }
}

export async function getStoredSourceZip(projectId: string) {
  const result = await getR2Client().send(new GetObjectCommand({
    Bucket: R2_BUCKET,
    Key: `${projectPrefix(projectId)}source.zip`,
  }))
  if (!result.Body) throw new Error("Source archive not found.")
  return { body: await result.Body.transformToByteArray(), contentType: "application/zip" }
}

export async function getStoredProject(projectId: string): Promise<Project | null> {
  const result = await getR2Client().send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: `${projectPrefix(projectId)}project.json` }))
  if (!result.Body) return null
  const project = JSON.parse(await result.Body.transformToString("utf-8")) as Project
  return project.id === projectId ? { ...project, storedInR2: true } : null
}

export async function deleteStoredProject(projectId: string) {
  const r2 = getR2Client()
  const prefix = projectPrefix(projectId)
  const result = await r2.send(new ListObjectsV2Command({ Bucket: R2_BUCKET, Prefix: prefix, MaxKeys: 1000 }))
  const objects = (result.Contents || []).flatMap((item) => item.Key ? [{ Key: item.Key }] : [])
  if (objects.length) await r2.send(new DeleteObjectsCommand({ Bucket: R2_BUCKET, Delete: { Objects: objects } }))
}

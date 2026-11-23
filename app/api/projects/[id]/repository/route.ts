import { NextResponse } from "next/server"
import JSZip from "jszip"
import { getStoredSourceZip } from "@/lib/r2-storage"
import { requireProjectAccess } from "@/lib/supabase/project-access"
import { hasZipSignature } from "@/lib/source-archive"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Reads the stored `source.zip` for a project and exposes a browsable file tree.
 *
 * Without `?path=` the route returns the file listing. With `?path=` it returns
 * that single entry's text content. Every request passes through
 * requireProjectAccess, so an applicant can only browse their own submission
 * while reviewers and admins may browse any project.
 */

type FileKind = "text" | "image" | "binary"

type RepositoryFile = {
  path: string
  size: number
  kind: FileKind
}

const SKIP_SEGMENT = /(^|\/)(?:node_modules|\.git|\.next|dist|build|vendor|__pycache__|coverage|\.venv|venv|target|\.DS_Store)(\/|$)/i
const IMAGE_EXTENSION = /\.(?:png|jpe?g|gif|webp|avif|bmp|ico|svg)$/i
const BINARY_EXTENSION = /\.(?:zip|gz|tgz|bz2|xz|7z|rar|pdf|docx?|xlsx?|pptx?|exe|dll|so|dylib|bin|class|jar|woff2?|ttf|otf|eot|mp[34]|mov|avi|mkv|webm|psd|ai|sketch|fig|db|sqlite3?)$/i

/** Files larger than this are listed but never decoded for the viewer. */
const MAX_LISTED_ENTRIES = 2000
const MAX_TEXT_BYTES = 512 * 1024
const MAX_TEXT_CHARS = 200_000

function classify(path: string): FileKind {
  if (IMAGE_EXTENSION.test(path)) return "image"
  if (BINARY_EXTENSION.test(path)) return "binary"
  return "text"
}

/** Rejects paths that would escape the archive or point at an unlisted entry. */
function normalizeArchivePath(rawPath: string): string | null {
  if (!rawPath || rawPath.length > 1024) return null
  const cleaned = rawPath.replace(/\\/g, "/").replace(/^\/+/, "")
  if (!cleaned || cleaned.includes("\0")) return null
  const segments = cleaned.split("/")
  if (segments.some((segment) => segment === ".." || segment === ".")) return null
  if (SKIP_SEGMENT.test(cleaned)) return null
  return cleaned
}

async function loadArchive(projectId: string) {
  const stored = await getStoredSourceZip(projectId)
  const bytes = stored.body
  if (!bytes.byteLength || !hasZipSignature(bytes)) throw new Error("Stored archive is not a valid ZIP file.")
  return JSZip.loadAsync(bytes, { checkCRC32: false })
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^submission-[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Repository not found." }, { status: 404 })
  }

  const access = await requireProjectAccess(id, "Repository not found.")
  if (!access.ok) return access.response

  const requestedPath = new URL(request.url).searchParams.get("path")

  let archive: JSZip
  try {
    archive = await loadArchive(id)
  } catch {
    return NextResponse.json(
      { error: "No source archive has been stored for this project." },
      { status: 404, headers: { "Cache-Control": "private, no-store" } },
    )
  }

  const entries = Object.values(archive.files).filter((entry) => !entry.dir && !SKIP_SEGMENT.test(entry.name))

  // Directory listing.
  if (!requestedPath) {
    const files: RepositoryFile[] = entries
      .map((entry) => {
        const size = (entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize
        return {
          path: entry.name,
          size: typeof size === "number" ? size : 0,
          kind: classify(entry.name),
        }
      })
      .sort((a, b) => a.path.localeCompare(b.path))
      .slice(0, MAX_LISTED_ENTRIES)

    return NextResponse.json(
      { files, selected: null },
      { headers: { "Cache-Control": "private, no-store" } },
    )
  }

  // Single file contents.
  const safePath = normalizeArchivePath(requestedPath)
  if (!safePath) return NextResponse.json({ error: "File not found." }, { status: 404 })

  const entry = archive.file(safePath)
  if (!entry || entry.dir) return NextResponse.json({ error: "File not found." }, { status: 404 })

  const kind = classify(safePath)
  const declaredSize = (entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize
  const size = typeof declaredSize === "number" ? declaredSize : 0

  if (kind !== "text") {
    return NextResponse.json(
      { files: [], selected: { path: safePath, size, kind, content: null, truncated: false } },
      { headers: { "Cache-Control": "private, no-store" } },
    )
  }

  if (size > MAX_TEXT_BYTES) {
    return NextResponse.json(
      { files: [], selected: { path: safePath, size, kind, content: null, truncated: true } },
      { headers: { "Cache-Control": "private, no-store" } },
    )
  }

  try {
    const text = await entry.async("string")
    return NextResponse.json(
      {
        files: [],
        selected: {
          path: safePath,
          size,
          kind,
          content: text.slice(0, MAX_TEXT_CHARS),
          truncated: text.length > MAX_TEXT_CHARS,
        },
      },
      { headers: { "Cache-Control": "private, no-store" } },
    )
  } catch {
    return NextResponse.json({ error: "This file could not be read." }, { status: 422 })
  }
}

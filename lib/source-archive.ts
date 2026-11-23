import JSZip from "jszip"

/**
 * Server-side inspection of an uploaded source archive.
 *
 * The client can name a file `project.zip` while uploading anything at all, so
 * every archive is verified by its magic bytes and a real unzip attempt before
 * it is stored or described to reviewers. Nothing here trusts the file name.
 */

export const ARCHIVE_LIMITS = {
  /** Largest archive the submission form accepts. */
  maxBytes: 40 * 1024 * 1024,
  /** Guard against zip bombs: refuse archives expanding past this. */
  maxUncompressedBytes: 250 * 1024 * 1024,
  maxEntryCount: 5000,
  /** Deepest directory level we are willing to walk. */
  maxDepth: 12,
} as const

/** ZIP local-file-header signature, plus the empty-archive form of it. */
const ZIP_SIGNATURES: ReadonlyArray<readonly number[]> = [
  [0x50, 0x4b, 0x03, 0x04],
  [0x50, 0x4b, 0x05, 0x06],
  [0x50, 0x4b, 0x07, 0x08],
]

export function hasZipSignature(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 4) return false
  return ZIP_SIGNATURES.some((signature) => signature.every((byte, index) => bytes[index] === byte))
}

const SKIP_SEGMENT = /(^|\/)(?:node_modules|\.git|\.next|dist|build|vendor|__pycache__|coverage|\.venv|venv|target)(\/|$)/i
const NOISE_FILE = /(^|\/)(?:package-lock\.json|yarn\.lock|pnpm-lock\.yaml|\.DS_Store)$/i
const SOURCE_EXTENSIONS = /\.(?:tsx?|jsx?|mjs|cjs|py|rb|go|rs|java|kt|swift|php|cs|c|h|cpp|hpp|sh|sql|vue|svelte)$/i
const CONFIG_EXTENSIONS = /\.(?:json|ya?ml|toml|ini|env|config|md|txt)$/i

/** Paths that describe what a project is built from. */
const MANIFEST_NAMES = /(^|\/)(?:package\.json|tsconfig\.json|pyproject\.toml|requirements\.txt|go\.mod|cargo\.toml|composer\.json|gemfile|pom\.xml|build\.gradle(?:\.kts)?)$/i
const README_NAMES = /(^|\/)readme(?:\.(?:md|markdown|txt|rst))?$/i

export interface ArchiveEntry {
  path: string
  size: number
  text?: string
}

export interface ArchiveSummary {
  /** Total entries in the zip, including folders and ignored paths. */
  entryCount: number
  /** Entries we actually consider source/config material. */
  fileCount: number
  uncompressedBytes: number
  hasTopLevelFolder: boolean
  /** A short, deduplicated sample of interesting paths for reviewer display. */
  fileNames: string[]
  /** Contents of small manifest/config files, used to ground the AI report. */
  manifests: Array<{ path: string; text: string }>
  readme?: { path: string; text: string }
  /** File extensions seen, ordered by frequency. */
  extensions: Array<{ extension: string; count: number }>
  entries: ArchiveEntry[]
}

export class ArchiveRejectedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ArchiveRejectedError"
  }
}

const MAX_ENTRY_TEXT = 20_000
const MAX_MANIFEST_TEXT = 8_000
const MAX_SAMPLED_ENTRIES = 120

const readEntryText = async (entry: JSZip.JSZipObject, limit: number): Promise<string | undefined> => {
  // Only decode formats that are safe and cheap to read as UTF-8 text.
  if (!/\.(?:json|ya?ml|toml|ini|config|md|markdown|txt|rst|csv|mod|lock|env)$/i.test(entry.name)) return undefined
  try {
    const text = await entry.async("string")
    return text.slice(0, limit)
  } catch {
    return undefined
  }
}

/**
 * Opens an archive and returns a summary suitable for grounding an AI report
 * and showing reviewers what was actually inside. Throws ArchiveRejectedError
 * for corrupt, oversized, or non-zip input.
 */
export async function inspectSourceArchive(bytes: Uint8Array): Promise<ArchiveSummary> {
  if (!bytes.byteLength) throw new ArchiveRejectedError("The source archive is empty.")
  if (bytes.byteLength > ARCHIVE_LIMITS.maxBytes) {
    throw new ArchiveRejectedError(`The source archive must be ${Math.round(ARCHIVE_LIMITS.maxBytes / (1024 * 1024))} MB or smaller.`)
  }
  if (!hasZipSignature(bytes)) throw new ArchiveRejectedError("That file is not a valid ZIP archive.")

  let archive: JSZip
  try {
    archive = await JSZip.loadAsync(bytes, { checkCRC32: false })
  } catch {
    throw new ArchiveRejectedError("The ZIP archive could not be read. It may be corrupt.")
  }

  const allEntries = Object.values(archive.files)
  if (allEntries.length > ARCHIVE_LIMITS.maxEntryCount) {
    throw new ArchiveRejectedError(`The archive contains too many files (limit ${ARCHIVE_LIMITS.maxEntryCount}).`)
  }

  const uncompressed = allEntries.reduce((total, entry) => {
    const size = (entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize
    return total + (typeof size === "number" ? size : 0)
  }, 0)
  if (uncompressed > ARCHIVE_LIMITS.maxUncompressedBytes) {
    throw new ArchiveRejectedError("The archive expands to an unreasonable size. Please submit a leaner source bundle.")
  }

  const interesting = allEntries.filter((entry) =>
    !entry.dir &&
    !SKIP_SEGMENT.test(entry.name) &&
    entry.name.split("/").length <= ARCHIVE_LIMITS.maxDepth,
  )

  const extensionCounts = new Map<string, number>()
  for (const entry of interesting) {
    const match = /\.([a-z0-9]+)$/i.exec(entry.name)
    if (!match) continue
    const extension = match[1].toLowerCase()
    extensionCounts.set(extension, (extensionCounts.get(extension) ?? 0) + 1)
  }

  const manifests: Array<{ path: string; text: string }> = []
  for (const entry of interesting) {
    if (manifests.length >= 6) break
    if (!MANIFEST_NAMES.test(entry.name)) continue
    const text = await readEntryText(entry, MAX_MANIFEST_TEXT)
    if (text) manifests.push({ path: entry.name, text })
  }

  let readme: { path: string; text: string } | undefined
  const readmeEntry = interesting.find((entry) => README_NAMES.test(entry.name))
  if (readmeEntry) {
    const text = await readEntryText(readmeEntry, MAX_MANIFEST_TEXT)
    if (text) readme = { path: readmeEntry.name, text }
  }

  // Read a bounded sample of source files so the report can reference real code
  // structure without shipping the whole archive to the model.
  const sampleSource = interesting
    .filter((entry) => SOURCE_EXTENSIONS.test(entry.name))
    .sort((a, b) => a.name.length - b.name.length)
    .slice(0, 24)

  const entries: ArchiveEntry[] = []
  for (const entry of sampleSource) {
    const text = await readEntryText(entry, MAX_ENTRY_TEXT)
    entries.push({ path: entry.name, size: 0, text })
  }
  if (!entries.length) {
    for (const entry of interesting.filter((item) => CONFIG_EXTENSIONS.test(item.name)).slice(0, 12)) {
      const text = await readEntryText(entry, MAX_ENTRY_TEXT)
      entries.push({ path: entry.name, size: 0, text })
    }
  }

  const meaningful = interesting.filter((entry) => !NOISE_FILE.test(entry.name))
  const depths = new Set(meaningful.map((entry) => entry.name.split("/")[0]))
  const hasTopLevelFolder = depths.size === 1 && meaningful.every((entry) => entry.name.includes("/"))

  return {
    entryCount: allEntries.length,
    fileCount: meaningful.length,
    uncompressedBytes: uncompressed,
    hasTopLevelFolder,
    fileNames: meaningful
      .map((entry) => entry.name)
      .sort()
      .slice(0, MAX_SAMPLED_ENTRIES),
    manifests,
    readme,
    extensions: [...extensionCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([extension, count]) => ({ extension, count })),
    entries,
  }
}

/** Human-readable one-liner shown on the submission and in reviewer views. */
export function describeArchive(summary: ArchiveSummary): string {
  const size = summary.uncompressedBytes > 0
    ? ` · ${(summary.uncompressedBytes / (1024 * 1024)).toFixed(1)} MB unpacked`
    : ""
  return `${summary.fileCount} source file${summary.fileCount === 1 ? "" : "s"}${size}`
}

/**
 * Derives the app's brand assets from the master logo (public/cedalogo-01.png).
 *
 * The master is a 355x227 transparent PNG exported at 150 dpi whose artwork only
 * occupies a 281x167 box centred in the canvas (large transparent margins). Using it
 * directly in square UI slots shrinks the mark and misaligns the optical centre, so
 * we trim the padding and emit:
 *
 *   logo-lockup.png  - trimmed lockup, 2x the on-screen size, for in-app headers
 *   logo-mark.png    - square icon variant for favicons / touch icon
 *
 * Run: node scripts/generate-brand-assets.mjs
 */
import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import sharp from "sharp"

const root = process.cwd()
const SOURCE = path.join(root, "public", "cedalogo-01.png")
const OUT_DIR = path.join(root, "public")

/** Alpha above which a pixel counts as artwork when trimming the transparent margin. */
const ALPHA_THRESHOLD = 8

async function trimToArtwork(input) {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { width, height, channels } = info
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * channels + 3]
      if (alpha > ALPHA_THRESHOLD) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }

  if (maxX < 0) throw new Error("Master logo is fully transparent; nothing to trim.")

  const box = {
    left: minX,
    top: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  }
  return { buffer: await sharp(input).extract(box).png().toBuffer(), box }
}

/**
 * Pads the trimmed artwork back into a square canvas so the mark stays centred when
 * rendered inside square icon slots. The artwork keeps its aspect and gains breathing
 * room rather than being stretched.
 */
async function toSquareMark(trimmed) {
  const meta = await sharp(trimmed).metadata()
  const inset = 0.1 // 10% breathing room on the longest edge
  const side = Math.round(Math.max(meta.width, meta.height) * (1 + inset * 2))
  const left = Math.round((side - meta.width) / 2)
  const top = Math.round((side - meta.height) / 2)

  return sharp({
    create: {
      width: side,
      height: side,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: trimmed, left, top }])
    .png()
    .toBuffer()
}

async function main() {
  const source = await readFile(SOURCE)
  const { buffer: trimmed, box } = await trimToArtwork(source)
  const meta = await sharp(trimmed).metadata()
  console.log(`master      ${await describe(source)}`)
  console.log(`trimmed     ${meta.width}x${meta.height} (from ${box.left},${box.top})`)

  // In-app lockup: rendered at most ~160px wide, so 2x is plenty.
  const lockup = await sharp(trimmed)
    .resize({ width: Math.round(meta.width * 2), kernel: "lanczos3" })
    .png({ compressionLevel: 9, palette: false })
    .toBuffer()
  await writeFile(path.join(OUT_DIR, "logo-lockup.png"), lockup)
  console.log(`logo-lockup ${await describe(lockup)}`)

  // Square mark for favicons / apple-touch-icon.
  const square = await toSquareMark(trimmed)
  const mark = await sharp(square)
    .resize({ width: 512, height: 512, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toBuffer()
  await writeFile(path.join(OUT_DIR, "logo-mark.png"), mark)
  console.log(`logo-mark   ${await describe(mark)}`)
}

async function describe(buffer) {
  const meta = await sharp(buffer).metadata()
  return `${meta.width}x${meta.height} ${(buffer.length / 1024).toFixed(1)}kb`
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

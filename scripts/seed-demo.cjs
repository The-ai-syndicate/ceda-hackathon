// Seeds one rich demo project into all three stores:
//   1. R2  -> projects/<id>/project.json, previews/01..05.webp, source.zip
//   2. Supabase -> public.projects row (pointed at folder_key)
//   3. public.profiles row for the demo user (required by getAuthContext)
const fs = require("fs");
const zlib = require("zlib");
const {
  S3Client, PutObjectCommand, HeadObjectCommand,
} = require("@aws-sdk/client-s3");
const { Client } = require("pg");

const env = fs.readFileSync(".env.local", "utf8");
const get = (k) => {
  const m = env.match(new RegExp("^" + k + "=(.*)$", "m"));
  return m ? m[1].trim() : "";
};

const SUPABASE_URL = get("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_KEY = get("SUPABASE_SERVICE_ROLE_KEY");
const DB_PASSWORD = get("SUPABASE_DB_PASSWORD");
const BUCKET = "ceda";
const DEMO_EMAIL = "demo@ceda.dev";
const PROJECT_ID = "submission-7f3a1c2e-9b4d-4a61-8c05-2e7d9f1a6b30";

const r2 = new S3Client({
  region: "auto",
  endpoint: "https://ad21c08348579151eca8d11ee8f07d01.r2.cloudflarestorage.com",
  forcePathStyle: true,
  credentials: { accessKeyId: get("R2_ACCESS_KEY_ID"), secretAccessKey: get("R2_SECRET_ACCESS_KEY") },
});

// ---------- minimal PNG -> WebP not available; emit valid PNG, stored as .webp key
// Browsers sniff actual bytes, so a PNG served as image/webp still renders.
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
// Draw a simple dark UI-screenshot mock, 640x400, using a tiny pixel writer.
function makeShot({ top, accent, rows }) {
  const W = 640, H = 400;
  const raw = Buffer.alloc((W * 3 + 1) * H);
  let p = 0;
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const bg = hex("#101214"), bar = hex("#191b1f"), fg = hex("#c3d0dc"), acc = hex(accent), hd = hex(top);
  for (let y = 0; y < H; y++) {
    raw[p++] = 0; // filter byte
    for (let x = 0; x < W; x++) {
      let c = bg;
      if (y < 34) c = bar;                                   // title bar
      if (y >= 34 && y < 96) c = hd;                          // header band
      if (y >= 96 && y < 100) c = acc;                        // accent underline
      for (const r of rows) {                                 // content rows
        if (y >= r.y && y < r.y + r.h && x >= 40 && x < 40 + r.w) c = r.c ? hex(r.c) : fg;
      }
      if (y < 34 && x > 16 && x < 60 && (x - 16) % 14 < 8) c = hex("#ff6b65"); // traffic lights
      raw[p++] = c[0]; raw[p++] = c[1]; raw[p++] = c[2];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const shots = [
  { top: "#1b2733", accent: "#5ac88c", rows: [{ y: 120, h: 14, w: 300 }, { y: 150, h: 10, w: 420 }, { y: 172, h: 10, w: 380 }, { y: 210, h: 120, w: 560, c: "#182028" }, { y: 350, h: 12, w: 200, c: "#5ac88c" }] },
  { top: "#221a33", accent: "#a78bfa", rows: [{ y: 120, h: 180, w: 150, c: "#1a1526" }, { y: 120, h: 14, w: 400 }, { y: 150, h: 10, w: 350 }, { y: 176, h: 10, w: 300 }, { y: 210, h: 90, w: 400, c: "#1a1526" }] },
  { top: "#102a26", accent: "#22d3ee", rows: [{ y: 118, h: 12, w: 260 }, { y: 150, h: 8, w: 480 }, { y: 168, h: 8, w: 460 }, { y: 186, h: 8, w: 500 }, { y: 204, h: 8, w: 430 }, { y: 240, h: 110, w: 560, c: "#0d1f1c" }] },
  { top: "#2a1f14", accent: "#f2b880", rows: [{ y: 120, h: 16, w: 340 }, { y: 150, h: 10, w: 280 }, { y: 190, h: 60, w: 250, c: "#221a10" }, { y: 260, h: 60, w: 250, c: "#221a10" }, { y: 330, h: 40, w: 520, c: "#221a10" }] },
  { top: "#1a1a26", accent: "#818cf8", rows: [{ y: 120, h: 10, w: 200 }, { y: 140, h: 8, w: 560, c: "#151522" }, { y: 155, h: 8, w: 540, c: "#151522" }, { y: 170, h: 8, w: 550, c: "#151522" }, { y: 185, h: 8, w: 500, c: "#151522" }, { y: 210, h: 130, w: 560, c: "#131320" }] },
];

const snippets = [
  { fileName: "app/api/ledger/route.ts", code: '// POST /api/ledger — append an immutable entry\nexport async function POST(req: Request) {\n  const body = await req.json()\n  const entry = { ...body, hash: await sha256(body) }\n  await db.ledger.insert(entry)\n  return Response.json({ ok: true, hash: entry.hash })\n}' },
  { fileName: "lib/qr-render.ts", code: 'export function qrPayload(order) {\n  return `ord:${order.id};amt:${order.total};ts:${order.createdAt}`\n}\n\nexport function renderMatrix(payload, size = 25) {\n  const bits = encode(payload)\n  return padMatrix(bits, size)\n}' },
  { fileName: "components/Scanner.tsx", code: 'export function Scanner({ onScan }) {\n  const video = useRef<HTMLVideoElement>(null)\n  const { frame } = useCamera(video)\n  useEffect(() => {\n    if (!frame) return\n    detect(frame).then((code) => code && onScan(code))\n  }, [frame, onScan])\n}' },
  { fileName: "lib/realtime.ts", code: 'export const channel = supabase.channel("ledger")\nchannel.on("postgres_changes",\n  { event: "INSERT", schema: "public", table: "ledger" },\n  (payload) => store.append(payload.new)\n).subscribe()' },
  { fileName: "db/schema.sql", code: 'CREATE TABLE ledger (\n  id BIGSERIAL PRIMARY KEY,\n  hash TEXT NOT NULL UNIQUE,\n  payload JSONB NOT NULL,\n  created_at TIMESTAMPTZ DEFAULT now()\n);\nCREATE INDEX ledger_created_idx ON ledger (created_at DESC);' },
];

const project = {
  id: PROJECT_ID,
  title: "Threadline",
  clipCount: 5,
  createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  images: ["PREVIEWS_PLACEHOLDER"],
  previewKind: "fullstack",
  snippets,
  technologies: ["Next.js", "TypeScript", "Supabase", "Tailwind CSS", "Vercel"],
  fileCount: 147,
  fileNames: ["app/layout.tsx", "app/api/ledger/route.ts", "lib/qr-render.ts", "components/Scanner.tsx", "db/schema.sql"],
  developer: "Amara Osei",
  processingStatus: "Analysis complete",
  securityStatus: "2 findings",
  storedInR2: true,
  folderKey: `projects/${PROJECT_ID}/`,
  status: "review",
  aiReport: {
    languages: ["TypeScript", "SQL"],
    frameworks: ["Next.js", "React", "Tailwind CSS"],
    databases: ["Supabase Postgres"],
    apisAndIntegrations: ["Supabase Realtime", "Web Crypto (SHA-256)", "MediaDevices Camera API"],
    purpose: "Threadline is a tamper-evident inventory ledger for small-scale textile manufacturers. Each stock movement is appended as a hash-chained record and surfaced on a live dashboard, letting a workshop prove custody of goods without a dedicated ERP.",
    architecture: "A Next.js App Router frontend talks to route handlers that write into Supabase Postgres. Every mutation is hashed with the previous record's digest to form a chain; a Realtime channel fans changes out to subscribers. QR labels encode order metadata so floor staff can append entries from a phone camera without logging into a terminal.",
    strengths: [
      "Hash-chaining is implemented server-side, so a client cannot forge a valid link",
      "Realtime fan-out keeps multiple shop-floor devices consistent without polling",
      "Clear separation between pure hashing helpers (lib/) and I/O (app/api/)",
      "QR fallback means the app stays usable on low-end Android devices",
    ],
    functionality: "Submit an order, render a QR label, scan it to append a movement, and watch the ledger update live across connected clients. Integrity can be re-verified on demand by replaying the chain.",
    buildVerification: "npm install and next build both completed without errors. 31 modules compiled; no peer-dependency conflicts. Type checking passed in strict mode.",
    codeQuality: "Consistently typed with interfaces at the boundary of every route handler. Hashing is isolated in a pure function that is straightforward to unit test. A few route handlers repeat validation logic that would benefit from a shared schema (zod) layer.",
    capabilityScore: 84,
    technicalComplexity: "Advanced",
    originalityAssessment: "Hash-chained audit logs are well-trodden in finance, but applying them to low-connectivity textile inventory with QR-first input is a genuinely fresh framing. The idea is more distinctive than the execution, which follows conventional Next.js patterns.",
    judgeSummary: "A well-executed, genuinely useful submission. Threadline pairs a sound integrity model with a pragmatic input path (QR + camera) that fits its actual users. The main gaps are repetitive validation and thin automated test coverage, both easily addressed.",
    securityReviewNotes: [
      "Row-level security is enabled but the ledger table only defines a SELECT policy — writes rely entirely on the service role",
      "The camera stream is never explicitly stopped when the Scanner unmounts, leaving the indicator light on",
    ],
  },
  securityFindings: [
    { severity: "medium", title: "Ledger table lacks an INSERT policy", detail: "RLS is enabled on `ledger` with only a SELECT policy defined. Inserts succeed solely through the service role, so the intended access model is not actually enforced by the database.", file: "db/schema.sql" },
    { severity: "low", title: "Camera stream not released on unmount", detail: "`Scanner.tsx` acquires a MediaStream but never calls `track.stop()` in its cleanup, so the camera indicator can stay lit after navigating away.", file: "components/Scanner.tsx" },
  ],
  dependencyFindings: [
    { package: "next", version: "15.1.0", id: "GHSA-demo-next-001", summary: "Framework advisory simulated for demonstration purposes.", severity: "low" },
    { package: "zod", version: "3.23.8", id: "GHSA-demo-zod-002", summary: "Input validation library, current release.", severity: "none" },
  ],
};

async function getDemoUserId() {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=200`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  const json = await res.json();
  const users = json.users || [];
  const found = users.find((u) => u.email === DEMO_EMAIL);
  if (!found) throw new Error(`Demo user ${DEMO_EMAIL} not found. Create it first.`);
  return found.id;
}

(async () => {
  const userId = await getDemoUserId();
  console.log("demo user id:", userId);

  // 1) previews
  const prefix = `projects/${PROJECT_ID}/`;
  for (let i = 0; i < shots.length; i++) {
    const key = `${prefix}previews/${String(i + 1).padStart(2, "0")}.webp`;
    await r2.send(new PutObjectCommand({
      Bucket: BUCKET, Key: key, Body: makeShot(shots[i]),
      ContentType: "image/webp", CacheControl: "private, max-age=3600",
    }));
  }
  const images = shots.map((_, i) => `/api/projects/${encodeURIComponent(PROJECT_ID)}/previews/${i}`);
  const stored = { ...project, images };
  console.log("previews uploaded:", images.length);

  // 2) source.zip (small valid archive-less blob; route only streams it)
  await r2.send(new PutObjectCommand({
    Bucket: BUCKET, Key: `${prefix}source.zip`,
    Body: Buffer.from("PK\u0005\u0006" + "\u0000".repeat(18), "binary"),
    ContentType: "application/zip", CacheControl: "private, no-store",
  }));

  // 3) project.json
  await r2.send(new PutObjectCommand({
    Bucket: BUCKET, Key: `${prefix}project.json`,
    Body: JSON.stringify(stored), ContentType: "application/json; charset=utf-8",
    CacheControl: "private, no-store",
  }));
  const head = await r2.send(new HeadObjectCommand({ Bucket: BUCKET, Key: `${prefix}project.json` }));
  console.log("project.json bytes:", head.ContentLength);

  // 4) Supabase rows
  const client = new Client({
    host: "db.ybmsypbwbyoxintryczm.supabase.co", port: 5432, user: "postgres",
    database: "postgres", password: DB_PASSWORD, ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  await client.query(
    `insert into public.profiles (id, display_name, role) values ($1,$2,'submitter')
     on conflict (id) do update set display_name = excluded.display_name`,
    [userId, "Demo Submitter"],
  );
  await client.query(
    `insert into public.projects (id, owner_id, title, developer, folder_key, status, created_at)
     values ($1,$2,$3,$4,$5,$6,$7)
     on conflict (id) do update set title=excluded.title, developer=excluded.developer,
       folder_key=excluded.folder_key, status=excluded.status, owner_id=excluded.owner_id`,
    [PROJECT_ID, userId, stored.title, stored.developer, stored.folderKey, stored.status, stored.createdAt],
  );
  const n = await client.query("select count(*)::int as c from public.projects");
  const p = await client.query("select id,title,status from public.projects");
  console.log("projects rows:", n.rows[0].c, p.rows);
  await client.end();
  console.log("SEED OK");
})().catch((e) => { console.error("SEED FAILED:", e.message); process.exit(1); });

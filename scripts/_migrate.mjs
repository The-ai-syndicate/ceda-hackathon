import { readFileSync } from "node:fs"
import pg from "pg"

const env = {}
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim()
}

const projectRef = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0]
const sql = readFileSync("scripts/migrations/20260101000000_admin_user_management.sql", "utf8")

const candidates = [
  { label: "direct", host: `db.${projectRef}.supabase.co`, port: 5432 },
  { label: "pooler-aw", host: `aws-0-us-east-1.pooler.supabase.com`, port: 6543 },
]

for (const c of candidates) {
  const user = c.label === "direct" ? "postgres" : `postgres.${projectRef}`
  const client = new pg.Client({
    host: c.host,
    port: c.port,
    user,
    password: env.SUPABASE_DB_PASSWORD,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
  })
  try {
    await client.connect()
    console.log(`connected via ${c.label} (${c.host}:${c.port})`)
    await client.query(sql)
    console.log("migration applied OK")
    const r = await client.query(
      `select proname from pg_proc where pronamespace = 'public'::regnamespace and proname like 'admin_%' order by proname`,
    )
    console.log("functions now present:", r.rows.map((x) => x.proname).join(", ") || "(none)")
    await client.end()
    process.exit(0)
  } catch (err) {
    console.log(`${c.label} failed: ${err.message}`)
    try { await client.end() } catch {}
  }
}
process.exit(1)

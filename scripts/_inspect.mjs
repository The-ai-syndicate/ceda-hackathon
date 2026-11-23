import { readFileSync } from "node:fs"
import pg from "pg"

const env = {}
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim()
}

const client = new pg.Client({
  host: "db.ybmsypbwbyoxintryczm.supabase.co",
  port: 5432,
  user: "postgres",
  password: env.SUPABASE_DB_PASSWORD,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
})
await client.connect()

const q = async (label, sql) => {
  const r = await client.query(sql)
  console.log(`\n== ${label} ==`)
  console.table(r.rows)
}

await q("function acl", `select proname, proacl::text from pg_proc where pronamespace='public'::regnamespace and proname like 'admin_%'`)
await q("profiles acl", `select relname, relacl::text from pg_class where relname in ('profiles','projects')`)
await q("roles", `select rolname from pg_roles where rolname in ('anon','authenticated','service_role','postgres')`)
await q("admin profile rows", `select id, display_name, role from public.profiles where role='admin'`)
await q("profile count", `select count(*)::int as n from public.profiles`)

await client.end()

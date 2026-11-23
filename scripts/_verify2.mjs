import { readFileSync } from "node:fs"

const env = {}
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim()
}

const url = env.NEXT_PUBLIC_SUPABASE_URL
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: anon, "Content-Type": "application/json" },
  body: JSON.stringify({ email: env.NEXT_PUBLIC_DEMO_ADMIN_EMAIL, password: env.NEXT_PUBLIC_DEMO_ADMIN_PASSWORD }),
})
const { access_token: admin } = await res.json()

const rpc = async (fn, body) => {
  const r = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: anon, Authorization: `Bearer ${admin}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  return { status: r.status, body: await r.text() }
}

const SUBMITTER = "08ef14c5-cf00-4193-b8e6-6355ce33d1d5" // demo@ceda.dev
const ADMIN = "db8805ba-12a3-4d5e-9af3-ef1c9f0bcb1c"

console.log("promote submitter -> judge:", JSON.stringify(await rpc("admin_set_user_role", { p_user_id: SUBMITTER, p_role: "judge" })))
console.log("revert judge -> submitter:", JSON.stringify(await rpc("admin_set_user_role", { p_user_id: SUBMITTER, p_role: "submitter" })))
console.log("invalid role      ->", JSON.stringify(await rpc("admin_set_user_role", { p_user_id: SUBMITTER, p_role: "superuser" })))
console.log("demote last admin ->", JSON.stringify(await rpc("admin_set_user_role", { p_user_id: ADMIN, p_role: "judge" })))

const after = JSON.parse((await rpc("admin_list_users", {})).body)
console.log("\nfinal roles:", after.map((u) => `${u.email}=${u.role}`).join(", "))

import { readFileSync } from "node:fs"

const env = {}
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim()
}

const url = env.NEXT_PUBLIC_SUPABASE_URL
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY

async function signIn(email, password) {
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anon, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(`${email}: ${json.error_description || json.msg || JSON.stringify(json)}`)
  return json.access_token
}

async function rpc(token, fn, body) {
  const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: anon, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  })
  return { status: res.status, body: await res.text() }
}

const admin = await signIn(env.NEXT_PUBLIC_DEMO_ADMIN_EMAIL, env.NEXT_PUBLIC_DEMO_ADMIN_PASSWORD)
console.log("signed in as admin:", env.NEXT_PUBLIC_DEMO_ADMIN_EMAIL)

const list = await rpc(admin, "admin_list_users")
console.log(`\nadmin_list_users -> HTTP ${list.status}`)
console.log(list.body.slice(0, 600))

// Non-admin must be rejected.
try {
  const judge = await signIn(env.NEXT_PUBLIC_DEMO_JUDGE_EMAIL, env.NEXT_PUBLIC_DEMO_JUDGE_PASSWORD)
  const denied = await rpc(judge, "admin_list_users")
  console.log(`\njudge admin_list_users -> HTTP ${denied.status} ${denied.body.slice(0, 200)}`)
} catch (e) {
  console.log("\njudge sign-in skipped:", e.message)
}

try {
  const hacker = await signIn(env.NEXT_PUBLIC_DEMO_HACKER_EMAIL, env.NEXT_PUBLIC_DEMO_HACKER_PASSWORD)
  const denied = await rpc(hacker, "admin_list_users")
  console.log(`submitter admin_list_users -> HTTP ${denied.status} ${denied.body.slice(0, 200)}`)
} catch (e) {
  console.log("submitter sign-in skipped:", e.message)
}

import { readFileSync } from "node:fs"

const env = {}
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim()
}

const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY

// Ask PostgREST for the function definitions via pg_proc through an RPC-free path.
// Instead: call the RPCs directly and inspect the error code.
for (const fn of ["admin_list_users", "admin_set_user_role"]) {
  const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(fn === "admin_set_user_role" ? { p_user_id: "00000000-0000-0000-0000-000000000000", p_role: "judge" } : {}),
  })
  const text = await res.text()
  console.log(`${fn}: HTTP ${res.status} -> ${text.slice(0, 300)}`)
}

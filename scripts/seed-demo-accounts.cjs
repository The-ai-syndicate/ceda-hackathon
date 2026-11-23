// Creates one real, pre-confirmed demo account per user role and assigns the
// seeded demo project to the applicant so their dashboard is not empty.
//   admin@cedahack.com   -> admin
//   judge@cedahack.com   -> judge
//   hacker@cedahack.com  -> submitter
// Accounts are created through the Supabase admin API; roles are written
// directly to public.profiles. Safe to re-run (idempotent).
const fs = require("fs");
const { Client } = require("pg");

const env = fs.readFileSync(".env.local", "utf8");
const get = (k) => { const m = env.match(new RegExp("^" + k + "=(.*)$", "m")); return m ? m[1].trim() : ""; };

const SUPABASE_URL = get("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_KEY = get("SUPABASE_SERVICE_ROLE_KEY");
const DB_PASSWORD = get("SUPABASE_DB_PASSWORD");
const PROJECT_ID = "submission-7f3a1c2e-9b4d-4a61-8c05-2e7d9f1a6b30"; // Threadline demo project

const ACCOUNTS = [
  { role: "admin", name: "CEDA Admin", email: get("NEXT_PUBLIC_DEMO_ADMIN_EMAIL") || "admin@cedahack.com", password: get("NEXT_PUBLIC_DEMO_ADMIN_PASSWORD") || "CedaHack2026!" },
  { role: "judge", name: "CEDA Judge", email: get("NEXT_PUBLIC_DEMO_JUDGE_EMAIL") || "judge@cedahack.com", password: get("NEXT_PUBLIC_DEMO_JUDGE_PASSWORD") || "CedaHack2026!" },
  { role: "submitter", name: "Demo Applicant", email: get("NEXT_PUBLIC_DEMO_HACKER_EMAIL") || "hacker@cedahack.com", password: get("NEXT_PUBLIC_DEMO_HACKER_PASSWORD") || "CedaHack2026!" },
];

const HEADERS = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" };

async function listUsers() {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=200`, { headers: HEADERS });
  const json = await res.json();
  return json.users || [];
}

async function ensureUser(account, existing) {
  const found = existing.find((u) => (u.email || "").toLowerCase() === account.email.toLowerCase());
  if (found) {
    // Keep the password in sync so the login chips always work.
    const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${found.id}`, {
      method: "PUT", headers: HEADERS,
      body: JSON.stringify({ password: account.password, email_confirm: true, user_metadata: { display_name: account.name } }),
    });
    if (!res.ok) throw new Error(`update ${account.email}: ${res.status} ${await res.text()}`);
    console.log(`  · ${account.email} (${account.role}) already exists — refreshed`);
    return found.id;
  }

  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST", headers: HEADERS,
    body: JSON.stringify({ email: account.email, password: account.password, email_confirm: true, user_metadata: { display_name: account.name } }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`create ${account.email}: ${res.status} ${JSON.stringify(json)}`);
  console.log(`  · ${account.email} (${account.role}) created`);
  return json.id;
}

(async () => {
  console.log("seeding demo accounts…");
  const existing = await listUsers();
  const ids = {};
  for (const account of ACCOUNTS) {
    ids[account.role] = await ensureUser(account, existing);
  }

  const client = new Client({
    host: "db.ybmsypbwbyoxintryczm.supabase.co", port: 5432, user: "postgres",
    database: "postgres", password: DB_PASSWORD, ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  for (const account of ACCOUNTS) {
    await client.query(
      `insert into public.profiles (id, display_name, role) values ($1,$2,$3)
       on conflict (id) do update set display_name = excluded.display_name, role = excluded.role`,
      [ids[account.role], account.name, account.role],
    );
  }

  // Give the applicant role a project to see (submitter dashboards filter by owner_id).
  const reassigned = await client.query(
    "update public.projects set owner_id = $1 where id = $2",
    [ids.submitter, PROJECT_ID],
  );
  console.log(`projects reassigned to applicant: ${reassigned.rowCount}`);

  const rows = await client.query("select p.email, pr.role from public.profiles pr join auth.users p on p.id = pr.id order by pr.role");
  await client.end();

  console.log("profiles:", rows.rows);
  console.log("SEED OK — demo login password:", ACCOUNTS[0].password);
})().catch((e) => { console.error("SEED FAILED:", e.message); process.exit(1); });

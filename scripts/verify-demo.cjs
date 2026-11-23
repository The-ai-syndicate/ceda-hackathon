// Log in as the demo user against the RUNNING app, then hit /api/me and /api/projects
// with the resulting session cookie — exactly what the browser does.
const BASE = "http://localhost:3001";
const fs = require("fs");

const env = fs.readFileSync(".env.local", "utf8");
const get = (k) => {
  const m = env.match(new RegExp("^" + k + "=(.*)$", "m"));
  return m ? m[1].trim() : "";
};
const ANON = get("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const URL_ = get("NEXT_PUBLIC_SUPABASE_URL");
const EMAIL = "demo@ceda.dev";
const PASSWORD = "CedaDemo2026!";

(async () => {
  const res = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const session = await res.json();
  if (!session.access_token) throw new Error("login failed: " + JSON.stringify(session));
  console.log("LOGIN ok, expires_in:", session.expires_in);

  // Rebuild the cookie shape @supabase/ssr writes for this project ref.
  const ref = new URL(URL_).hostname.split(".")[0];
  const name = `sb-${ref}-auth-token`;
  const payload = JSON.stringify({
    access_token: session.access_token,
    token_type: "bearer",
    expires_in: session.expires_in,
    expires_at: Math.floor(Date.now() / 1000) + session.expires_in,
    refresh_token: session.refresh_token,
    user: session.user,
  });
  // @supabase/ssr base64url-encodes and chunks large cookies
  const encoded = "base64-" + Buffer.from(payload).toString("base64url");
  // @supabase/ssr always writes chunk names as `<key>.<index>`.
  const chunks = [];
  for (let i = 0; i < encoded.length; i += 3000) chunks.push(encoded.slice(i, i + 3000));
  const cookie = chunks.map((c, i) => `${name}.${i}=${c}`).join("; ");
  console.log("cookie chunks:", chunks.length);

  const h = { Cookie: cookie };

  const me = await fetch(`${BASE}/api/me`, { headers: h });
  console.log("/api/me ->", me.status, (await me.text()).slice(0, 300));

  const projects = await fetch(`${BASE}/api/projects`, { headers: h });
  const text = await projects.text();
  console.log("/api/projects ->", projects.status, "bytes:", text.length);
  try {
    const list = JSON.parse(text);
    console.log("project count:", list.length);
    if (list[0]) {
      console.log("first:", JSON.stringify({
        id: list[0].id, title: list[0].title, developer: list[0].developer,
        status: list[0].status, images: list[0].images?.length,
        technologies: list[0].technologies?.length, storedInR2: list[0].storedInR2,
        hasReport: !!list[0].aiReport,
      }, null, 2));
    }
  } catch { console.log("NON-JSON:", text.slice(0, 400)); }

  const detail = await fetch(`${BASE}/api/projects/${encodeURIComponent(list_id())}`, { headers: h });
  console.log("/api/projects/[id] ->", detail.status, (await detail.text()).slice(0, 200));

  const prev = await fetch(`${BASE}/api/projects/${encodeURIComponent(list_id())}/previews/0`, { headers: h });
  const buf = Buffer.from(await prev.arrayBuffer());
  console.log("/api/.../previews/0 ->", prev.status, prev.headers.get("content-type"), "bytes:", buf.length,
    "png_magic:", buf.slice(0, 4).toString("hex") === "89504e47");
})().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });

function list_id() { return "submission-7f3a1c2e-9b4d-4a61-8c05-2e7d9f1a6b30"; }

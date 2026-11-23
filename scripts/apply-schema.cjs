const fs = require("fs");
const { Client } = require("pg");

const env = fs.readFileSync(".env.local", "utf8");
const get = (k) => {
  const m = env.match(new RegExp("^" + k + "=(.*)$", "m"));
  return m ? m[1].trim() : "";
};
const password = get("SUPABASE_DB_PASSWORD");

const hosts = [
  { host: "aws-1-eu-central-1.pooler.supabase.com", port: 6543 },
  { host: "aws-0-eu-central-1.pooler.supabase.com", port: 6543 },
  { host: "aws-1-us-east-1.pooler.supabase.com", port: 6543 },
  { host: "db.ybmsypbwbyoxintryczm.supabase.co", port: 5432 },
];

(async () => {
  const sql = fs.readFileSync("scripts/schema.sql", "utf8");
  for (const h of hosts) {
    const user = h.host.startsWith("db.") ? "postgres" : `postgres.ybmsypbwbyoxintryczm`;
    const client = new Client({ ...h, user, database: "postgres", password, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 8000 });
    try {
      await client.connect();
      console.log("CONNECTED via", h.host);
      await client.query(sql);
      const t = await client.query("select table_name from information_schema.tables where table_schema='public' order by 1");
      console.log("TABLES:", t.rows.map((r) => r.table_name).join(", "));
      await client.end();
      process.exit(0);
    } catch (e) {
      console.log("FAIL", h.host, "-", e.message.slice(0, 120));
      try { await client.end(); } catch {}
    }
  }
  process.exit(1);
})();

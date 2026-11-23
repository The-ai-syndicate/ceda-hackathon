import type { AppRole } from "@/lib/supabase/auth-context"

/**
 * One demo account per user role, surfaced as one-click chips on the sign-in
 * form. Credentials live in `NEXT_PUBLIC_DEMO_*` env vars — they are shown in
 * the UI, so they are intentionally public. The matching accounts are created
 * by `scripts/seed-demo-accounts.cjs`.
 */
export type DemoAccount = {
  role: AppRole
  label: string
  email: string
  password: string
  blurb: string
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    role: "admin",
    label: "Administrator",
    email: process.env.NEXT_PUBLIC_DEMO_ADMIN_EMAIL ?? "admin@cedahack.com",
    password: process.env.NEXT_PUBLIC_DEMO_ADMIN_PASSWORD ?? "CedaHack2026!",
    blurb: "Full access · grants judge access",
  },
  {
    role: "judge",
    label: "Judge",
    email: process.env.NEXT_PUBLIC_DEMO_JUDGE_EMAIL ?? "judge@cedahack.com",
    password: process.env.NEXT_PUBLIC_DEMO_JUDGE_PASSWORD ?? "CedaHack2026!",
    blurb: "Reviews and scores every submission",
  },
  {
    role: "submitter",
    label: "Applicant",
    email: process.env.NEXT_PUBLIC_DEMO_HACKER_EMAIL ?? "hacker@cedahack.com",
    password: process.env.NEXT_PUBLIC_DEMO_HACKER_PASSWORD ?? "CedaHack2026!",
    blurb: "Submits project archives",
  },
]

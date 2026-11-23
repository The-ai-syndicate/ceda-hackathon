"use client"

import { useEffect, useState, type FormEvent } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { ArrowLeft, ArrowRight, Code2, Gavel, KeyRound, MailCheck, ShieldCheck } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { DEMO_ACCOUNTS, type DemoAccount } from "@/lib/demo-accounts"

type AuthMode = "login" | "signup"
type Notice = { title: string; body: string }

const ROLE_ICON = {
  admin: ShieldCheck,
  judge: Gavel,
  submitter: Code2,
} as const

export function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter()
  const [displayName, setDisplayName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [notice, setNotice] = useState<Notice | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showForgot, setShowForgot] = useState(false)
  const isSignUp = mode === "signup"

  // /login?reset=1 (e.g. an expired reset link) opens the request view directly.
  useEffect(() => {
    if (!isSignUp && new URLSearchParams(window.location.search).get("reset") === "1") {
      setShowForgot(true)
    }
  }, [isSignUp])

  function goAfterSignIn() {
    const requestedNext = new URLSearchParams(window.location.search).get("next") ?? "/"
    const next = requestedNext.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/"
    router.replace(next)
    router.refresh()
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setNotice(null)
    setIsSubmitting(true)

    const supabase = createClient()
    try {
      if (isSignUp) {
        // Account creation + branded confirmation email are handled server-side
        // (see /api/auth/send-verification), sent from the CEDA sending domain.
        const response = await fetch("/api/auth/send-verification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, displayName }),
        })
        const data = (await response.json().catch(() => ({}))) as { error?: string }
        if (!response.ok) {
          setError(data.error ?? "Unable to create this account. Check your details or try signing in.")
          return
        }
        setNotice({
          title: "Confirm your email",
          body: `We sent a confirmation link to ${email}. Open it to activate your account — an administrator can then grant judge access.`,
        })
        return
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) {
        if (/email not confirmed/i.test(signInError.message)) {
          setError("Please confirm your email first. Re-submit the sign-up form to receive a fresh link.")
        } else if (/invalid login credentials/i.test(signInError.message)) {
          setError("Invalid email or password.")
        } else {
          setError("Sign in could not be completed. Confirm your email and try again.")
        }
        return
      }
      goAfterSignIn()
    } catch {
      setError("The request could not be completed. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleForgot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setNotice(null)
    setIsSubmitting(true)
    try {
      const response = await fetch("/api/auth/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const data = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) {
        setError(data.error ?? "We could not send a reset link. Please try again.")
        return
      }
      setNotice({
        title: "Check your inbox",
        body: `If ${email} matches an account, a password-reset link is on its way. Open it to choose a new password.`,
      })
    } catch {
      setError("The request could not be completed. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  async function signInAsDemo(account: DemoAccount) {
    setError("")
    setNotice(null)
    setEmail(account.email)
    setPassword(account.password)
    setIsSubmitting(true)
    try {
      const supabase = createClient()
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: account.email, password: account.password })
      if (signInError) {
        setError("This demo account is not ready yet. Try again shortly.")
        return
      }
      goAfterSignIn()
    } catch {
      setError("The request could not be completed. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const inputClass = "h-10 rounded-lg border border-[#E7DED1] bg-[#FAF8F4] px-3 text-sm text-[#2A2118] outline-none placeholder:text-[#B8A99A] focus:border-[#C9961E]"
  const labelClass = "flex flex-col gap-2 text-xs font-medium text-[#5D4037]"
  const submitClass = "mt-1 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#6E2C24] text-sm font-medium text-white transition-colors hover:bg-[#8A3B2A] disabled:cursor-not-allowed disabled:opacity-60"

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#FAF8F4] px-4 py-10 text-[#2A2118]">
      <div className="w-full max-w-[420px]">
        <Link href="/login" className="mb-8 flex items-center gap-3" aria-label="CEDA judging portal home">
          <span className="flex size-11 items-center justify-center overflow-hidden rounded-xl border border-[#E7DED1] bg-white">
            <Image src="/ceda-icon.svg" alt="CEDA" width={32} height={32} className="size-8" priority />
          </span>
          <span><span className="block text-sm font-semibold text-[#2A2118]">CEDA</span><span className="block text-[11px] text-[#8C7B6A]">Hackathon judging portal</span></span>
        </Link>

        <section className="rounded-2xl border border-[#E7DED1] bg-white p-6 shadow-xl sm:p-8">
          {notice ? (
            <div className="py-4 text-center">
              <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50"><MailCheck className="size-5 text-emerald-600" aria-hidden="true" /></span>
              <h1 className="text-lg font-semibold text-[#2A2118]">{notice.title}</h1>
              <p className="mt-2 text-sm leading-6 text-[#5D4037]">{notice.body}</p>
              <Link href="/login" onClick={() => setNotice(null)} className="mt-5 inline-flex items-center gap-2 text-sm text-[#6E2C24] hover:text-[#8A3B2A]">Back to sign in <ArrowRight className="size-4" aria-hidden="true" /></Link>
            </div>
          ) : showForgot ? (
            <>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8C7B6A]">Account recovery</p>
              <h1 className="text-xl font-semibold tracking-tight text-[#2A2118]">Reset your password</h1>
              <p className="mt-2 text-sm leading-5 text-[#5D4037]">Enter the email on your account and we&apos;ll send a reset link.</p>
              <form onSubmit={handleForgot} className="mt-6 flex flex-col gap-4">
                <label className={labelClass}>Email<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} /></label>
                {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
                <button type="submit" disabled={isSubmitting} className={submitClass}>
                  {isSubmitting ? "Sending…" : "Send reset link"}
                  {!isSubmitting && <ArrowRight className="size-4" aria-hidden="true" />}
                </button>
              </form>
              <button type="button" onClick={() => { setShowForgot(false); setError("") }} className="mt-5 inline-flex w-full items-center justify-center gap-2 text-xs text-[#8C7B6A] hover:text-[#6E2C24]"><ArrowLeft className="size-3.5" aria-hidden="true" /> Back to sign in</button>
            </>
          ) : (
            <>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8C7B6A]">{isSignUp ? "New participant" : "Evaluator access"}</p>
              <h1 className="text-xl font-semibold tracking-tight text-[#2A2118]">{isSignUp ? "Create your account" : "Welcome back"}</h1>
              <p className="mt-2 text-sm leading-5 text-[#5D4037]">{isSignUp ? "Sign up to submit a project. Judge access is granted by an administrator." : "Sign in to review CEDA hackathon submissions."}</p>
              <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
                {isSignUp && (
                  <label className={labelClass}>Full name<input required autoComplete="name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} className={inputClass} /></label>
                )}
                <label className={labelClass}>Email<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} /></label>
                <label className={labelClass}>
                  <span className="flex items-center justify-between">
                    <span>Password</span>
                    {!isSignUp && (
                      <button type="button" onClick={() => { setShowForgot(true); setError("") }} className="inline-flex items-center gap-1 text-[11px] font-normal text-[#8C7B6A] hover:text-[#6E2C24]">
                        <KeyRound className="size-3" aria-hidden="true" /> Forgot password?
                      </button>
                    )}
                  </span>
                  <input required type="password" minLength={8} autoComplete={isSignUp ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} className={inputClass} />
                </label>
                {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
                <button type="submit" disabled={isSubmitting} className={submitClass}>
                  {isSubmitting ? "Please wait…" : isSignUp ? "Create account" : "Sign in"}
                  {!isSubmitting && <ArrowRight className="size-4" aria-hidden="true" />}
                </button>
              </form>

              {!isSignUp && (
                <div className="mt-6 border-t border-[#E7DED1] pt-5">
                  <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8C7B6A]">Demo accounts</p>
                  <div className="flex flex-col gap-2">
                    {DEMO_ACCOUNTS.map((account) => {
                      const Icon = ROLE_ICON[account.role]
                      return (
                        <button
                          key={account.role}
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => signInAsDemo(account)}
                          className="group flex items-center gap-3 rounded-lg border border-[#E7DED1] bg-[#FAF8F4] px-3 py-2 text-left transition-colors hover:border-[#C9961E] hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-[#E7DED1] bg-white text-[#6E2C24] group-hover:border-[#C9961E]"><Icon className="size-4" aria-hidden="true" /></span>
                          <span className="min-w-0">
                            <span className="block text-xs font-medium text-[#2A2118]">{account.label}</span>
                            <span className="block truncate text-[11px] text-[#8C7B6A]">{account.email} · {account.blurb}</span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                  <p className="mt-3 text-[10px] leading-4 text-[#8C7B6A]">One click signs you in with the role&apos;s permissions — no password required.</p>
                </div>
              )}

              <p className="mt-5 text-center text-xs text-[#8C7B6A]">{isSignUp ? "Already registered?" : "Need an account?"} <Link href={isSignUp ? "/login" : "/signup"} className="font-medium text-[#6E2C24] hover:text-[#8A3B2A]">{isSignUp ? "Sign in" : "Sign up"}</Link></p>
            </>
          )}
        </section>
        <p className="mt-5 text-center text-[10px] leading-4 text-[#8C7B6A]">Accounts are private. Only approved judges can submit evaluations.</p>
      </div>
    </main>
  )
}

"use client"

import { useEffect, useState, type FormEvent } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { ArrowRight, CheckCircle2, KeyRound, MailCheck } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

type Phase = "checking" | "ready" | "invalid" | "done"

export default function ResetPasswordPage() {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>("checking")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth
      .getUser()
      .then(({ data }) => setPhase(data.user ? "ready" : "invalid"))
      .catch(() => setPhase("invalid"))
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    if (password.length < 8) {
      setError("Choose a password of at least 8 characters.")
      return
    }
    if (password !== confirm) {
      setError("The passwords do not match.")
      return
    }

    setIsSubmitting(true)
    try {
      const supabase = createClient()
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) {
        setError(/session|expired|invalid/i.test(updateError.message) ? "This reset link has expired. Request a new one." : "Your password could not be updated. Please try again.")
        return
      }
      setPhase("done")
      setTimeout(() => {
        router.replace("/")
        router.refresh()
      }, 1200)
    } catch {
      setError("The request could not be completed. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#FAF8F4] px-4 py-10 text-[#2A2118]">
      <div className="w-full max-w-[420px]">
        <Link href="/login" className="mb-8 flex items-center gap-3" aria-label="CEDA judging portal home">
          <span className="flex size-11 items-center justify-center overflow-hidden rounded-xl border border-[#E7DED1] bg-white">
            <Image src="/logo-mark.png" alt="CEDA" width={32} height={32} className="size-8 object-contain" priority />
          </span>
          <span><span className="block text-sm font-semibold text-[#2A2118]">CEDA</span><span className="block text-[11px] text-[#8C7B6A]">Hackathon judging portal</span></span>
        </Link>
        <section className="rounded-2xl border border-[#E7DED1] bg-white p-6 shadow-xl sm:p-8">
          {phase === "checking" && (
            <p className="py-6 text-center text-sm text-[#8C7B6A]">Verifying your reset link…</p>
          )}

          {phase === "invalid" && (
            <div className="py-4 text-center">
              <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full border border-amber-200 bg-amber-50"><KeyRound className="size-5 text-amber-600" aria-hidden="true" /></span>
              <h1 className="text-lg font-semibold text-[#2A2118]">Reset link needed</h1>
              <p className="mt-2 text-sm leading-6 text-[#5D4037]">This page is only reachable from a password-reset email. Request a fresh link and open it here.</p>
              <Link href="/login?reset=1" className="mt-5 inline-flex items-center gap-2 text-sm text-[#6E2C24] hover:text-[#8A3B2A]">Request a reset link <ArrowRight className="size-4" aria-hidden="true" /></Link>
            </div>
          )}

          {phase === "ready" && (
            <>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8C7B6A]">Account recovery</p>
              <h1 className="text-xl font-semibold tracking-tight text-[#2A2118]">Choose a new password</h1>
              <p className="mt-2 text-sm leading-5 text-[#5D4037]">Pick a password of at least 8 characters. You will be signed in once it is saved.</p>
              <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
                <label className="flex flex-col gap-2 text-xs font-medium text-[#5D4037]">New password<input required type="password" minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="h-10 rounded-lg border border-[#E7DED1] bg-[#FAF8F4] px-3 text-sm text-[#2A2118] outline-none placeholder:text-[#B8A99A] focus:border-[#C9961E]" /></label>
                <label className="flex flex-col gap-2 text-xs font-medium text-[#5D4037]">Confirm password<input required type="password" minLength={8} autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} className="h-10 rounded-lg border border-[#E7DED1] bg-[#FAF8F4] px-3 text-sm text-[#2A2118] outline-none placeholder:text-[#B8A99A] focus:border-[#C9961E]" /></label>
                {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
                <button type="submit" disabled={isSubmitting} className="mt-1 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#6E2C24] text-sm font-medium text-white transition-colors hover:bg-[#8A3B2A] disabled:cursor-not-allowed disabled:opacity-60">
                  {isSubmitting ? "Saving…" : "Save new password"}
                  {!isSubmitting && <ArrowRight className="size-4" aria-hidden="true" />}
                </button>
              </form>
            </>
          )}

          {phase === "done" && (
            <div className="py-4 text-center">
              <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50"><CheckCircle2 className="size-5 text-emerald-600" aria-hidden="true" /></span>
              <h1 className="text-lg font-semibold text-[#2A2118]">Password updated</h1>
              <p className="mt-2 text-sm leading-6 text-[#5D4037]">You are being signed in and redirected to your dashboard.</p>
            </div>
          )}
        </section>
        {phase !== "done" && (
          <p className="mt-5 flex items-center justify-center gap-2 text-center text-[10px] leading-4 text-[#8C7B6A]"><MailCheck className="size-3.5" aria-hidden="true" /> Reset links expire quickly for your security.</p>
        )}
      </div>
    </main>
  )
}

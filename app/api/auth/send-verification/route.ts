import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendEmail, verificationEmail } from "@/lib/email"

export const runtime = "nodejs"

/** Builds the public origin used for email redirect links. */
function resolveOrigin(request: Request) {
  const configured = process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL
  if (configured) {
    try {
      return new URL(configured).origin
    } catch {
      /* fall through to request origin */
    }
  }
  return new URL(request.url).origin
}

/**
 * Creates the account if needed and sends a branded email-confirmation link
 * from the CEDA sending domain (via Resend). Mirrors what auth-form.tsx used to
 * get from Supabase's built-in confirmation email.
 */
export async function POST(request: Request) {
  let body: { email?: string; password?: string; displayName?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 })
  }

  const email = body.email?.trim().toLowerCase()
  const password = body.password ?? ""
  const displayName = body.displayName?.trim() ?? ""

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Choose a password of at least 8 characters." }, { status: 400 })
  }

  const redirectTo = `${resolveOrigin(request)}/auth/callback`

  try {
    const admin = createAdminClient()
    const { data, error } = await admin.auth.admin.generateLink({
      type: "signup",
      email,
      password,
      options: {
        data: displayName ? { display_name: displayName } : undefined,
        redirectTo,
      },
    })

    if (error) {
      const alreadyRegistered = /already|registered|exists/i.test(error.message)
      return NextResponse.json(
        {
          error: alreadyRegistered
            ? "This email already has an account. Sign in or reset your password."
            : "We could not send a confirmation email to this address.",
        },
        { status: alreadyRegistered ? 409 : 400 },
      )
    }

    const link = data.properties?.action_link
    if (!link) {
      return NextResponse.json({ error: "We could not generate a confirmation link." }, { status: 502 })
    }

    const message = verificationEmail({ name: displayName, link })
    await sendEmail({ to: email, subject: message.subject, html: message.html, text: message.text })

    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error."
    return NextResponse.json({ error: `Confirmation email could not be sent. ${message}` }, { status: 500 })
  }
}

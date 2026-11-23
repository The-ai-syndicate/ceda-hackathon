import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendEmail, passwordResetEmail } from "@/lib/email"

export const runtime = "nodejs"

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
 * Emails a password-reset link. Always resolves successfully so the endpoint
 * cannot be used to enumerate registered addresses.
 */
export async function POST(request: Request) {
  let body: { email?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 })
  }

  const email = body.email?.trim().toLowerCase()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 })
  }

  const redirectTo = `${resolveOrigin(request)}/auth/callback?next=/reset-password`

  try {
    const admin = createAdminClient()
    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo },
    })

    if (error || !data.properties?.action_link) {
      // Unknown address: report success without sending, to avoid enumeration.
      return NextResponse.json({ ok: true })
    }

    const message = passwordResetEmail({ link: data.properties.action_link })
    await sendEmail({ to: email, subject: message.subject, html: message.html, text: message.text })

    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error."
    return NextResponse.json({ error: `Reset email could not be sent. ${message}` }, { status: 500 })
  }
}

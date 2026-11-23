import "server-only"

/**
 * Transactional email via the Resend REST API.
 *
 * No `resend` npm dependency is used — we POST to api.resend.com directly so
 * the app keeps a single outbound transport. Every message is sent from the
 * verified `MAIL_FROM_DOMAIN` sending domain.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails"

const BRAND = {
  cream: "#FAF8F4",
  card: "#FFFFFF",
  border: "#E7DED1",
  ink: "#2A2118",
  body: "#5D4037",
  muted: "#8C7B6A",
  brown: "#6E2C24",
  brownDark: "#8A3B2A",
  gold: "#C9961E",
} as const

export type SendEmailInput = {
  to: string | string[]
  subject: string
  html: string
  text: string
  replyTo?: string
}

function fromAddress() {
  const address = process.env.MAIL_FROM_ADDRESS ?? "noreply@apptest.obokengmakwati.com"
  const name = process.env.MAIL_FROM_NAME ?? "CEDA Hackathon"
  return `${name} <${address}>`
}

/** Sends a single email through Resend. Throws on a non-2xx response. */
export async function sendEmail(input: SendEmailInput) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error("RESEND_API_KEY is not configured.")

  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromAddress(),
      to: Array.isArray(input.to) ? input.to : [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
      ...(input.replyTo ? { reply_to: input.replyTo } : {}),
    }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => "")
    throw new Error(`Resend rejected the message (${response.status}): ${detail.slice(0, 300)}`)
  }

  return (await response.json()) as { id: string }
}

/** Shared, brand-aligned wrapper for every transactional message. */
function renderLayout({ heading, intro, bodyHtml }: { heading: string; intro: string; bodyHtml: string }) {
  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:${BRAND.cream};color:${BRAND.ink};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.cream};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:${BRAND.card};border:1px solid ${BRAND.border};border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:20px 28px;border-bottom:1px solid ${BRAND.border};">
                <span style="display:inline-block;font-size:15px;font-weight:700;letter-spacing:0.04em;color:${BRAND.brown};">CEDA</span>
                <span style="display:inline-block;margin-left:8px;font-size:12px;color:${BRAND.muted};">Hackathon judging portal</span>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:${BRAND.ink};">${heading}</h1>
                <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:${BRAND.body};">${intro}</p>
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px;border-top:1px solid ${BRAND.border};">
                <p style="margin:0;font-size:11px;line-height:1.6;color:${BRAND.muted};">
                  CEDA Hackathon · This is an automated message, please do not reply directly.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

function button(href: string, label: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
    <tr>
      <td style="border-radius:10px;background:${BRAND.brown};">
        <a href="${href}" style="display:inline-block;padding:12px 22px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">${label}</a>
      </td>
    </tr>
  </table>
  <p style="margin:0 0 6px;font-size:11px;color:${BRAND.muted};">Or paste this link into your browser:</p>
  <p style="margin:0;font-size:12px;line-height:1.6;color:${BRAND.body};word-break:break-all;"><a href="${href}" style="color:${BRAND.brownDark};">${href}</a></p>`
}

/* -------------------------------------------------------------------------- */
/* Templates                                                                  */
/* -------------------------------------------------------------------------- */

export function verificationEmail({ name, link }: { name?: string; link: string }) {
  const greeting = name?.trim() ? `Hi ${name.trim()},` : "Hi there,"
  return {
    subject: "Confirm your CEDA Hackathon email",
    html: renderLayout({
      heading: "Confirm your email address",
      intro: `${greeting} thanks for signing up for the CEDA Hackathon judging portal. Confirm this address to activate your account.`,
      bodyHtml: button(link, "Confirm email"),
    }),
    text: `${greeting}\n\nConfirm your CEDA Hackathon email by opening this link:\n${link}\n\nIf you did not create an account you can ignore this message.`,
  }
}

export function passwordResetEmail({ name, link }: { name?: string; link: string }) {
  const greeting = name?.trim() ? `Hi ${name.trim()},` : "Hi there,"
  return {
    subject: "Reset your CEDA Hackathon password",
    html: renderLayout({
      heading: "Reset your password",
      intro: `${greeting} we received a request to reset the password on your CEDA Hackathon account. This link expires shortly.`,
      bodyHtml: button(link, "Choose a new password"),
    }),
    text: `${greeting}\n\nReset your CEDA Hackathon password with this link:\n${link}\n\nIf you did not request this, no action is needed.`,
  }
}

export type SubmissionAlertInput = {
  projectTitle: string
  projectId: string
  developer?: string
  ownerEmail: string
  projectUrl?: string
  screenshotCount: number
  documentationCount: number
  capabilityScore?: number
  judgeSummary?: string
  /** Applicant-written idea summary captured at submission time. */
  ideaSummary?: string
  dashboardUrl: string
}

/** Applicant alert — sent to the submitter and the admin mailbox on submission. */
export function submissionAlertEmail(input: SubmissionAlertInput) {
  const rows: Array<[string, string]> = [
    ["Project", input.projectTitle],
    ["Submitted by", input.developer?.trim() || input.ownerEmail],
    ["Submitter email", input.ownerEmail],
    ["Reference", input.projectId],
    ["Screenshots", String(input.screenshotCount)],
    ["Documents", String(input.documentationCount)],
  ]
  if (typeof input.capabilityScore === "number") rows.push(["Capability score", `${input.capabilityScore}/100`])

  const tableRows = rows
    .map(
      ([label, value]) => `<tr>
        <td style="padding:8px 0;font-size:12px;color:${BRAND.muted};width:40%;vertical-align:top;">${label}</td>
        <td style="padding:8px 0;font-size:13px;color:${BRAND.ink};vertical-align:top;">${value}</td>
      </tr>`,
    )
    .join("")

  const linkBlock = input.projectUrl
    ? `<p style="margin:0 0 20px;font-size:13px;line-height:1.6;color:${BRAND.body};">
        Project link: <a href="${input.projectUrl}" style="color:${BRAND.brownDark};word-break:break-all;">${input.projectUrl}</a>
      </p>`
    : ""

  const summaryBlock = input.judgeSummary
    ? `<p style="margin:0 0 20px;padding:14px 16px;background:${BRAND.cream};border:1px solid ${BRAND.border};border-radius:10px;font-size:13px;line-height:1.6;color:${BRAND.body};">
        <strong style="color:${BRAND.ink};">AI summary:</strong> ${input.judgeSummary}
      </p>`
    : ""

  const ideaSummaryBlock = input.ideaSummary
    ? `<div style="margin:0 0 20px;">
        <p style="margin:0 0 6px;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${BRAND.muted};">Idea summary from the team</p>
        <p style="margin:0;padding:14px 16px;border-left:3px solid ${BRAND.gold};background:${BRAND.cream};border-radius:0 10px 10px 0;font-size:13px;line-height:1.7;color:${BRAND.body};white-space:pre-wrap;">${input.ideaSummary}</p>
      </div>`
    : ""

  return {
    subject: `New CEDA Hackathon submission — ${input.projectTitle}`,
    html: renderLayout({
      heading: "New project submission received",
      intro: "A project archive has been analysed and registered for judging. Details are below.",
      bodyHtml: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border-top:1px solid ${BRAND.border};">${tableRows}</table>
        ${ideaSummaryBlock}
        ${linkBlock}
        ${summaryBlock}
        ${button(input.dashboardUrl, "Open in dashboard")}`,
    }),
    text: `New CEDA Hackathon submission\n\n${rows.map(([l, v]) => `${l}: ${v}`).join("\n")}${input.ideaSummary ? `\n\nIdea summary from the team:\n${input.ideaSummary}` : ""}${input.projectUrl ? `\nProject link: ${input.projectUrl}` : ""}\n\nOpen the dashboard: ${input.dashboardUrl}`,
  }
}

/** All configured applicant-alert recipients (admin mailbox + submitter). */
export function applicantAlertRecipients(ownerEmail?: string | null) {
  const admin = process.env.ADMIN_ALERT_EMAIL?.trim()
  const recipients = new Set<string>()
  if (ownerEmail) recipients.add(ownerEmail)
  if (admin) recipients.add(admin)
  return Array.from(recipients)
}

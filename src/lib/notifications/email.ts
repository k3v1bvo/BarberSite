import { Resend } from 'resend'
import { buildEmail, type EmailTemplateInput } from './templates'

const FROM =
  process.env.RESEND_FROM_EMAIL || 'Barber Pro <onboarding@resend.dev>'

let resendClient: Resend | null = null

/** Cliente Resend solo al enviar (evita error de build si falta RESEND_API_KEY) */
function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY?.trim()
  if (!key || key === 're_placeholder_123') return null
  if (!resendClient) resendClient = new Resend(key)
  return resendClient
}

export function isEmailConfigured(): boolean {
  return Boolean(getResend())
}

export async function sendNotificationEmail(
  to: string,
  templateKind: string,
  data: EmailTemplateInput
): Promise<{ ok: boolean; error?: string }> {
  if (!to || !isEmailConfigured()) {
    return { ok: false, error: 'Email no configurado o destinatario vacío' }
  }

  const resend = getResend()
  if (!resend) {
    return { ok: false, error: 'RESEND_API_KEY no configurada' }
  }

  try {
    const { subject, html } = buildEmail(templateKind, data)
    const { error } = await resend.emails.send({ from: FROM, to, subject, html })
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error enviando email' }
  }
}

export async function sendAdminEmail(
  templateKind: string,
  data: EmailTemplateInput
): Promise<{ ok: boolean; error?: string }> {
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL
  if (!adminEmail) return { ok: false, error: 'ADMIN_NOTIFICATION_EMAIL no definido' }
  return sendNotificationEmail(adminEmail, templateKind, data)
}

import nodemailer from 'nodemailer'
import { buildEmail, type EmailTemplateInput } from './templates'

// ==========================================
// CONFIGURACIÓN PRINCIPAL: Nodemailer (Gmail App Password)
// Fallback: Resend API (si Gmail falla)
// ==========================================

const SMTP_USER = process.env.SMTP_USER || 'barbersiteadmin@gmail.com'
const SMTP_PASS = process.env.SMTP_PASS || 'nray vsaf seuo uajn'
const FROM_EMAIL = process.env.SMTP_FROM || `"BarberSite" <${SMTP_USER}>`

// Resend como fallback
const RESEND_API_KEY = process.env.RESEND_API_KEY || ''
const RESEND_FROM = process.env.RESEND_FROM_EMAIL || 'BarberSite <onboarding@resend.dev>'

let transporter: nodemailer.Transporter | null = null

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    })
  }
  return transporter
}

export function isEmailConfigured(): boolean {
  return Boolean(SMTP_USER && SMTP_PASS)
}

/**
 * Enviar email con Nodemailer (Gmail App Password) — PRINCIPAL
 */
async function sendWithNodemailer(
  to: string,
  subject: string,
  html: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const t = getTransporter()
    await t.sendMail({ from: FROM_EMAIL, to, subject, html })
    console.log(`[email/gmail] ✓ Enviado a ${to}`)
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error nodemailer'
    console.error(`[email/gmail] Error enviando a ${to}:`, msg)
    return { ok: false, error: msg }
  }
}

/**
 * Enviar email con Resend API — FALLBACK
 */
async function sendWithResend(
  to: string,
  subject: string,
  html: string
): Promise<{ ok: boolean; error?: string }> {
  if (!RESEND_API_KEY || RESEND_API_KEY === 're_placeholder_123') {
    return { ok: false, error: 'Resend no configurado' }
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [to],
        subject,
        html,
      }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      return { ok: false, error: (body as any)?.message || `HTTP ${res.status}` }
    }
    console.log(`[email/resend] ✓ Enviado a ${to}`)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error Resend' }
  }
}

export async function sendNotificationEmail(
  to: string,
  templateKind: string,
  data: EmailTemplateInput
): Promise<{ ok: boolean; error?: string }> {
  if (!to) {
    return { ok: false, error: 'Destinatario vacío' }
  }

  if (!isEmailConfigured()) {
    return { ok: false, error: 'Email no configurado' }
  }

  try {
    const { subject, html } = buildEmail(templateKind, data)

    // Gmail primero (es lo que funciona)
    const gmailResult = await sendWithNodemailer(to, subject, html)
    if (gmailResult.ok) return gmailResult

    // Si Gmail falla, intentar Resend como fallback
    console.log(`[email] Gmail falló para ${to}, intentando Resend como fallback...`)
    const resendResult = await sendWithResend(to, subject, html)
    if (resendResult.ok) return resendResult

    // Retornar el error original de Gmail
    return gmailResult
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error enviando email' }
  }
}

// ==========================================
// FUNCIÓN COMÚN (Email de Administrador)
// ==========================================
export async function sendAdminEmail(
  templateKind: string,
  data: EmailTemplateInput
): Promise<{ ok: boolean; error?: string }> {
  const adminEmail = (process.env.ADMIN_NOTIFICATION_EMAIL || process.env.SMTP_USER || 'barbersiteadmin@gmail.com').toLowerCase().trim()
  if (!adminEmail) return { ok: false, error: 'ADMIN_NOTIFICATION_EMAIL no definido' }
  return sendNotificationEmail(adminEmail, templateKind, data)
}

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string
  subject: string
  html: string
}): Promise<{ ok: boolean; error?: string }> {
  if (!to || !isEmailConfigured()) {
    return { ok: false, error: 'Email no configurado o destinatario vacío' }
  }
  // Gmail primero, Resend fallback
  const result = await sendWithNodemailer(to, subject, html)
  if (result.ok) return result
  return await sendWithResend(to, subject, html)
}

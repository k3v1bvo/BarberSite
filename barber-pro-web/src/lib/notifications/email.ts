import nodemailer from 'nodemailer'
import { buildEmail, type EmailTemplateInput } from './templates'

// ==========================================
// CONFIGURACIÓN DUAL: Resend (primario) + Nodemailer (fallback)
// ==========================================

const SMTP_USER = process.env.SMTP_USER || ''
const SMTP_PASS = process.env.SMTP_PASS || ''
const FROM_EMAIL = process.env.SMTP_FROM || (SMTP_USER ? `"BarberSite" <${SMTP_USER}>` : '"BarberSite" <barbersiteadmin@gmail.com>')

// Resend config
const RESEND_API_KEY = process.env.RESEND_API_KEY || ''
const RESEND_FROM = process.env.RESEND_FROM_EMAIL || 'BarberSite <onboarding@resend.dev>'

let transporter: nodemailer.Transporter | null = null

function getTransporter() {
  if (!transporter && SMTP_USER && SMTP_PASS) {
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

function hasResend(): boolean {
  return Boolean(RESEND_API_KEY && RESEND_API_KEY !== 're_placeholder_123')
}

function hasNodemailer(): boolean {
  return Boolean(SMTP_USER && SMTP_PASS)
}

export function isEmailConfigured(): boolean {
  return hasResend() || hasNodemailer()
}

/**
 * Enviar email con Resend API (fetch directo, sin SDK)
 */
async function sendWithResend(
  to: string,
  subject: string,
  html: string
): Promise<{ ok: boolean; error?: string }> {
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
      const errMsg = (body as any)?.message || `HTTP ${res.status}`
      console.error(`[email/resend] Error: ${errMsg}`)
      return { ok: false, error: errMsg }
    }
    console.log(`[email/resend] ✓ Enviado a ${to}`)
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error Resend'
    console.error(`[email/resend] Exception:`, msg)
    return { ok: false, error: msg }
  }
}

/**
 * Enviar email con Nodemailer (Gmail SMTP)
 */
async function sendWithNodemailer(
  to: string,
  subject: string,
  html: string
): Promise<{ ok: boolean; error?: string }> {
  const t = getTransporter()
  if (!t) return { ok: false, error: 'Nodemailer no configurado (falta SMTP_USER/SMTP_PASS)' }
  try {
    await t.sendMail({ from: FROM_EMAIL, to, subject, html })
    console.log(`[email/nodemailer] ✓ Enviado a ${to}`)
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error nodemailer'
    console.error(`[email/nodemailer] Error:`, msg)
    return { ok: false, error: msg }
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
    console.warn('[email] No hay proveedor configurado (ni RESEND_API_KEY ni SMTP_USER/SMTP_PASS)')
    return { ok: false, error: 'Email no configurado' }
  }

  try {
    const { subject, html } = buildEmail(templateKind, data)

    // Intentar con Resend primero (más confiable en serverless)
    if (hasResend()) {
      const resendResult = await sendWithResend(to, subject, html)
      if (resendResult.ok) return resendResult

      // Si Resend falla, intentar con Nodemailer como fallback
      if (hasNodemailer()) {
        console.log(`[email] Resend falló, intentando con Nodemailer...`)
        return await sendWithNodemailer(to, subject, html)
      }
      return resendResult
    }

    // Si no hay Resend, usar Nodemailer directamente
    if (hasNodemailer()) {
      return await sendWithNodemailer(to, subject, html)
    }

    return { ok: false, error: 'Ningún proveedor de email disponible' }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error enviando email'
    console.error('[email] Error general:', msg)
    return { ok: false, error: msg }
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

  // Intentar Resend primero, luego Nodemailer
  if (hasResend()) {
    const result = await sendWithResend(to, subject, html)
    if (result.ok) return result
    if (hasNodemailer()) return await sendWithNodemailer(to, subject, html)
    return result
  }

  if (hasNodemailer()) {
    return await sendWithNodemailer(to, subject, html)
  }

  return { ok: false, error: 'Ningún proveedor disponible' }
}

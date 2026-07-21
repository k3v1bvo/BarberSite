// import { Resend } from 'resend'
import nodemailer from 'nodemailer'
import { buildEmail, type EmailTemplateInput } from './templates'

/*
// ==========================================
// 1. CONFIGURACIÓN CON RESEND (Comentada)
// ==========================================
const FROM = process.env.RESEND_FROM_EMAIL || 'BarberSite <onboarding@resend.dev>'

let resendClient: Resend | null = null

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
*/

// ==========================================
// 2. CONFIGURACIÓN CON NODEMAILER (Gmail App Password)
// ==========================================
const SMTP_USER = process.env.SMTP_USER || 'barbersiteadmin@gmail.com'
const SMTP_PASS = process.env.SMTP_PASS || 'nray vsaf seuo uajn'
const FROM_EMAIL = process.env.SMTP_FROM || `"BarberSite" <${SMTP_USER}>`

let transporter: nodemailer.Transporter | null = null

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail', // Usa el servicio de Gmail
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

export async function sendNotificationEmail(
  to: string,
  templateKind: string,
  data: EmailTemplateInput
): Promise<{ ok: boolean; error?: string }> {
  if (!to || !isEmailConfigured()) {
    return { ok: false, error: 'Email no configurado o destinatario vacío' }
  }

  try {
    const { subject, html } = buildEmail(templateKind, data)
    const mailOptions = {
      from: FROM_EMAIL,
      to,
      subject,
      html,
    }

    const t = getTransporter()
    await t.sendMail(mailOptions)
    
    return { ok: true }
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
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL
  if (!adminEmail) return { ok: false, error: 'ADMIN_NOTIFICATION_EMAIL no definido' }
  return sendNotificationEmail(adminEmail, templateKind, data)
}

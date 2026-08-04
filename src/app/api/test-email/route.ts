import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

export async function GET() {
  try {
    const SMTP_USER = process.env.SMTP_USER || 'tucorreo@gmail.com'
    const SMTP_PASS = process.env.SMTP_PASS || 'vacio'
    
    const passCensurada = SMTP_PASS.substring(0, 3) + '...' + (SMTP_PASS.includes('"') ? ' (TIENE COMILLAS)' : ' (NO TIENE COMILLAS)')

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    })

    const info = await transporter.sendMail({
      from: `"Test Barber Pro" <${SMTP_USER}>`,
      to: SMTP_USER,
      subject: 'Prueba de Correo',
      text: 'Si te llega esto, el correo funciona.',
    })

    return NextResponse.json({ 
      ok: true, 
      mensaje: 'Correo enviado con éxito!', 
      info, 
      configuracion: { SMTP_USER, passCensurada } 
    })
  } catch (error: any) {
    return NextResponse.json({ 
      ok: false, 
      error: error.message,
      stack: error.stack,
      hint: 'Revisa tu contraseña de aplicación en Google o si Vercel tiene mal la variable.'
    }, { status: 500 })
  }
}

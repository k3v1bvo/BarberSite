import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ 
    mensaje: 'El endpoint temporal de diagnóstico fue retirado exitosamente tras completar y sincronizar la conciliación de saldos.' 
  }, { status: 404 })
}

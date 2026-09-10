import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'No se proporcionó ningún archivo de imagen' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const mimeType = file.type || 'image/jpeg'

    // Intentar guardar en Supabase Storage si el bucket 'avatars' existe
    try {
      const supabase = await createServerSupabaseClient()
      const fileName = `avatar_${Date.now()}_${Math.random().toString(36).substring(7)}.${file.name.split('.').pop() || 'jpg'}`
      
      const { data: storageData, error: storageErr } = await supabase
        .storage
        .from('avatars')
        .upload(fileName, buffer, {
          contentType: mimeType,
          upsert: true
        })

      if (!storageErr && storageData) {
        const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(fileName)
        if (publicUrlData?.publicUrl) {
          return NextResponse.json({ url: publicUrlData.publicUrl, success: true })
        }
      }
    } catch (sErr) {
      console.warn('Supabase Storage no disponible, el cliente debe usar ImgBB/Catbox:', sErr)
    }

    // NO retornar Base64 — devolver error para que el cliente use servicios externos
    return NextResponse.json(
      { error: 'No se pudo subir al storage. Usa un servicio externo de imágenes.' },
      { status: 502 }
    )
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error al procesar la subida de imagen' }, { status: 500 })
  }
}

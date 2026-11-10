import { createAdminSupabaseClient } from '@/lib/supabase/admin'
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

    // Normalizar extensión y tipo MIME
    const originalExt = (file.name.split('.').pop() || 'jpg').toLowerCase()
    let cleanExt = originalExt
    if (cleanExt === 'jpeg') cleanExt = 'jpg'

    let mimeType = file.type || 'image/jpeg'
    if (mimeType === 'image/jpg') mimeType = 'image/jpeg'
    if (!mimeType.startsWith('image/')) mimeType = 'image/jpeg'

    const fileName = `img_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${cleanExt}`

    // 1. INTENTO PRINCIPAL: Supabase Storage nativo (bucket 'general' o 'avatars')
    // Usamos el cliente admin con Service Role para evitar bloqueos por políticas RLS
    try {
      const adminSupabase = createAdminSupabaseClient() || await createServerSupabaseClient()
      
      // Probar en bucket 'general' primero, o fallback a 'avatars'
      let uploadBucket = 'general'
      let { data: storageData, error: storageErr } = await adminSupabase
        .storage
        .from(uploadBucket)
        .upload(fileName, buffer, {
          contentType: mimeType,
          upsert: true,
        })

      // Si falla 'general', probar 'avatars'
      if (storageErr) {
        uploadBucket = 'avatars'
        const retry = await adminSupabase
          .storage
          .from(uploadBucket)
          .upload(fileName, buffer, {
            contentType: mimeType,
            upsert: true,
          })
        storageData = retry.data
        storageErr = retry.error
      }

      if (!storageErr && storageData) {
        const { data: publicUrlData } = adminSupabase.storage.from(uploadBucket).getPublicUrl(fileName)
        if (publicUrlData?.publicUrl) {
          return NextResponse.json({ 
            url: publicUrlData.publicUrl, 
            success: true,
            provider: 'supabase',
            fileName 
          })
        }
      } else if (storageErr) {
        console.warn('Supabase Storage fallo al subir:', storageErr.message)
      }
    } catch (sErr: any) {
      console.warn('Error en Supabase Storage:', sErr?.message)
    }

    // 2. INTENTO OPCIONAL: Cloudinary (si está configurado con cuenta gratis)
    const cCloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
    const cApiKey = process.env.CLOUDINARY_API_KEY
    const cApiSecret = process.env.CLOUDINARY_API_SECRET
    const cPreset = process.env.CLOUDINARY_UPLOAD_PRESET || process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET

    if (cCloudName && (cPreset || (cApiKey && cApiSecret))) {
      try {
        const cForm = new FormData()
        cForm.append('file', `data:${mimeType};base64,${buffer.toString('base64')}`)
        if (cPreset) {
          cForm.append('upload_preset', cPreset)
        } else if (cApiKey && cApiSecret) {
          const timestamp = Math.floor(Date.now() / 1000).toString()
          const crypto = await import('crypto')
          const signature = crypto.createHash('sha1').update(`timestamp=${timestamp}${cApiSecret}`).digest('hex')
          cForm.append('api_key', cApiKey)
          cForm.append('timestamp', timestamp)
          cForm.append('signature', signature)
        }

        const cRes = await fetch(`https://api.cloudinary.com/v1_1/${cCloudName}/image/upload`, {
          method: 'POST',
          body: cForm,
        })
        if (cRes.ok) {
          const cData = await cRes.json()
          if (cData.secure_url) {
            return NextResponse.json({
              url: cData.secure_url,
              success: true,
              provider: 'cloudinary',
              fileName
            })
          }
        }
      } catch (cErr: any) {
        console.warn('Cloudinary upload error:', cErr?.message)
      }
    }

    // 3. FALLBACK SECUNDARIO: Catbox.moe
    try {
      const catboxForm = new FormData()
      catboxForm.append('reqtype', 'fileupload')
      catboxForm.append('userhash', process.env.CATBOX_USER_HASH?.trim() || '15f90080f56ab18494d458380')
      catboxForm.append('fileToUpload', new Blob([buffer], { type: mimeType }), fileName)

      const catRes = await fetch('https://catbox.moe/user/api.php', {
        method: 'POST',
        body: catboxForm,
      })

      if (catRes.ok) {
        const fileUrl = (await catRes.text()).trim()
        if (fileUrl.startsWith('http')) {
          return NextResponse.json({ 
            url: fileUrl, 
            success: true, 
            provider: 'catbox',
            fileName 
          })
        }
      }
    } catch (cErr: any) {
      console.warn('Fallback Catbox falló:', cErr?.message)
    }

    return NextResponse.json(
      { error: 'No se pudo subir la imagen al almacenamiento. Intenta nuevamente.' },
      { status: 500 }
    )
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error al procesar la subida de imagen' }, { status: 500 })
  }
}

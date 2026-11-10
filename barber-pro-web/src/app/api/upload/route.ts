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

    // 1. INTENTO PRINCIPAL: Cloudinary CDN (Almacenamiento multimedia 100% externo a Supabase)
    // Protege la base de datos de Supabase de sobrecostos, llenado de disco o saturación de cuotas.
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
          const folder = 'barbershop_uploads'
          const crypto = await import('crypto')
          const strToSign = `folder=${folder}&timestamp=${timestamp}${cApiSecret}`
          const signature = crypto.createHash('sha1').update(strToSign).digest('hex')
          cForm.append('api_key', cApiKey)
          cForm.append('timestamp', timestamp)
          cForm.append('folder', folder)
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
        } else {
          const errData = await cRes.json().catch(() => ({}))
          console.warn('Cloudinary upload warning:', errData)
        }
      } catch (cErr: any) {
        console.warn('Cloudinary upload error:', cErr?.message)
      }
    }

    // 2. FALLBACK DE CONTINGENCIA: Catbox.moe (Hosting CDN externo gratuito y sin límite, 0 impacto en Supabase)
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
      { error: 'No se pudo subir la imagen a Cloudinary ni al servidor secundario. Verifica tu conexión.' },
      { status: 500 }
    )
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error al procesar la subida de imagen' }, { status: 500 })
  }
}

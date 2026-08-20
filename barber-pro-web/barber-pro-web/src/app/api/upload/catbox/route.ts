import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const DEFAULT_USERHASH = '15f90080f56ab18494d458380'

/**
 * POST /api/upload/catbox
 * Recibe un archivo PDF o documento mediante FormData y lo sube a Catbox.moe usando la API oficial.
 * Retorna la URL directa del archivo en Catbox (https://files.catbox.moe/xxxxx.pdf).
 */
export async function POST(request: NextRequest) {
  try {
    // Se permite la subida a Catbox para usuarios autenticados y reservas/formularios públicos
    try {
      const supabase = await createServerSupabaseClient()
      await supabase.auth.getUser()
    } catch {
      // Ignorar errores de sesión
    }

    // Cualquier usuario autenticado puede subir archivos de avatar/perfil

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No se envió ningún archivo' }, { status: 400 })
    }

    const userhash = process.env.CATBOX_USER_HASH?.trim() || DEFAULT_USERHASH

    // Preparar multipart/form-data para Catbox
    const catboxForm = new FormData()
    catboxForm.append('reqtype', 'fileupload')
    catboxForm.append('userhash', userhash)
    catboxForm.append('fileToUpload', file)

    const catboxRes = await fetch('https://catbox.moe/user/api.php', {
      method: 'POST',
      body: catboxForm,
    })

    if (!catboxRes.ok) {
      const errText = await catboxRes.text()
      throw new Error(`Error en Catbox API (${catboxRes.status}): ${errText}`)
    }

    const fileUrl = (await catboxRes.text()).trim()

    if (!fileUrl.startsWith('http')) {
      throw new Error(`Respuesta inválida de Catbox: ${fileUrl}`)
    }

    return NextResponse.json({
      success: true,
      url: fileUrl,
      fileName: file.name,
      size: file.size,
    })
  } catch (err: any) {
    console.error('Catbox upload error:', err)
    return NextResponse.json({ error: err.message || 'Error al subir archivo a Catbox' }, { status: 500 })
  }
}

/**
 * DELETE /api/upload/catbox
 * Elimina un archivo de Catbox.moe usando el userhash oficial.
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin' && profile?.role !== 'coordinador') {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const { fileUrl } = await request.json()

    if (!fileUrl) {
      return NextResponse.json({ error: 'Se requiere la URL del archivo' }, { status: 400 })
    }

    // Extraer solo el nombre de archivo (ej. https://files.catbox.moe/abc123.pdf -> abc123.pdf)
    const filename = fileUrl.split('/').pop()

    if (!filename) {
      return NextResponse.json({ error: 'Nombre de archivo inválido' }, { status: 400 })
    }

    const userhash = process.env.CATBOX_USER_HASH?.trim() || DEFAULT_USERHASH

    const catboxForm = new FormData()
    catboxForm.append('reqtype', 'deletefiles')
    catboxForm.append('userhash', userhash)
    catboxForm.append('files', filename)

    const catboxRes = await fetch('https://catbox.moe/user/api.php', {
      method: 'POST',
      body: catboxForm,
    })

    const resultText = await catboxRes.text()

    return NextResponse.json({
      success: true,
      mensaje: resultText.trim(),
    })
  } catch (err: any) {
    console.error('Catbox delete error:', err)
    return NextResponse.json({ error: err.message || 'Error al eliminar archivo en Catbox' }, { status: 500 })
  }
}

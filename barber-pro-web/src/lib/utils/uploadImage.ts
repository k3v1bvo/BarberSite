/**
 * Comprime una imagen antes de subirla para reducir su tamaño y acelerar la subida.
 */
async function compressImage(file: File, maxWidth = 1920, maxHeight = 1920, quality = 0.85): Promise<File> {
  // Si no es una imagen (ej. PDF, DOCX), es SVG o es menor a 400KB, se sube directo sin procesar
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml' || file.size < 400 * 1024) {
    return file
  }

  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let width = img.width
      let height = img.height

      if (width > maxWidth || height > maxHeight) {
        if (width > height) {
          height = Math.round((height * maxWidth) / width)
          width = maxWidth
        } else {
          width = Math.round((width * maxHeight) / height)
          height = maxHeight
        }
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) return resolve(file)

      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        (blob) => {
          if (!blob) return resolve(file)
          const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
            type: 'image/jpeg',
            lastModified: Date.now(),
          })
          resolve(compressedFile)
        },
        'image/jpeg',
        quality
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(file)
    }
    img.src = url
  })
}

/**
 * Sube una imagen al almacenamiento del sistema (Supabase Storage nativo con fallback a Catbox/Cloudinary).
 * @param file El archivo de imagen (obtenido de un input type="file")
 * @param retries Cantidad de reintentos en caso de fallos de red (por defecto 2)
 * @returns La URL pública directa de la imagen subida.
 */
export async function uploadImage(file: File, retries = 2): Promise<string> {
  // 1. Comprimir la imagen para evitar fallos de subida por archivos muy pesados (fotos de cámara)
  let fileToUpload = file
  try {
    fileToUpload = await compressImage(file)
  } catch (e) {
    console.warn('No se pudo comprimir la imagen, subiendo archivo original:', e)
  }

  // 2. Intentar subir mediante la API interna de Supabase Storage nativo
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const formData = new FormData()
      formData.append('file', fileToUpload)
      const internalRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })
      if (internalRes.ok) {
        const data = await internalRes.json()
        if (data.url) return data.url
      }
    } catch (e) {
      console.warn(`Intento ${attempt} en API interna falló:`, e)
    }
  }

  // 3. Fallback a Catbox.moe
  try {
    const catboxData = new FormData()
    catboxData.append('file', fileToUpload)
    const catRes = await fetch('/api/upload/catbox', {
      method: 'POST',
      body: catboxData,
    })
    if (catRes.ok) {
      const cData = await catRes.json()
      if (cData.url) return cData.url
    }
  } catch (e) {
    console.warn('Fallback a Catbox también falló:', e)
  }

  throw new Error('No se pudo procesar la subida de la foto. Por favor reintenta.')
}

/**
 * Alias de compatibilidad hacia atrás para uploadImage (reemplaza ImgBB por Supabase Storage nativo).
 */
export const uploadImageToImgBB = uploadImage

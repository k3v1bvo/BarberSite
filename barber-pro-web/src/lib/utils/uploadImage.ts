/**
 * Comprime una imagen antes de subirla para reducir su tamaño y acelerar la subida.
 */
async function compressImage(file: File, maxWidth = 1920, maxHeight = 1920, quality = 0.85): Promise<File> {
  // Si es SVG o es menor a 400KB, se sube directo sin procesar
  if (file.type === 'image/svg+xml' || file.size < 400 * 1024) {
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
 * Sube una imagen a ImgBB con reintentos automáticos y compresión de imagen.
 * @param file El archivo de imagen (obtenido de un input type="file")
 * @param retries Cantidad de reintentos en caso de fallos de red o servidor ImgBB (por defecto 3)
 * @returns La URL de la imagen subida o lanza un error si falla.
 */
export async function uploadImageToImgBB(file: File, retries = 3): Promise<string> {
  const apiKey = process.env.NEXT_PUBLIC_IMGBB_API_KEY

  if (!apiKey) {
    throw new Error('La API Key de ImgBB no está configurada.')
  }

  // 1. Comprimir la imagen para evitar fallos de subida por archivos muy pesados (fotos de cámara)
  let fileToUpload = file
  try {
    fileToUpload = await compressImage(file)
  } catch (e) {
    console.warn('No se pudo comprimir la imagen, subiendo archivo original:', e)
  }

  let lastError: Error = new Error('Error al subir la imagen a ImgBB.')

  // 2. Intentar subir con reintentos automáticos
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const formData = new FormData()
      formData.append('image', fileToUpload)

      const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (data.success) {
        return data.data.url
      } else {
        lastError = new Error(data.error?.message || 'Error al subir la imagen a ImgBB.')
      }
    } catch (error: any) {
      console.error(`Intento ${attempt} falló en uploadImageToImgBB:`, error)
      lastError = new Error(error.message || 'Hubo un problema de conexión al subir la imagen.')
    }

    // Esperar antes del siguiente reintento (1s, 2s)
    if (attempt < retries) {
      await new Promise((res) => setTimeout(res, 1000 * attempt))
    }
  }

  throw lastError
}

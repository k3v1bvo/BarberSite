/**
 * Sube una imagen a ImgBB y devuelve la URL pública directa.
 * @param file El archivo de imagen (obtenido de un input type="file")
 * @returns La URL de la imagen subida o lanza un error si falla.
 */
export async function uploadImageToImgBB(file: File): Promise<string> {
  const apiKey = process.env.NEXT_PUBLIC_IMGBB_API_KEY

  if (!apiKey) {
    throw new Error('La API Key de ImgBB no está configurada.')
  }

  const formData = new FormData()
  formData.append('image', file)

  try {
    const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
      method: 'POST',
      body: formData,
    })

    const data = await response.json()

    if (data.success) {
      return data.data.url
    } else {
      throw new Error(data.error?.message || 'Error al subir la imagen a ImgBB.')
    }
  } catch (error: any) {
    console.error('Error en uploadImageToImgBB:', error)
    throw new Error(error.message || 'Hubo un problema de conexión al subir la imagen.')
  }
}

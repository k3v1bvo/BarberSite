'use client'

import React, { useState, useRef } from 'react'
import { UploadCloud, Image as ImageIcon, X, Loader2, Star, ArrowLeft } from 'lucide-react'
import { uploadImageToImgBB } from '@/lib/utils/uploadImage'

interface MultiImageUploadProps {
  images: string[]
  onImagesChange: (images: string[]) => void
  onUploadError?: (error: string) => void
  label?: string
  maxImages?: number
}

export function MultiImageUpload({
  images = [],
  onImagesChange,
  onUploadError,
  label = "Imágenes del Servicio (puedes agregar varias)",
  maxImages = 10
}: MultiImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const galleryInputId = React.useId()
  const cameraInputId = React.useId()

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      onUploadError?.('El archivo debe ser una imagen.')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      onUploadError?.('La imagen es muy pesada. Máximo 10MB.')
      return
    }

    if (images.length >= maxImages) {
      onUploadError?.(`Solo puedes subir hasta ${maxImages} imágenes.`)
      return
    }

    try {
      setIsUploading(true)
      const url = await uploadImageToImgBB(file)
      onImagesChange([...images, url])
    } catch (error: any) {
      onUploadError?.(error.message || 'Error al subir la imagen')
    } finally {
      setIsUploading(false)
      if (inputRef.current) {
        inputRef.current.value = ''
      }
    }
  }

  const onDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await handleFile(e.dataTransfer.files[0])
    }
  }

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault()
    if (e.target.files && e.target.files[0]) {
      await handleFile(e.target.files[0])
    }
  }

  const handleRemove = (index: number) => {
    const newImages = images.filter((_, i) => i !== index)
    onImagesChange(newImages)
  }

  const handleMakePrimary = (index: number) => {
    if (index === 0) return
    const selected = images[index]
    const others = images.filter((_, i) => i !== index)
    onImagesChange([selected, ...others])
  }

  return (
    <div className="w-full">
      {label && <label className="block text-xs font-black uppercase tracking-widest text-zinc-400 mb-2">{label}</label>}

      {/* Galería de imágenes existentes */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-4">
          {images.map((url, index) => (
            <div
              key={index}
              className={`relative aspect-square rounded-2xl overflow-hidden border-2 transition-all group ${
                index === 0 ? 'border-amber-500 shadow-md shadow-amber-500/20' : 'border-white/10 bg-zinc-950'
              }`}
            >
              <img src={url} alt={`Imagen ${index + 1}`} className="w-full h-full object-cover" />
              
              {/* Overlay y botones en hover */}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                <div className="flex justify-between items-start">
                  {index === 0 ? (
                    <span className="bg-amber-500 text-black text-[9px] font-black uppercase px-2 py-0.5 rounded-md flex items-center gap-1 shadow">
                      <Star className="w-2.5 h-2.5 fill-black" /> Principal
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleMakePrimary(index)}
                      className="bg-zinc-800 hover:bg-amber-500 hover:text-black text-amber-400 text-[9px] font-black uppercase px-2 py-1 rounded-md transition-colors shadow"
                    >
                      Hacer Principal
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleRemove(index)}
                    className="bg-red-600 hover:bg-red-700 text-white p-1.5 rounded-lg transition-colors shadow-lg ml-auto"
                    title="Eliminar foto"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <span className="text-[10px] text-zinc-300 font-mono self-end">#{index + 1}</span>
              </div>

              {/* Badge persistente de principal */}
              {index === 0 && (
                <div className="absolute bottom-2 left-2 bg-black/80 backdrop-blur-md text-amber-400 border border-amber-500/30 text-[9px] font-black uppercase px-2 py-0.5 rounded-md group-hover:opacity-0 transition-opacity">
                  ★ Principal
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Zona para agregar imagen */}
      {images.length < maxImages && (
        <div
          onDragEnter={onDrag}
          onDragLeave={onDrag}
          onDragOver={onDrag}
          onDrop={onDrop}
          className={`relative flex flex-col items-center justify-center w-full h-36 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${
            dragActive ? 'border-amber-500 bg-amber-500/10' : 'border-white/10 bg-zinc-900/60 hover:border-amber-500/50 hover:bg-zinc-900'
          } ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
        >
          <input
            id={galleryInputId}
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={handleChange}
            className="hidden"
          />
          <input
            id={cameraInputId}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleChange}
            className="hidden"
          />

          {isUploading ? (
            <div className="flex flex-col items-center justify-center text-amber-500">
              <Loader2 className="w-8 h-8 animate-spin mb-2" />
              <p className="text-xs font-black uppercase tracking-widest">Subiendo e inflando foto...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-4 text-center space-y-2">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                <UploadCloud className="w-5 h-5" />
              </div>
              <p className="text-xs font-bold text-zinc-300">
                <span className="text-amber-500 font-black">Selecciona o toma una foto</span>
              </p>
              <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                <label
                  htmlFor={galleryInputId}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold transition-colors flex items-center gap-1.5 border border-white/10 cursor-pointer"
                >
                  📁 Galería
                </label>
                <label
                  htmlFor={cameraInputId}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-black transition-colors flex items-center gap-1.5 shadow-lg shadow-amber-500/20 cursor-pointer"
                >
                  📸 Tomar Foto
                </label>
              </div>
              <p className="text-[10px] text-zinc-500 uppercase font-semibold">
                {images.length === 0 ? 'Puedes subir 1 o más fotos' : `${images.length} foto${images.length > 1 ? 's' : ''} añadida${images.length > 1 ? 's' : ''} (máx. ${maxImages})`}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

'use client'

import React, { useState, useRef } from 'react'
import { UploadCloud, Image as ImageIcon, X, Loader2 } from 'lucide-react'
import { uploadImageToImgBB } from '@/lib/utils/uploadImage'

interface ImageUploadProps {
  onUploadSuccess: (url: string) => void
  onUploadError?: (error: string) => void
  label?: string
  defaultImage?: string
}

export function ImageUpload({ 
  onUploadSuccess, 
  onUploadError, 
  label = "Subir Imagen",
  defaultImage 
}: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(defaultImage || null)
  const [dragActive, setDragActive] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)

  const galleryInputId = React.useId()
  const cameraInputId = React.useId()

  const handleFile = async (file: File) => {
    // Validar que sea imagen
    if (!file.type.startsWith('image/')) {
      onUploadError?.('El archivo debe ser una imagen.')
      return
    }

    // Máximo 10MB (ImgBB permite hasta 32MB gratis, pero 10MB es un buen límite seguro)
    if (file.size > 10 * 1024 * 1024) {
      onUploadError?.('La imagen es muy pesada. Máximo 10MB.')
      return
    }

    try {
      setIsUploading(true)
      // Crear preview local rápido
      const objectUrl = URL.createObjectURL(file)
      setPreview(objectUrl)

      // Subir a ImgBB
      const url = await uploadImageToImgBB(file)
      onUploadSuccess(url)
    } catch (error: any) {
      setPreview(null)
      onUploadError?.(error.message || 'Error al subir la imagen')
    } finally {
      setIsUploading(false)
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

  const handleRemove = () => {
    setPreview(null)
    onUploadSuccess('') // O pasar un valor nulo dependiendo del backend
    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

  return (
    <div className="w-full">
      {label && <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{label}</label>}
      
      {!preview ? (
        <div 
          className={`relative flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-xl cursor-pointer transition-colors
            ${dragActive ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'}
            ${isUploading ? 'opacity-50 pointer-events-none' : ''}
          `}
          onDragEnter={onDrag}
          onDragLeave={onDrag}
          onDragOver={onDrag}
          onDrop={onDrop}
        >
          <input 
            id={galleryInputId}
            ref={inputRef}
            type="file" 
            accept="image/*" 
            className="hidden" 
            onChange={handleChange}
          />
          <input 
            id={cameraInputId}
            ref={cameraRef}
            type="file" 
            accept="image/*"
            capture="environment"
            className="hidden" 
            onChange={handleChange}
          />
          
          {isUploading ? (
            <div className="flex flex-col items-center">
              <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400">Subiendo imagen...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center text-center p-4 space-y-3">
              <UploadCloud className="w-10 h-10 text-gray-400" />
              <p className="text-sm text-gray-600 dark:text-gray-300">
                <span className="font-semibold text-amber-500">Seleccionar imagen</span> o tomar foto ahora
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
              <p className="text-[10px] text-gray-500 dark:text-gray-400">PNG, JPG hasta 10MB (Compresión automática)</p>
            </div>
          )}
        </div>
      ) : (
        <div className="relative w-full h-40 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src={preview} 
            alt="Vista previa" 
            className="w-full h-full object-contain bg-gray-100 dark:bg-gray-900"
          />
          
          {!isUploading && (
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <button
                type="button"
                onClick={handleRemove}
                className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-full transform transition-transform hover:scale-110 shadow-lg"
                title="Eliminar imagen"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}

          {isUploading && (
            <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 text-white animate-spin mb-2" />
              <p className="text-xs text-white font-medium">Subiendo...</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

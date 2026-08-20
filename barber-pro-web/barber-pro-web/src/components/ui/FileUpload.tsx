'use client'

import React, { useState, useRef } from 'react'
import { UploadCloud, FileText, X, Loader2, Eye } from 'lucide-react'
import { uploadImageToImgBB } from '@/lib/utils/uploadImage'

interface FileUploadProps {
  onUploadSuccess: (url: string, fileName?: string) => void
  onUploadError?: (error: string) => void
  label?: string
  defaultUrl?: string
  acceptPdf?: boolean
}

export function FileUpload({ 
  onUploadSuccess, 
  onUploadError, 
  label = "Subir Comprobante (Imagen o PDF)",
  defaultUrl,
  acceptPdf = true
}: FileUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(defaultUrl || null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [isPdf, setIsPdf] = useState<boolean>(false)
  const [dragActive, setDragActive] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    setPreview(defaultUrl || null)
    if (defaultUrl) {
      const isPdfUrl = defaultUrl.includes('.pdf') || defaultUrl.startsWith('data:application/pdf')
      setIsPdf(isPdfUrl)
    }
  }, [defaultUrl])

  const galleryInputId = React.useId()

  const convertToBase64 = (fileToRead: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = () => resolve('')
      reader.readAsDataURL(fileToRead)
    })
  }

  const handleFile = async (file: File) => {
    const isFilePdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    const isImage = file.type.startsWith('image/')

    if (!isImage && (!acceptPdf || !isFilePdf)) {
      onUploadError?.('El archivo debe ser una imagen (PNG, JPG) o un documento PDF.')
      return
    }

    if (file.size > 15 * 1024 * 1024) {
      onUploadError?.('El archivo es muy pesado. Máximo 15MB.')
      return
    }

    try {
      setIsUploading(true)
      setFileName(file.name)
      setIsPdf(isFilePdf)

      // 1. Mostrar preview Base64
      const localBase64 = await convertToBase64(file)
      if (localBase64) {
        setPreview(localBase64)
        onUploadSuccess(localBase64, file.name)
      }

      // 2. Intentar subida a Catbox primero para PDFs o como fallback
      try {
        const formData = new FormData()
        formData.append('file', file)
        
        // Si es PDF o documento, probar Catbox primero
        const endpoint = isFilePdf ? '/api/upload/catbox' : '/api/upload'
        let res = await fetch(endpoint, {
          method: 'POST',
          body: formData,
        })

        if (!res.ok && isFilePdf) {
          // Intentar /api/upload si catbox falló
          res = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
          })
        }

        if (res.ok) {
          const data = await res.json()
          if (data.url) {
            setPreview(data.url)
            onUploadSuccess(data.url, file.name)
            return
          }
        }
      } catch (uploadErr) {
        console.warn('Subida primaria falló, utilizando fallbacks:', uploadErr)
      }

      // 3. Fallback para imágenes / documentos a Catbox o ImgBB
      try {
        const catboxForm = new FormData()
        catboxForm.append('file', file)
        const catRes = await fetch('/api/upload/catbox', {
          method: 'POST',
          body: catboxForm,
        })
        if (catRes.ok) {
          const cData = await catRes.json()
          if (cData.url) {
            setPreview(cData.url)
            onUploadSuccess(cData.url, file.name)
            return
          }
        }
      } catch (catErr) {
        console.warn('Catbox upload fallback error:', catErr)
      }

      // 4. Fallback a ImgBB si es imagen
      if (isImage) {
        try {
          const imgbbUrl = await uploadImageToImgBB(file)
          if (imgbbUrl) {
            setPreview(imgbbUrl)
            onUploadSuccess(imgbbUrl, file.name)
          }
        } catch {
          // Mantener Base64 como último recurso
        }
      }
    } catch (error: any) {
      console.error('Error al procesar archivo:', error)
      onUploadError?.(error?.message || 'Error al procesar archivo')
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
    setFileName(null)
    setIsPdf(false)
    onUploadSuccess('')
    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

  return (
    <div className="w-full">
      {label && <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">{label}</label>}
      
      {!preview ? (
        <div 
          className={`relative flex flex-col items-center justify-center w-full h-36 border-2 border-dashed rounded-2xl cursor-pointer transition-colors p-4 text-center
            ${dragActive ? 'border-amber-500 bg-amber-500/10' : 'border-white/10 bg-zinc-950 hover:bg-zinc-900/50 hover:border-amber-500/30'}
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
            accept={acceptPdf ? "image/*,application/pdf" : "image/*"} 
            className="hidden" 
            onChange={handleChange}
          />
          
          {isUploading ? (
            <div className="flex flex-col items-center">
              <Loader2 className="w-8 h-8 text-amber-500 animate-spin mb-2" />
              <p className="text-xs text-zinc-400 font-bold">Subiendo archivo...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center text-center space-y-2">
              <UploadCloud className="w-8 h-8 text-amber-500/80" />
              <p className="text-xs text-zinc-300">
                <span className="font-bold text-amber-400">Seleccionar archivo</span> o arrastrar aquí
              </p>
              <label
                htmlFor={galleryInputId}
                className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-black transition-all shadow-lg shadow-amber-500/20 cursor-pointer inline-flex items-center gap-1.5"
              >
                📁 Buscar Imagen o PDF
              </label>
              <p className="text-[10px] text-zinc-500">PDF, PNG, JPG hasta 15MB</p>
            </div>
          )}
        </div>
      ) : (
        <div className="relative w-full p-4 rounded-2xl border border-white/10 bg-zinc-950 flex items-center justify-between group">
          {isPdf ? (
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-12 h-12 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center justify-center shrink-0">
                <FileText className="w-6 h-6 text-red-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">{fileName || 'Documento_Permiso.pdf'}</p>
                <span className="text-[10px] text-red-400 font-bold bg-red-500/10 px-2 py-0.5 rounded-md inline-block mt-0.5">
                  Documento PDF
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src={preview} 
                alt="Vista previa" 
                className="w-12 h-12 rounded-xl object-cover border border-white/10 bg-zinc-900 shrink-0"
              />
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">{fileName || 'Comprobante_Imagen'}</p>
                <span className="text-[10px] text-green-400 font-bold bg-green-500/10 px-2 py-0.5 rounded-md inline-block mt-0.5">
                  Imagen Adjunta
                </span>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const w = window.open()
                if (w) w.document.write(`<iframe src="${preview}" style="width:100%;height:100vh;border:none;"></iframe>`)
              }}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition"
              title="Ver archivo"
            >
              <Eye className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleRemove}
              className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 transition"
              title="Eliminar archivo"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { ExternalLink, X, Smartphone, Copy, Check } from 'lucide-react'

export function InAppBrowserBanner() {
  const [isInApp, setIsInApp] = useState(false)
  const [appName, setAppName] = useState('')
  const [isAndroid, setIsAndroid] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    try {
      if (typeof window === 'undefined' || typeof navigator === 'undefined') return

      const ua = navigator.userAgent || navigator.vendor || (window as any).opera || ''
      const android = /android/i.test(ua)
      const ios = /iphone|ipad|ipod/i.test(ua)
      setIsAndroid(android)
      setIsIOS(ios)

      let detectedApp = ''
      if (/Instagram/i.test(ua)) detectedApp = 'Instagram'
      else if (/FBAN|FBAV|FB_IAB/i.test(ua)) detectedApp = 'Facebook'
      else if (/WhatsApp/i.test(ua)) detectedApp = 'WhatsApp'
      else if (/TikTok|musical_ly/i.test(ua)) detectedApp = 'TikTok'

      if (detectedApp) {
        setIsInApp(true)
        setAppName(detectedApp)
      }
    } catch {
      // Ignore detection errors safely
    }
  }, [])

  if (!isInApp || dismissed) return null

  const handleOpenExternal = () => {
    if (typeof window === 'undefined') return
    const currentUrl = window.location.href

    if (isAndroid) {
      // Android Intent scheme to escape in-app webview into native Chrome
      const cleanUrl = currentUrl.replace(/^https?:\/\//, '')
      const chromeIntent = `intent://${cleanUrl}#Intent;scheme=https;package=com.android.chrome;end;`
      window.location.href = chromeIntent

      // Fallback a navegador general después de 600ms si Chrome no responde
      setTimeout(() => {
        const defaultIntent = `intent://${cleanUrl}#Intent;scheme=https;end;`
        window.location.href = defaultIntent
      }, 600)
    } else {
      // En iOS (iPhone/iPad): copiar enlace al portapapeles y avisar al usuario
      try {
        if (navigator.clipboard) {
          navigator.clipboard.writeText(currentUrl)
          setCopied(true)
          setTimeout(() => setCopied(false), 3000)
        }
      } catch {
        // Fallback
      }
    }
  }

  return (
    <aside 
      aria-label="Aviso de compatibilidad en navegador de aplicación"
      className="sticky top-0 z-[99999] bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-500 text-black px-3 py-2.5 shadow-2xl border-b border-amber-400 select-none animate-in fade-in slide-in-from-top duration-300"
    >
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs font-bold">
        <div className="flex items-center gap-2 text-center sm:text-left">
          <span className="p-1.5 bg-black/10 rounded-lg shrink-0">
            <Smartphone className="w-4 h-4 text-black" />
          </span>
          <p className="leading-snug">
            <span className="font-black uppercase tracking-wide">¿Abierto en {appName}?</span>{' '}
            {isAndroid ? (
              <span className="font-semibold text-black/90">
                Para descargar tu QR de pago o usar tu app de banco sin bloqueos, ábrelo en Chrome.
              </span>
            ) : (
              <span className="font-semibold text-black/90">
                Para una experiencia completa, toca los tres puntos (•••) y selecciona <strong className="underline">Abrir en Safari</strong>.
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
          {isAndroid ? (
            <button
              onClick={handleOpenExternal}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-black text-amber-400 hover:text-amber-300 font-black uppercase text-[11px] tracking-wider transition-all shadow-md active:scale-95 cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Abrir en Chrome</span>
            </button>
          ) : (
            <button
              onClick={handleOpenExternal}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-black text-amber-400 hover:text-amber-300 font-black uppercase text-[11px] tracking-wider transition-all shadow-md active:scale-95 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? '¡Enlace Copiado!' : 'Copiar Enlace'}</span>
            </button>
          )}

          <button
            onClick={() => setDismissed(true)}
            aria-label="Cerrar aviso"
            className="p-1.5 rounded-lg hover:bg-black/10 text-black/80 hover:text-black transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}

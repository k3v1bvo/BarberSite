import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AppProviders } from '@/components/providers/AppProviders'
import { SpeedInsights } from '@vercel/speed-insights/next'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'BarberSite | Estilo Clásico & Moderno en Cochabamba',
  description: 'La mejor experiencia en barbería tradicional e innovación. Reserva tu cita online para cortes clásicos, fades y cuidado de barba en Cochabamba.',
  keywords: ['barbería', 'cochabamba', 'corte de cabello', 'fade', 'barba', 'reservas online'],
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/logobarber.png', type: 'image/png' }
    ],
    shortcut: '/logobarber.png',
    apple: [
      { url: '/logobarber.png', type: 'image/png' }
    ]
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'BarberSite',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body className={inter.className} suppressHydrationWarning>
        <AppProviders>{children}</AppProviders>
        <SpeedInsights />
      </body>
    </html>
  )
}
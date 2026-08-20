'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface BrandConfig {
  nombre: string
  logo_url: string
  mostrar_modo: 'ambos' | 'logo' | 'texto'
}

export const defaultBrandConfig: BrandConfig = {
  nombre: 'BarberSite',
  logo_url: '/logobarber.png',
  mostrar_modo: 'ambos',
}

interface BrandContextValue {
  brand: BrandConfig
  updateBrand: (newConfig: Partial<BrandConfig>) => void
  loading: boolean
}

const BrandContext = createContext<BrandContextValue>({
  brand: defaultBrandConfig,
  updateBrand: () => {},
  loading: true,
})

export function BrandProvider({ children }: { children: ReactNode }) {
  const [brand, setBrand] = useState<BrandConfig>(defaultBrandConfig)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const fetchBrand = async () => {
      try {
        const { data } = await supabase
          .from('configuraciones')
          .select('valor')
          .eq('llave', 'brand_config')
          .single()

        if (data && data.valor) {
          setBrand({
            nombre: data.valor.nombre || defaultBrandConfig.nombre,
            logo_url: data.valor.logo_url || defaultBrandConfig.logo_url,
            mostrar_modo: data.valor.mostrar_modo || 'ambos',
          })
        }
      } catch (err) {
        // Si no existe el registro en configuraciones, mantenemos el valor por defecto BarberSite
      } finally {
        setLoading(false)
      }
    }
    fetchBrand()
  }, [supabase])

  useEffect(() => {
    if (typeof document !== 'undefined' && brand.nombre) {
      const currentTitle = document.title
      if (currentTitle.includes('Barber Pro') || currentTitle.includes('BARBER PRO') || currentTitle.includes('BarberSite')) {
        document.title = `${brand.nombre} | Estilo Clásico & Moderno en Cochabamba`
      }
    }
  }, [brand.nombre])

  const updateBrand = (newConfig: Partial<BrandConfig>) => {
    setBrand((prev) => ({ ...prev, ...newConfig }))
  }

  return (
    <BrandContext.Provider value={{ brand, updateBrand, loading }}>
      {children}
    </BrandContext.Provider>
  )
}

export function useBrand() {
  return useContext(BrandContext)
}

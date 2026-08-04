'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Navbar } from '@/components/ui/Navbar'
import { Camera, Scissors, Filter } from 'lucide-react'

interface PortfolioItem {
  id: string
  image_url: string
  categoria: string
  descripcion: string
  barbero_id: string
  barberos: {
    full_name: string
  }
}

export default function GaleriaPage() {
  const [items, setItems] = useState<PortfolioItem[]>([])
  const [categorias, setCategorias] = useState<string[]>([])
  const [catActiva, setCatActiva] = useState<string>('Todos')
  const [loading, setLoading] = useState(true)
  
  const supabase = createClient()

  useEffect(() => {
    loadPortafolio()
  }, [])

  const loadPortafolio = async () => {
    try {
      const { data, error } = await supabase
        .from('portafolio')
        .select(`
          id, image_url, categoria, descripcion, barbero_id,
          barberos:profiles(full_name)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      if (data) {
        setItems(data as unknown as PortfolioItem[])
        const cats = Array.from(new Set(data.map(item => item.categoria)))
        setCategorias(['Todos', ...cats])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const itemsFiltrados = catActiva === 'Todos' ? items : items.filter(i => i.categoria === catActiva)

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-32">
       <Navbar />

       <div className="max-w-7xl mx-auto px-4 pt-12">
          {/* Header */}
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-6xl font-black mb-6 uppercase tracking-tight">
               Nuestra <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">Galería</span>
            </h1>
            <p className="text-zinc-400 text-lg md:text-xl max-w-2xl mx-auto">
              El verdadero arte no se cuenta, se demuestra. Explora el nivel de detalle y dedicación que ponemos en cada corte.
            </p>
          </div>

          {loading ? (
             <div className="flex justify-center py-20">
               <div className="w-12 h-12 border-4 border-zinc-700 border-t-amber-500 rounded-full animate-spin"></div>
             </div>
          ) : (
            <>
              {/* Filtros */}
              <div className="flex flex-wrap justify-center gap-3 mb-12">
                 <div className="hidden md:flex items-center gap-2 mr-4 text-zinc-500">
                    <Filter className="w-5 h-5" /> Filtrar por estilo:
                 </div>
                 {categorias.map(cat => (
                   <button
                     key={cat}
                     onClick={() => setCatActiva(cat)}
                     className={`px-6 py-2 rounded-full font-bold transition-all ${catActiva === cat ? 'bg-amber-500 text-black shadow-[0_0_15px_rgba(245,158,11,0.5)]' : 'bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:border-amber-500/50'}`}
                   >
                     {cat}
                   </button>
                 ))}
              </div>

              {/* Grid de Fotos Tipo Masonry o Grid estricto */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                 {itemsFiltrados.map(item => (
                   <div key={item.id} className="group relative rounded-2xl overflow-hidden bg-zinc-900 border border-white/5 aspect-[4/5] hover:border-amber-500/50 transition-colors">
                      <img 
                        src={item.image_url} 
                        alt={item.descripcion || item.categoria} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                      />
                      
                      {/* Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-6">
                         <span className="inline-block bg-amber-500 text-black text-xs font-black uppercase px-3 py-1 rounded-full mb-3 w-fit">
                           {item.categoria}
                         </span>
                         <p className="text-white font-medium line-clamp-2 mb-2">
                           {item.descripcion}
                         </p>
                         <div className="flex items-center gap-2 text-zinc-400 text-sm">
                           <Scissors className="w-4 h-4" />
                           <span>Por: <strong className="text-white">{item.barberos?.full_name || 'Barbero Pro'}</strong></span>
                         </div>
                      </div>
                   </div>
                 ))}
              </div>

              {itemsFiltrados.length === 0 && (
                <div className="text-center py-20">
                   <Camera className="w-16 h-16 mx-auto mb-4 text-zinc-700" />
                   <p className="text-zinc-500 text-lg">Aún no hemos subido trabajos en esta categoría.</p>
                </div>
              )}
            </>
          )}
       </div>
    </div>
  )
}

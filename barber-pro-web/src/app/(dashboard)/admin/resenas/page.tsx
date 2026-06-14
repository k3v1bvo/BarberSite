'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useToast } from '@/components/ui/Toast'
import { Star, MessageSquare, Trash2, Eye, EyeOff, ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

interface Review {
  id: string
  cliente_id: string
  barbero_id: string | null
  cita_id: string | null
  estrellas: number
  comentario: string
  is_public: boolean
  created_at: string
  cliente?: { full_name: string; email: string }
  barbero?: { full_name: string }
}

export default function AdminResenasPage() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const { error: toastError, success: toastSuccess } = useToast()
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select(`
          *,
          cliente:cliente_id(full_name, email),
          barbero:barbero_id(full_name)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      setReviews(data || [])
    } catch (e: any) {
      toastError('Error al cargar reseñas: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  const togglePublic = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('reviews')
        .update({ is_public: !currentStatus })
        .eq('id', id)

      if (error) throw error
      toastSuccess(currentStatus ? 'Reseña ocultada' : 'Reseña ahora es pública en el Home')
      setReviews(reviews.map(r => r.id === id ? { ...r, is_public: !currentStatus } : r))
    } catch (e: any) {
      toastError('Error al cambiar estado: ' + e.message)
    }
  }

  const deleteReview = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta reseña permanentemente?')) return
    try {
      const { error } = await supabase.from('reviews').delete().eq('id', id)
      if (error) throw error
      toastSuccess('Reseña eliminada')
      setReviews(reviews.filter(r => r.id !== id))
    } catch (e: any) {
      toastError('Error al eliminar: ' + e.message)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <div className="w-12 h-12 border-4 border-zinc-700 border-t-amber-500 rounded-full animate-spin mb-4"></div>
        <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">Cargando reseñas...</p>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-white/5 pb-8">
        <div className="flex items-center gap-6">
          <button onClick={() => router.back()} className="p-4 hover:bg-white/5 border border-white/5 bg-zinc-950 rounded-2xl transition-all btn-press group">
            <ArrowLeft className="w-5 h-5 text-zinc-500 group-hover:text-amber-500" />
          </button>
          <div>
            <h1 className="text-4xl font-black tracking-tight text-white uppercase leading-none">
              Gestión de <span className="text-amber-500">Reseñas</span>
            </h1>
            <p className="text-zinc-500 font-medium mt-2 text-lg">Modera los testimonios de tus clientes</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {reviews.map(review => (
          <Card key={review.id} className={cn(
            "bg-zinc-900 border-white/5 transition-all",
            review.is_public ? "border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.1)]" : ""
          )}>
            <CardHeader className="border-b border-white/5 bg-zinc-900/50 p-6 flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-lg font-black uppercase text-white">
                  {review.cliente?.full_name || 'Cliente Anónimo'}
                </CardTitle>
                <p className="text-[10px] uppercase tracking-widest text-zinc-500">
                  {new Date(review.created_at).toLocaleDateString('es-BO')}
                </p>
              </div>
              <Badge variant={review.is_public ? 'warning' : 'outline'} className={cn(
                "text-[10px] uppercase tracking-widest font-black",
                review.is_public ? "" : "text-zinc-500 border-zinc-700"
              )}>
                {review.is_public ? 'Pública' : 'Oculta'}
              </Badge>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex mb-4">
                {[1, 2, 3, 4, 5].map(star => (
                  <Star key={star} size={16} className={star <= review.estrellas ? "fill-amber-500 text-amber-500" : "text-zinc-700"} />
                ))}
              </div>
              <p className="text-sm text-zinc-300 italic mb-6">"{review.comentario}"</p>

              {review.barbero && (
                <p className="text-[10px] uppercase tracking-widest text-amber-500/80 mb-6 font-bold">
                  Atendido por: {review.barbero.full_name}
                </p>
              )}

              <div className="flex gap-3 pt-4 border-t border-white/5">
                <Button
                  variant="outline"
                  className={cn("flex-1 text-[10px] font-black uppercase tracking-widest", review.is_public ? "border-amber-500/50 text-amber-500 hover:bg-amber-500/10" : "border-white/10 text-white")}
                  onClick={() => togglePublic(review.id, review.is_public)}
                >
                  {review.is_public ? <EyeOff className="w-3 h-3 mr-2" /> : <Eye className="w-3 h-3 mr-2" />}
                  {review.is_public ? 'Ocultar' : 'Hacer Pública'}
                </Button>
                <Button
                  variant="outline"
                  className="w-10 px-0 border-red-500/20 text-red-500 hover:bg-red-500/10"
                  onClick={() => deleteReview(review.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {reviews.length === 0 && (
          <div className="col-span-full py-20 text-center border-2 border-dashed border-white/5 rounded-3xl bg-zinc-900/50">
            <MessageSquare className="w-16 h-16 text-zinc-800 mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">No hay reseñas todavía</h3>
            <p className="text-zinc-500 text-sm">Las calificaciones de los clientes aparecerán aquí para que las moderes.</p>
          </div>
        )}
      </div>
    </div>
  )
}

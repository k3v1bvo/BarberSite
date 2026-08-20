'use client'

import { Card, CardContent } from '@/components/ui/Card'
import { Calendar, CreditCard, Gift, Users, Scissors, Bell } from 'lucide-react'

export function ManualCliente() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 lg:pb-0">
      <div className="text-center space-y-3 mb-10">
        <h1 className="text-3xl lg:text-4xl font-black text-white uppercase">
          Guía de Uso para <span className="text-amber-500">Clientes</span>
        </h1>
        <p className="text-zinc-400 font-medium text-sm max-w-xl mx-auto">
          Aprende a sacarle el máximo provecho a la plataforma. Descubre cómo hacer reservas, pagar, y ganar beneficios con nuestro programa de referidos.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Como Reservar */}
        <Card className="bg-zinc-900/80 border-white/10 hover:border-amber-500/50 transition-colors">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-4 border-b border-white/5 pb-4">
              <div className="p-3 bg-amber-500/10 rounded-xl">
                <Calendar className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white uppercase">¿Cómo Reservar una Cita?</h3>
              </div>
            </div>
            <ul className="space-y-3 text-sm text-zinc-300">
              <li className="flex gap-2">
                <span className="text-amber-500 font-bold">1.</span>
                Ve al menú principal y selecciona <strong>Reservar</strong>.
              </li>
              <li className="flex gap-2">
                <span className="text-amber-500 font-bold">2.</span>
                Selecciona tu barbero favorito o elige "Cualquiera" para ver todas las opciones.
              </li>
              <li className="flex gap-2">
                <span className="text-amber-500 font-bold">3.</span>
                Escoge el o los servicios que deseas (Corte, Barba, Cejas, etc.).
              </li>
              <li className="flex gap-2">
                <span className="text-amber-500 font-bold">4.</span>
                Selecciona la fecha y hora disponible que más te convenga.
              </li>
              <li className="flex gap-2">
                <span className="text-amber-500 font-bold">5.</span>
                Confirma tu reserva. Recibirás una notificación en tu panel.
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Como Pagar */}
        <Card className="bg-zinc-900/80 border-white/10 hover:border-emerald-500/50 transition-colors">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-4 border-b border-white/5 pb-4">
              <div className="p-3 bg-emerald-500/10 rounded-xl">
                <CreditCard className="w-6 h-6 text-emerald-500" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white uppercase">Pagos y Tienda</h3>
              </div>
            </div>
            <ul className="space-y-3 text-sm text-zinc-300">
              <li className="flex gap-2">
                <span className="text-emerald-500 font-bold">1.</span>
                El pago de tu cita se realiza en sucursal (efectivo o QR) al momento de finalizar el servicio.
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-500 font-bold">2.</span>
                Pronto podrás pagar en línea desde la sección <strong>Mis Citas</strong> de tu panel.
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-500 font-bold">3.</span>
                Puedes comprar productos desde la <strong>Tienda</strong>. Selecciona tus productos y resérvalos para recogerlos en tu próxima visita.
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Referidos y Lealtad */}
        <Card className="bg-zinc-900/80 border-white/10 hover:border-purple-500/50 transition-colors md:col-span-2">
          <CardContent className="p-6">
            <div className="flex items-center gap-4 border-b border-white/5 pb-4 mb-4">
              <div className="p-3 bg-purple-500/10 rounded-xl">
                <Users className="w-6 h-6 text-purple-500" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white uppercase">Aprende: Referidos y Lealtad</h3>
                <p className="text-xs text-zinc-400 font-bold mt-1">Cómo ganar cortes gratis y bonos</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <Gift className="w-5 h-5 text-purple-400" />
                  <h4 className="font-bold text-white uppercase text-sm">Programa de Puntos</h4>
                </div>
                <p className="text-sm text-zinc-300 leading-relaxed">
                  Por cada boliviano (Bs.) que gastas en la barbería, acumulas puntos de lealtad. Cuando alcanzas ciertos umbrales, puedes canjearlos por descuentos o servicios gratuitos. Revisa tu saldo de puntos en la esquina superior de tu pantalla.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-5 h-5 text-purple-400" />
                  <h4 className="font-bold text-white uppercase text-sm">Sistema de Referidos</h4>
                </div>
                <p className="text-sm text-zinc-300 leading-relaxed mb-3">
                  Si invitas a tus amigos a la barbería y ellos se registran, ¡tú ganas! Cuando un amigo tuyo (referido) asiste a su primera cita y se registra en caja mencionando tu nombre, automáticamente se te abonarán puntos extra o saldo a tu favor.
                </p>
                <div className="bg-purple-500/10 border border-purple-500/20 p-3 rounded-lg text-xs text-purple-300 font-medium">
                  <strong>Tip:</strong> Pídele a tu amigo que le indique al coordinador en caja: <em>"Vengo referido por [Tu Nombre]"</em> para que ambos reciban su bono.
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  )
}

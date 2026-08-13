'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import Link from 'next/link'
import {
  Calendar, CreditCard, Gift, Users, Scissors, Bell,
  ShoppingBag, BarChart3, Clock, Wallet, ShieldCheck,
  Package, Scale, CheckCircle2, ChevronRight, UserCheck,
  FileText, Sparkles, BookOpen, AlertTriangle, ArrowRight,
  Layers, HelpCircle, PhoneCall
} from 'lucide-react'

interface ManualProps {
  userRole: 'admin' | 'coordinador' | 'barbero' | 'cliente'
}

type TabRole = 'cliente' | 'barbero' | 'coordinador' | 'admin'

export function ManualInteractivo({ userRole }: ManualProps) {
  const [activeTab, setActiveTab] = useState<TabRole>(userRole || 'cliente')

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 lg:pb-12 max-w-7xl mx-auto px-2 sm:px-4">
      {/* HERO BANNER DE BIENVENIDA */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-zinc-950 via-zinc-900 to-amber-950/40 border border-amber-500/20 p-6 sm:p-10 shadow-2xl">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-black uppercase tracking-widest">
              <BookOpen className="w-3.5 h-3.5" /> Centro de Capacitación y Manuales
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white uppercase tracking-tight leading-tight">
              GuíaInteractiva <span className="text-amber-500 drop-shadow-[0_0_15px_rgba(245,158,11,0.4)]">BarberSite</span>
            </h1>
            <p className="text-zinc-400 text-sm sm:text-base font-medium leading-relaxed">
              Selecciona cualquier rol para consultar su manual de uso, ver procesos paso a paso y dominar la plataforma en minutos.
            </p>
          </div>

          <div className="bg-zinc-900/90 border border-white/10 rounded-2xl p-4 shrink-0 text-center sm:text-right backdrop-blur-md">
            <p className="text-[10px] uppercase tracking-widest font-black text-zinc-500 mb-1">Tu Rol Registrado</p>
            <Badge variant="outline" className="text-sm font-black uppercase tracking-wider px-4 py-1 border-amber-500/40 bg-amber-500/10 text-amber-400">
              {userRole === 'admin' && '👑 Administrador'}
              {userRole === 'coordinador' && '👔 Coordinador'}
              {userRole === 'barbero' && '💈 Barbero Staff'}
              {userRole === 'cliente' && '👤 Cliente'}
            </Badge>
          </div>
        </div>

        {/* SELECTOR DE PESTAÑAS POR ROL */}
        <div className="mt-8 pt-6 border-t border-white/10 flex flex-wrap gap-2 sm:gap-3">
          <button
            onClick={() => setActiveTab('cliente')}
            className={`px-4 sm:px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center gap-2.5 ${
              activeTab === 'cliente'
                ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20 scale-105'
                : 'bg-zinc-900/80 text-zinc-400 hover:bg-zinc-800 hover:text-white border border-white/5'
            }`}
          >
            👤 Manual Cliente
          </button>

          <button
            onClick={() => setActiveTab('barbero')}
            className={`px-4 sm:px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center gap-2.5 ${
              activeTab === 'barbero'
                ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20 scale-105'
                : 'bg-zinc-900/80 text-zinc-400 hover:bg-zinc-800 hover:text-white border border-white/5'
            }`}
          >
            💈 Manual Barbero
          </button>

          <button
            onClick={() => setActiveTab('coordinador')}
            className={`px-4 sm:px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center gap-2.5 ${
              activeTab === 'coordinador'
                ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20 scale-105'
                : 'bg-zinc-900/80 text-zinc-400 hover:bg-zinc-800 hover:text-white border border-white/5'
            }`}
          >
            👔 Manual Coordinador
          </button>

          <button
            onClick={() => setActiveTab('admin')}
            className={`px-4 sm:px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center gap-2.5 ${
              activeTab === 'admin'
                ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20 scale-105'
                : 'bg-zinc-900/80 text-zinc-400 hover:bg-zinc-800 hover:text-white border border-white/5'
            }`}
          >
            👑 Manual Admin
          </button>
        </div>
      </div>

      {/* SECCIÓN 1: MANUAL DEL CLIENTE */}
      {activeTab === 'cliente' && (
        <div className="space-y-8 animate-in fade-in zoom-in-95 duration-300">
          <div className="flex items-center justify-between border-b border-amber-500/20 pb-4">
            <div>
              <h2 className="text-2xl font-black text-white uppercase flex items-center gap-2">
                👤 Guía de Uso para Clientes
              </h2>
              <p className="text-xs text-zinc-400 mt-1 font-medium">Aprende a agendar tus citas, pagar por QR y canjear tus cortes gratis.</p>
            </div>
            <Link href="/reservar">
              <Button className="bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-widest rounded-xl shadow-lg">
                Reservar Ahora ✂️
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Paso a Paso Reservar */}
            <Card className="bg-zinc-900/90 border-amber-500/20 hover:border-amber-500/40 transition-all shadow-xl">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                  <div className="p-3 bg-amber-500/10 rounded-2xl border border-amber-500/20">
                    <Calendar className="w-6 h-6 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white uppercase">1. ¿Cómo Reservar tu Cita?</h3>
                    <p className="text-[11px] text-amber-400 font-bold">Proceso rápido en 4 pasos</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex gap-3 items-start bg-zinc-950/60 p-3 rounded-xl border border-white/5">
                    <span className="w-6 h-6 rounded-full bg-amber-500 text-black font-black text-xs flex items-center justify-center shrink-0">1</span>
                    <p className="text-xs text-zinc-300">Selecciona el <strong>Servicio</strong> o combina con productos de la tienda.</p>
                  </div>
                  <div className="flex gap-3 items-start bg-zinc-950/60 p-3 rounded-xl border border-white/5">
                    <span className="w-6 h-6 rounded-full bg-amber-500 text-black font-black text-xs flex items-center justify-center shrink-0">2</span>
                    <p className="text-xs text-zinc-300">Escoge a tu <strong>Barbero de preferencia</strong> o selecciona cualquiera disponible.</p>
                  </div>
                  <div className="flex gap-3 items-start bg-zinc-950/60 p-3 rounded-xl border border-white/5">
                    <span className="w-6 h-6 rounded-full bg-amber-500 text-black font-black text-xs flex items-center justify-center shrink-0">3</span>
                    <p className="text-xs text-zinc-300">Elige la <strong>Fecha y Hora</strong> que más te convenga según disponibilidad en vivo.</p>
                  </div>
                  <div className="flex gap-3 items-start bg-zinc-950/60 p-3 rounded-xl border border-white/5">
                    <span className="w-6 h-6 rounded-full bg-amber-500 text-black font-black text-xs flex items-center justify-center shrink-0">4</span>
                    <p className="text-xs text-zinc-300">Elige la forma de pago (Adelanto Bs 20, 100% QR o Pagar en Local) y listo.</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Opciones de Pago y Tolerancia */}
            <Card className="bg-zinc-900/90 border-emerald-500/20 hover:border-emerald-500/40 transition-all shadow-xl">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                  <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
                    <CreditCard className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white uppercase">2. Formas de Pago & Tolerancia</h3>
                    <p className="text-[11px] text-emerald-400 font-bold">Reglas de llegada y pagos</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="p-3 bg-zinc-950/60 rounded-xl border border-emerald-500/20">
                    <p className="text-xs font-black text-emerald-400 uppercase mb-1">💳 Adelanto Bs 20 (QR):</p>
                    <p className="text-xs text-zinc-300">Cita 100% asegurada. Tienes una tolerancia de <strong>5 min (máximo 15 min total)</strong> y puedes reprogramar sin costo.</p>
                  </div>
                  <div className="p-3 bg-zinc-950/60 rounded-xl border border-red-500/20">
                    <p className="text-xs font-black text-red-400 uppercase mb-1">🏬 Pagar en Local (Bs 0 QR):</p>
                    <p className="text-xs text-zinc-300">Debes llegar <strong>5 minutos antes</strong> de tu cita. Si llegas tarde, el turno pasará a ser atendido por otro cliente.</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Lealtad y 10mo Corte Gratis */}
            <Card className="bg-zinc-900/90 border-purple-500/20 hover:border-purple-500/40 transition-all shadow-xl md:col-span-2">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                  <div className="p-3 bg-purple-500/10 rounded-2xl border border-purple-500/20">
                    <Gift className="w-6 h-6 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white uppercase">3. Programa de Lealtad & Referidos</h3>
                    <p className="text-[11px] text-purple-400 font-bold">Cortes Gratis y Descuentos acumulables</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-zinc-950/60 rounded-2xl border border-purple-500/20">
                    <span className="text-2xl mb-2 block">🎁</span>
                    <h4 className="text-xs font-black text-purple-300 uppercase mb-1">10mo Corte 100% GRATIS</h4>
                    <p className="text-xs text-zinc-300">Cada vez que te atiendes en el local, tu barbero o cajero registra tu visita. Al llegar al corte #10, tu servicio es automático y totalmente gratuito.</p>
                  </div>

                  <div className="p-4 bg-zinc-950/60 rounded-2xl border border-purple-500/20">
                    <span className="text-2xl mb-2 block">👥</span>
                    <h4 className="text-xs font-black text-purple-300 uppercase mb-1">Bonos por Invitar Amigos</h4>
                    <p className="text-xs text-zinc-300">Comparte tu código/enlace de referido con tus conocidos. Cuando ellos hagan su primera reserva, recibirás un bono directo de descuento en tu cuenta.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* SECCIÓN 2: MANUAL DEL BARBERO */}
      {activeTab === 'barbero' && (
        <div className="space-y-8 animate-in fade-in zoom-in-95 duration-300">
          <div className="flex items-center justify-between border-b border-amber-500/20 pb-4">
            <div>
              <h2 className="text-2xl font-black text-white uppercase flex items-center gap-2">
                💈 Guía de Uso para Barberos Staff
              </h2>
              <p className="text-xs text-zinc-400 mt-1 font-medium">Instrucciones para gestionar tus citas, comisiones, asistencia y capacitaciones.</p>
            </div>
            <Link href="/barbero">
              <Button className="bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-widest rounded-xl shadow-lg">
                Mi Panel Barber 💈
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-zinc-900/90 border-white/10">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                  <div className="p-3 bg-amber-500/10 rounded-2xl">
                    <Clock className="w-6 h-6 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white uppercase">1. Asistencia y GPS</h3>
                    <p className="text-[11px] text-amber-400 font-bold">Registro diario obligatorio</p>
                  </div>
                </div>
                <ul className="space-y-2.5 text-xs text-zinc-300">
                  <li className="flex items-start gap-2">
                    <span className="text-amber-400 font-bold">•</span>
                    <span><strong>Entrada:</strong> Marca tu asistencia al llegar al local activando tu ubicación GPS y selfie rápida.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-400 font-bold">•</span>
                    <span><strong>Pausa Almuerzo:</strong> Tienes botón para pausar y reanudar tu turno a la hora de almuerzo.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-400 font-bold">•</span>
                    <span><strong>Permisos:</strong> Si no podrás asistir, notifica con anticipación para que el coordinador o admin registre tu permiso justificado.</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="bg-zinc-900/90 border-white/10">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                  <div className="p-3 bg-blue-500/10 rounded-2xl">
                    <Wallet className="w-6 h-6 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white uppercase">2. Agenda y Comisiones</h3>
                    <p className="text-[11px] text-blue-400 font-bold">Tus ganancias en tiempo real</p>
                  </div>
                </div>
                <ul className="space-y-2.5 text-xs text-zinc-300">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 font-bold">•</span>
                    <span><strong>Citas del Día:</strong> Revisa tu agenda para ver las citas programadas y los servicios requeridos por cada cliente.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 font-bold">•</span>
                    <span><strong>Comisiones Ganadas:</strong> El sistema calcula automáticamente el % que te corresponde de cada corte o servicio terminado.</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* SECCIÓN 3: MANUAL DEL COORDINADOR */}
      {activeTab === 'coordinador' && (
        <div className="space-y-8 animate-in fade-in zoom-in-95 duration-300">
          <div className="flex items-center justify-between border-b border-amber-500/20 pb-4">
            <div>
              <h2 className="text-2xl font-black text-white uppercase flex items-center gap-2">
                👔 Guía de Operación para Coordinadores
              </h2>
              <p className="text-xs text-zinc-400 mt-1 font-medium">Manual de Caja POS, Arqueos de Cierre, Pedidos a Proveedores y Control de Personal.</p>
            </div>
            <Link href="/coordinador">
              <Button className="bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-widest rounded-xl shadow-lg">
                Panel Coordinador 👔
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Cierre de Caja y Arqueo */}
            <Card className="bg-zinc-900/90 border-emerald-500/20 hover:border-emerald-500/40 transition-all shadow-xl">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                  <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
                    <Scale className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white uppercase">1. Cierre Diario y Arqueo</h3>
                    <p className="text-[11px] text-emerald-400 font-bold">Cuadre de caja y comprobantes</p>
                  </div>
                </div>
                <div className="space-y-3 text-xs text-zinc-300">
                  <p><strong>Paso A:</strong> Ve al menú <span className="text-emerald-400 font-bold">Contabilidad &gt; Arqueo de Caja</span>.</p>
                  <p><strong>Paso B:</strong> Cuenta el efectivo físico en el cajón y compáralo con los montos registrados en el sistema.</p>
                  <p><strong>Paso C:</strong> Verifica las transferencias QR en el extracto bancario.</p>
                  <p><strong>Paso D:</strong> Ingresa el saldo de cierre y confirma el arqueo para finalizar el día correctamente.</p>
                </div>
              </CardContent>
            </Card>

            {/* Pedidos y Consignaciones */}
            <Card className="bg-zinc-900/90 border-blue-500/20 hover:border-blue-500/40 transition-all shadow-xl">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                  <div className="p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20">
                    <Package className="w-6 h-6 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white uppercase">2. Pedidos a Proveedores</h3>
                    <p className="text-[11px] text-blue-400 font-bold">Inventario y Consignaciones</p>
                  </div>
                </div>
                <div className="space-y-3 text-xs text-zinc-300">
                  <p><strong>Paso A:</strong> Revisa el stock disponible en <span className="text-blue-400 font-bold">Control &gt; Inventario</span>.</p>
                  <p><strong>Paso B:</strong> Si faltan productos (ceras, minoxidil, geles), registra una orden de pedido o consignación.</p>
                  <p><strong>Paso C:</strong> Al recibir los productos, confirma la entrada para actualizar automáticamente el stock disponible en el POS.</p>
                </div>
              </CardContent>
            </Card>

            {/* POS y Cobro de Citas */}
            <Card className="bg-zinc-900/90 border-amber-500/20 hover:border-amber-500/40 transition-all shadow-xl md:col-span-2">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                  <div className="p-3 bg-amber-500/10 rounded-2xl border border-amber-500/20">
                    <ShoppingBag className="w-6 h-6 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white uppercase">3. Operación en Caja POS & Permisos de Personal</h3>
                    <p className="text-[11px] text-amber-400 font-bold">Ventas rápidas, permisos con PDF y Sanciones</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-zinc-300">
                  <div className="p-4 bg-zinc-950/60 rounded-2xl border border-white/5">
                    <h4 className="font-bold text-amber-400 mb-2 uppercase">🛒 Caja / POS</h4>
                    <p>Ingresa al POS para marcar el corte de un cliente que vino sin reserva previa, o procesa el cobro final asociando el barbero que lo atendió para asignarle su comisión.</p>
                  </div>
                  <div className="p-4 bg-zinc-950/60 rounded-2xl border border-white/5">
                    <h4 className="font-bold text-amber-400 mb-2 uppercase">⏱️ Asistencia y Permisos</h4>
                    <p>Revisa las marcaciones del personal. Si un barbero solicita permiso (jornada completa, 3 horas, enfermedad grave), ingresa su permiso adjuntando su comprobante en <strong>PDF o Imagen</strong>.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* SECCIÓN 4: MANUAL DEL ADMINISTRADOR */}
      {activeTab === 'admin' && (
        <div className="space-y-8 animate-in fade-in zoom-in-95 duration-300">
          <div className="flex items-center justify-between border-b border-amber-500/20 pb-4">
            <div>
              <h2 className="text-2xl font-black text-white uppercase flex items-center gap-2">
                👑 Guía de Control para Administradores
              </h2>
              <p className="text-xs text-zinc-400 mt-1 font-medium">Gestión global de la barbería, auditoría, reglas laborales y reportes consolidados.</p>
            </div>
            <Link href="/admin">
              <Button className="bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-widest rounded-xl shadow-lg">
                Panel Admin 👑
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-zinc-900/90 border-white/10">
              <CardContent className="p-6 space-y-3 text-xs text-zinc-300">
                <div className="flex items-center gap-3 border-b border-white/5 pb-3">
                  <BarChart3 className="w-5 h-5 text-amber-400" />
                  <h3 className="font-black text-white uppercase text-sm">Reportes Anuales</h3>
                </div>
                <p>Genera y exporta en CSV o Imprime los libros de ventas, banco, caja chica y arqueos con filtros por año completo o fechas personalizadas.</p>
              </CardContent>
            </Card>

            <Card className="bg-zinc-900/90 border-white/10">
              <CardContent className="p-6 space-y-3 text-xs text-zinc-300">
                <div className="flex items-center gap-3 border-b border-white/5 pb-3">
                  <ShieldCheck className="w-5 h-5 text-blue-400" />
                  <h3 className="font-black text-white uppercase text-sm">Auditoría & Reglas</h3>
                </div>
                <p>Supervisa todos los cambios en el sistema, configura las comisiones base para barberos, penalizaciones automáticas y bonificaciones por desempeño.</p>
              </CardContent>
            </Card>

            <Card className="bg-zinc-900/90 border-white/10">
              <CardContent className="p-6 space-y-3 text-xs text-zinc-300">
                <div className="flex items-center gap-3 border-b border-white/5 pb-3">
                  <Sparkles className="w-5 h-5 text-purple-400" />
                  <h3 className="font-black text-white uppercase text-sm">Plantillas & Correos</h3>
                </div>
                <p>Configura los mensajes automáticos por correo electrónico (Gmail SMTP) enviados a clientes al confirmar o verificar sus pagos.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}

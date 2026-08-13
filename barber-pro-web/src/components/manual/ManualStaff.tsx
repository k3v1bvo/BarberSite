'use client'

import { Card, CardContent } from '@/components/ui/Card'
import { LayoutDashboard, Users, Calendar, ShoppingBag, BarChart3, Clock, Wallet } from 'lucide-react'

interface ManualStaffProps {
  role: 'admin' | 'coordinador' | 'barbero'
}

export function ManualStaff({ role }: ManualStaffProps) {
  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 lg:pb-0">
      <div className="text-center space-y-3 mb-10">
        <h1 className="text-3xl lg:text-4xl font-black text-white uppercase">
          Manual de <span className="text-amber-500">Staff</span>
        </h1>
        <p className="text-zinc-400 font-medium text-sm max-w-xl mx-auto">
          {role === 'admin' && 'Guía completa de administración y gestión general del sistema.'}
          {role === 'coordinador' && 'Guía de uso para cobros, arqueos, inventario y coordinación diaria.'}
          {role === 'barbero' && 'Guía de uso para revisar comisiones, agenda y rendimiento.'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Admin Sections */}
        {role === 'admin' && (
          <>
            <Card className="bg-zinc-900/80 border-white/10">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-4 border-b border-white/5 pb-4">
                  <div className="p-3 bg-blue-500/10 rounded-xl">
                    <BarChart3 className="w-6 h-6 text-blue-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white uppercase">Gestión General</h3>
                  </div>
                </div>
                <ul className="space-y-3 text-sm text-zinc-300">
                  <li><strong>Panel:</strong> Vista global de ingresos, citas y rendimiento de la barbería.</li>
                  <li><strong>Reportes:</strong> Datos estadísticos detallados para tomar decisiones de negocio.</li>
                  <li><strong>Configuración:</strong> Modificar los parámetros del sistema, lealtad y el QR de pago.</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="bg-zinc-900/80 border-white/10">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-4 border-b border-white/5 pb-4">
                  <div className="p-3 bg-red-500/10 rounded-xl">
                    <Users className="w-6 h-6 text-red-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white uppercase">Equipo y Clientes</h3>
                  </div>
                </div>
                <ul className="space-y-3 text-sm text-zinc-300">
                  <li><strong>Barberos:</strong> Gestionar permisos, comisiones, sanciones y bonos.</li>
                  <li><strong>Clientes:</strong> Ver historial de compras, referidos y puntos de lealtad acumulados.</li>
                  <li><strong>Reglas Laborales:</strong> Establecer las comisiones estándar y configuración de planillas.</li>
                </ul>
              </CardContent>
            </Card>
          </>
        )}

        {/* Coordinador Sections */}
        {role === 'coordinador' && (
          <>
            <Card className="bg-zinc-900/80 border-white/10">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-4 border-b border-white/5 pb-4">
                  <div className="p-3 bg-emerald-500/10 rounded-xl">
                    <ShoppingBag className="w-6 h-6 text-emerald-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white uppercase">Caja y Ventas</h3>
                  </div>
                </div>
                <ul className="space-y-3 text-sm text-zinc-300">
                  <li><strong>Caja/POS:</strong> Registrar nuevas ventas, cobrar cortes a clientes, aplicar descuentos o pagar con puntos.</li>
                  <li><strong>Arqueo:</strong> Al finalizar el día, sumar los ingresos en efectivo y transferencias (QR) para el cierre.</li>
                  <li><strong>Ventas:</strong> Ver el listado histórico de todas las transacciones generadas en el local.</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="bg-zinc-900/80 border-white/10">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-4 border-b border-white/5 pb-4">
                  <div className="p-3 bg-purple-500/10 rounded-xl">
                    <Clock className="w-6 h-6 text-purple-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white uppercase">Turnos y Sanciones</h3>
                  </div>
                </div>
                <ul className="space-y-3 text-sm text-zinc-300">
                  <li><strong>Horarios:</strong> Asignar turnos y días libres a los barberos para la semana.</li>
                  <li><strong>Asistencia:</strong> Controlar la hora de llegada de cada barbero (Atrasos).</li>
                  <li><strong>Sanciones / Bonos:</strong> Registrar multas por llegadas tarde, salida temprano o bonos por buen desempeño.</li>
                </ul>
              </CardContent>
            </Card>
          </>
        )}

        {/* Barbero Sections */}
        {role === 'barbero' && (
          <>
            <Card className="bg-zinc-900/80 border-white/10">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-4 border-b border-white/5 pb-4">
                  <div className="p-3 bg-amber-500/10 rounded-xl">
                    <Calendar className="w-6 h-6 text-amber-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white uppercase">Mi Agenda y Trabajo</h3>
                  </div>
                </div>
                <ul className="space-y-3 text-sm text-zinc-300">
                  <li><strong>Panel:</strong> Resumen de tus ingresos del día, cortes realizados y comisiones generadas.</li>
                  <li><strong>Agenda:</strong> Revisa qué clientes te han reservado para hoy o próximos días.</li>
                  <li><strong>Asistencia:</strong> Asegúrate de marcar tu entrada a tiempo. Las tardanzas pueden generar sanciones.</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="bg-zinc-900/80 border-white/10">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-4 border-b border-white/5 pb-4">
                  <div className="p-3 bg-blue-500/10 rounded-xl">
                    <Wallet className="w-6 h-6 text-blue-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white uppercase">Ingresos e Inducción</h3>
                  </div>
                </div>
                <ul className="space-y-3 text-sm text-zinc-300">
                  <li><strong>Comisiones:</strong> Por cada corte que realizas, se acumula un porcentaje a tu favor. Se paga semanalmente.</li>
                  <li><strong>Sanciones:</strong> Revisa si tienes descuentos por atrasos o incumplimientos al reglamento interno.</li>
                  <li><strong>Inducción Barbera:</strong> En esta sección puedes ver cursos y técnicas de corte que te asigne el administrador.</li>
                </ul>
              </CardContent>
            </Card>
          </>
        )}

      </div>
    </div>
  )
}

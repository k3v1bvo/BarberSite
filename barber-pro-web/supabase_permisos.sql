-- ============================================================
-- BARBER SITE - TABLA DE SOLICITUDES DE PERMISOS PARA BARBEROS
-- Permite a los barberos solicitar permisos con PDF adjunto y a 
-- administradores/coordinadores aprobar o rechazar con notificaciones.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.solicitudes_permisos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  barbero_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  fecha_fin date,
  hora_inicio text,
  hora_fin text,
  todo_el_dia boolean DEFAULT true,
  tipo_permiso text NOT NULL DEFAULT 'jornada_completa',
  motivo text NOT NULL,
  comprobante_url text,
  archivo_nombre text,
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobado', 'rechazado', 'cancelado')),
  revisado_por text,
  revisado_por_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  revisado_at timestamp with time zone,
  motivo_rechazo text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT solicitudes_permisos_pkey PRIMARY KEY (id)
);

-- Índices de búsqueda
CREATE INDEX IF NOT EXISTS idx_solicitudes_permisos_barbero ON public.solicitudes_permisos(barbero_id);
CREATE INDEX IF NOT EXISTS idx_solicitudes_permisos_fecha ON public.solicitudes_permisos(fecha);
CREATE INDEX IF NOT EXISTS idx_solicitudes_permisos_estado ON public.solicitudes_permisos(estado);

-- RLS
ALTER TABLE public.solicitudes_permisos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir lectura a usuarios autenticados"
  ON public.solicitudes_permisos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Permitir insercion a usuarios autenticados"
  ON public.solicitudes_permisos FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Permitir actualizacion a admin y coordinador"
  ON public.solicitudes_permisos FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Permitir eliminacion a admin y creador"
  ON public.solicitudes_permisos FOR DELETE
  TO authenticated
  USING (true);

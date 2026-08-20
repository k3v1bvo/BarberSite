-- ============================================================
-- SISTEMA DE COMISIONES POR BARBERO
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- ┌──────────────────────────────────────────────────────┐
-- │  1. CATEGORÍAS DE HORARIO PARA COMISIONES            │
-- │  (Editables por admin, NO afectan horario real)      │
-- └──────────────────────────────────────────────────────┘

CREATE TABLE IF NOT EXISTS public.comision_categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL UNIQUE,
  descripcion text,
  requiere_herramientas boolean DEFAULT false,
  is_active boolean DEFAULT true,
  orden integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Seed con las categorías iniciales
INSERT INTO public.comision_categorias (nombre, descripcion, requiere_herramientas, orden) VALUES
  ('8 Horas', 'Turno de 8 horas estándar', false, 1),
  ('Completo', 'Horario completo del día', false, 2),
  ('Plus', 'Horario plus extendido', false, 3),
  ('Domingo o Feriado', 'Domingos y días feriados', true, 4),
  ('Domingo o Feriado Plus', 'Domingos y feriados con horario plus', true, 5)
ON CONFLICT (nombre) DO NOTHING;

-- ┌──────────────────────────────────────────────────────┐
-- │  2. HORARIO SEMANAL DE COMISIÓN POR BARBERO          │
-- │  Mapea: barbero + día_semana → categoría + tools     │
-- └──────────────────────────────────────────────────────┘

CREATE TABLE IF NOT EXISTS public.comision_barbero_horario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbero_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  dia_semana smallint NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  -- 0=Domingo, 1=Lunes, 2=Martes, 3=Miércoles, 4=Jueves, 5=Viernes, 6=Sábado
  categoria_id uuid NOT NULL REFERENCES public.comision_categorias(id),
  tiene_herramientas boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(barbero_id, dia_semana)
);

-- ┌──────────────────────────────────────────────────────┐
-- │  3. COMISIONES POR SERVICIO POR BARBERO              │
-- │  Mapea: barbero + servicio + categoría → comisión    │
-- │  con/sin herramientas                                │
-- └──────────────────────────────────────────────────────┘

CREATE TABLE IF NOT EXISTS public.comision_barbero_servicios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbero_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  servicio_id uuid NOT NULL REFERENCES public.servicios(id) ON DELETE CASCADE,
  categoria_id uuid NOT NULL REFERENCES public.comision_categorias(id),
  -- Comisión CON herramientas
  comision_tipo_con text DEFAULT 'porcentaje' CHECK (comision_tipo_con IN ('porcentaje','fija','ninguna')),
  comision_valor_con numeric DEFAULT 0,
  -- Comisión SIN herramientas
  comision_tipo_sin text DEFAULT 'porcentaje' CHECK (comision_tipo_sin IN ('porcentaje','fija','ninguna')),
  comision_valor_sin numeric DEFAULT 0,
  -- Meta
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(barbero_id, servicio_id, categoria_id)
);

-- ┌──────────────────────────────────────────────────────┐
-- │  ÍNDICES                                             │
-- └──────────────────────────────────────────────────────┘

CREATE INDEX IF NOT EXISTS idx_comision_barbero_horario_barbero
  ON public.comision_barbero_horario(barbero_id);

CREATE INDEX IF NOT EXISTS idx_comision_barbero_servicios_barbero
  ON public.comision_barbero_servicios(barbero_id);

CREATE INDEX IF NOT EXISTS idx_comision_barbero_servicios_servicio
  ON public.comision_barbero_servicios(servicio_id);

CREATE INDEX IF NOT EXISTS idx_comision_barbero_servicios_categoria
  ON public.comision_barbero_servicios(categoria_id);

-- ┌──────────────────────────────────────────────────────┐
-- │  AGREGAR COLUMNAS DE AUDITORÍA EN CITAS              │
-- │  Para registrar qué categoría y herramientas usó     │
-- └──────────────────────────────────────────────────────┘

ALTER TABLE public.citas
  ADD COLUMN IF NOT EXISTS comision_categoria text,
  ADD COLUMN IF NOT EXISTS comision_herramientas boolean;

-- ┌──────────────────────────────────────────────────────┐
-- │  RLS POLICIES                                        │
-- └──────────────────────────────────────────────────────┘

ALTER TABLE public.comision_categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comision_barbero_horario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comision_barbero_servicios ENABLE ROW LEVEL SECURITY;

-- Categorías: lectura para todos los autenticados, escritura para admin/coordinador
CREATE POLICY "comision_categorias_select" ON public.comision_categorias
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "comision_categorias_insert" ON public.comision_categorias
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','coordinador')));

CREATE POLICY "comision_categorias_update" ON public.comision_categorias
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','coordinador')));

CREATE POLICY "comision_categorias_delete" ON public.comision_categorias
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','coordinador')));

-- Horario barbero: lectura para todos, escritura para admin/coordinador
CREATE POLICY "comision_barbero_horario_select" ON public.comision_barbero_horario
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "comision_barbero_horario_all" ON public.comision_barbero_horario
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','coordinador')));

-- Servicios barbero: lectura para todos, escritura para admin/coordinador
CREATE POLICY "comision_barbero_servicios_select" ON public.comision_barbero_servicios
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "comision_barbero_servicios_all" ON public.comision_barbero_servicios
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','coordinador')));

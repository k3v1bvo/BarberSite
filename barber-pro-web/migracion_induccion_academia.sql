-- ====================================================================
-- MIGRACIÓN: Módulo Academia & Inducción Barbera
-- ====================================================================

-- 1. Tabla Principal de Inducciones / Cursos
CREATE TABLE IF NOT EXISTS public.inducciones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo VARCHAR(255) NOT NULL,
  descripcion TEXT,
  categoria VARCHAR(100) DEFAULT 'Servicio Técnico', -- 'Servicio Técnico', 'Atención al Cliente', 'Higiene & Limpieza', 'Protocolo de Bienvenida', 'Mantenimiento de Herramientas'
  servicio_id UUID REFERENCES public.servicios(id) ON DELETE SET NULL,
  youtube_url TEXT NOT NULL,
  herramientas_requeridas TEXT[] DEFAULT '{}',
  duracion_minutos INT DEFAULT 15,
  orden INT DEFAULT 0,
  is_published BOOLEAN DEFAULT true,
  creado_por UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Pasos Detallados del Servicio / Video
CREATE TABLE IF NOT EXISTS public.induccion_pasos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  induccion_id UUID REFERENCES public.inducciones(id) ON DELETE CASCADE,
  numero_paso INT NOT NULL,
  titulo_paso VARCHAR(255) NOT NULL,
  descripcion TEXT,
  timestamp_segundos INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Asignación Personalizada por Barbero
CREATE TABLE IF NOT EXISTS public.induccion_asignaciones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  induccion_id UUID REFERENCES public.inducciones(id) ON DELETE CASCADE,
  barbero_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  asignado_por UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(induccion_id, barbero_id)
);

-- 4. Registro de Progreso / Visto por Barbero
CREATE TABLE IF NOT EXISTS public.induccion_progreso (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  induccion_id UUID REFERENCES public.inducciones(id) ON DELETE CASCADE,
  barbero_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  estado VARCHAR(50) DEFAULT 'completado',
  fecha_completado TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(induccion_id, barbero_id)
);

-- Índices para velocidad de consulta
CREATE INDEX IF NOT EXISTS idx_inducciones_published ON public.inducciones(is_published);
CREATE INDEX IF NOT EXISTS idx_inducciones_categoria ON public.inducciones(categoria);
CREATE INDEX IF NOT EXISTS idx_induccion_pasos_induccion ON public.induccion_pasos(induccion_id);
CREATE INDEX IF NOT EXISTS idx_induccion_asig_barbero ON public.induccion_asignaciones(barbero_id);
CREATE INDEX IF NOT EXISTS idx_induccion_prog_barbero ON public.induccion_progreso(barbero_id);

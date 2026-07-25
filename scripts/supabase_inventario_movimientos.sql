-- =============================================
-- MIGRACIÓN ADICIONAL: Tabla inventario_movimientos
-- Solo ejecutar si la tabla NO existe ya en Supabase
-- =============================================

CREATE TABLE IF NOT EXISTS public.inventario_movimientos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id UUID NOT NULL REFERENCES public.productos(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada','salida')),
  cantidad INTEGER NOT NULL CHECK (cantidad >= 0),
  motivo TEXT,
  usuario_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inv_mov_producto ON public.inventario_movimientos(producto_id);
CREATE INDEX IF NOT EXISTS idx_inv_mov_fecha ON public.inventario_movimientos(created_at);

-- RLS
ALTER TABLE public.inventario_movimientos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff ver movimientos inventario" ON public.inventario_movimientos
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid()
      AND role IN ('admin','coordinador'))
  );

CREATE POLICY "Staff crear movimientos inventario" ON public.inventario_movimientos
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid()
      AND role IN ('admin','coordinador'))
  );

-- ✅ HECHO
-- Verifica con: SELECT count(*) FROM inventario_movimientos;

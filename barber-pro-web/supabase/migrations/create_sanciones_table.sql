-- Migración opcional: Tabla dedicada para sanciones administrativas
-- El backend de BarberSite ya soporta tanto esta tabla como la vista contable transactions con fallback transparente.

CREATE TABLE IF NOT EXISTS public.sanciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    barbero_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL DEFAULT 'Sanción Administrativa',
    descripcion TEXT,
    monto NUMERIC(10, 2) NOT NULL DEFAULT 0,
    estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'pagada', 'aplicada', 'anulada')),
    aplicada_en_pago_id UUID,
    pagado_at TIMESTAMPTZ,
    creado_en TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indices para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_sanciones_barbero ON public.sanciones(barbero_id);
CREATE INDEX IF NOT EXISTS idx_sanciones_estado ON public.sanciones(estado);

-- RLS
ALTER TABLE public.sanciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins y coordinadores gestionan sanciones" ON public.sanciones;
CREATE POLICY "Admins y coordinadores gestionan sanciones" ON public.sanciones
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'coordinador')
        )
    );

DROP POLICY IF EXISTS "Barberos leen sus propias sanciones" ON public.sanciones;
CREATE POLICY "Barberos leen sus propias sanciones" ON public.sanciones
    FOR SELECT USING (
        barbero_id = auth.uid()
    );

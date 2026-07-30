-- Migration: Permitir guardar múltiples servicios (IDs separados por coma) en metas de lealtad y promociones
-- Ejecutar en Supabase SQL Editor si la columna servicio_id tenía restricción de FK o tipo UUID simple.

ALTER TABLE public.lealtad_metas DROP CONSTRAINT IF EXISTS lealtad_metas_servicio_id_fkey;
ALTER TABLE public.lealtad_metas ALTER COLUMN servicio_id TYPE text USING servicio_id::text;

ALTER TABLE public.promociones DROP CONSTRAINT IF EXISTS promociones_servicio_id_fkey;
ALTER TABLE public.promociones ALTER COLUMN servicio_id TYPE text USING servicio_id::text;

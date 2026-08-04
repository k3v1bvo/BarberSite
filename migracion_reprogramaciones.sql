ALTER TABLE public.citas ADD COLUMN IF NOT EXISTS reprogramacion_estado text DEFAULT NULL;
ALTER TABLE public.citas ADD COLUMN IF NOT EXISTS fecha_hora_solicitada timestamp with time zone DEFAULT NULL;

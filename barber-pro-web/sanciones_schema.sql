CREATE TABLE IF NOT EXISTS public.sanciones (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  barbero_id uuid NOT NULL,
  tipo text NOT NULL CHECK (tipo = ANY (ARRAY['llegada_tarde'::text, 'falta'::text, 'salida_temprano'::text, 'otro'::text])),
  descripcion text,
  monto numeric NOT NULL,
  estado text DEFAULT 'pendiente'::text CHECK (estado = ANY (ARRAY['pendiente'::text, 'aplicada'::text, 'perdonada'::text])),
  cita_id uuid,
  aplicada_en_pago_id uuid,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  creado_en timestamp with time zone DEFAULT now(),
  CONSTRAINT sanciones_pkey PRIMARY KEY (id),
  CONSTRAINT sanciones_barbero_id_fkey FOREIGN KEY (barbero_id) REFERENCES public.profiles(id),
  CONSTRAINT sanciones_cita_id_fkey FOREIGN KEY (cita_id) REFERENCES public.citas(id),
  CONSTRAINT sanciones_aplicada_en_pago_id_fkey FOREIGN KEY (aplicada_en_pago_id) REFERENCES public.comisiones_pagos(id)
);

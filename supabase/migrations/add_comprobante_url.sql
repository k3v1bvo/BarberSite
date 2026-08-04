-- Añadir comprobante_url a citas
ALTER TABLE public.citas
ADD COLUMN comprobante_url text;

-- Añadir comprobante_url a transactions (arqueo de caja)
ALTER TABLE public.transactions
ADD COLUMN comprobante_url text;

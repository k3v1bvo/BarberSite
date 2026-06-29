-- Migración: Actualizar constraints de transactions para soportar USO_TIENDA, EGRESOS y descuento_caja

-- 1. Actualizar el CHECK de 'libro' para incluir USO_TIENDA y EGRESOS
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_libro_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_libro_check 
  CHECK (libro::text = ANY (ARRAY['CAJA_CHICA', 'VENTAS', 'SERVICIOS', 'BANCO', 'USO_TIENDA', 'EGRESOS']::text[]));

-- 2. Actualizar el CHECK de 'metodo_pago' para incluir descuento_caja
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_metodo_pago_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_metodo_pago_check
  CHECK (metodo_pago IS NULL OR (metodo_pago::text = ANY (ARRAY['efectivo', 'qr', 'tarjeta', 'mixto', 'descuento_caja']::text[])));

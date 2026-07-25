-- Migración para añadir el campo de QR de pago personalizado a los perfiles de los barberos
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS qr_code_url text;

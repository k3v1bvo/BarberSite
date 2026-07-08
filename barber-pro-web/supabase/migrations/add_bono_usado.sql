-- Añadir columna bono_usado para controlar cuando el referidor consume su descuento
ALTER TABLE public.referrals ADD COLUMN bono_usado BOOLEAN DEFAULT FALSE;

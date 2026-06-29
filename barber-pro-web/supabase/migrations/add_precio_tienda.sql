-- Agregar precio especial para tienda (precio mayorista/interno)
-- Ejecutar en Supabase SQL Editor

ALTER TABLE productos
ADD COLUMN IF NOT EXISTS precio_tienda numeric(10,2) DEFAULT NULL;

COMMENT ON COLUMN productos.precio_tienda IS 
  'Precio especial cuando el producto es adquirido por la tienda/negocio. Solo editable por admin. Si NULL, no tiene precio especial de tienda definido.';

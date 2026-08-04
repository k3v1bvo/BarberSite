-- Migración para enriquecer la tabla servicios con imágenes y categorías
-- Ejecutar en el SQL Editor de Supabase

ALTER TABLE servicios
ADD COLUMN IF NOT EXISTS imagen_url text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS imagenes text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS categoria text DEFAULT 'Cortes';

COMMENT ON COLUMN servicios.imagen_url IS 'URL de la imagen principal del servicio';
COMMENT ON COLUMN servicios.imagenes IS 'Arreglo de URLs con múltiples imágenes del servicio (galería)';
COMMENT ON COLUMN servicios.categoria IS 'Categoría del servicio: Cortes, Combos, Cuidado Facial, Permanentes, Otros';

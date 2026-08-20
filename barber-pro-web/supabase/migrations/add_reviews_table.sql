-- Migración para asegurar la tabla de reseñas (comentarios de servicios por clientes)
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  barbero_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  cita_id UUID REFERENCES citas(id) ON DELETE SET NULL,
  estrellas INTEGER NOT NULL DEFAULT 5 CHECK (estrellas >= 1 AND estrellas <= 5),
  comentario TEXT,
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices útiles
CREATE INDEX IF NOT EXISTS idx_reviews_is_public ON reviews(is_public);
CREATE INDEX IF NOT EXISTS idx_reviews_cliente_id ON reviews(cliente_id);
CREATE INDEX IF NOT EXISTS idx_reviews_barbero_id ON reviews(barbero_id);

-- Políticas RLS básicas (si RLS está activo)
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Lectura pública para reseñas aprobadas
CREATE POLICY "Public read approved reviews" ON reviews
  FOR SELECT USING (is_public = true);

-- Clientes y Admins pueden ver y gestionar
CREATE POLICY "Auth users read and write reviews" ON reviews
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

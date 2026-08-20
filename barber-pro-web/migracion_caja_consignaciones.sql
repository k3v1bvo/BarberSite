-- ============================================================
-- SCRIPT DE MIGRACIÓN: Caja Chica + Consignaciones + Limpieza
-- Ejecutar en Supabase SQL Editor en orden
-- ============================================================

-- 1. NUEVAS TABLAS: Consignaciones
-- ============================================================

CREATE TABLE IF NOT EXISTS public.consignaciones (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  proveedor_nombre text NOT NULL DEFAULT 'Proveedor Principal',
  fecha_recepcion date NOT NULL DEFAULT CURRENT_DATE,
  notas text,
  estado text DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'pagado_parcial', 'pagado')),
  total_costo numeric NOT NULL DEFAULT 0,
  total_pagado numeric DEFAULT 0,
  creado_en timestamptz DEFAULT now(),
  CONSTRAINT consignaciones_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.consignacion_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  consignacion_id uuid NOT NULL,
  producto_id uuid NOT NULL,
  cantidad_recibida integer NOT NULL,
  precio_costo_unitario numeric NOT NULL,
  CONSTRAINT consignacion_items_pkey PRIMARY KEY (id),
  CONSTRAINT consignacion_items_consignacion_id_fkey FOREIGN KEY (consignacion_id) REFERENCES public.consignaciones(id) ON DELETE CASCADE,
  CONSTRAINT consignacion_items_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id)
);

CREATE TABLE IF NOT EXISTS public.consignacion_pagos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  consignacion_id uuid,
  monto numeric NOT NULL,
  metodo_pago text DEFAULT 'efectivo' CHECK (metodo_pago IN ('efectivo','qr','mixto','transferencia')),
  monto_efectivo numeric DEFAULT 0,
  monto_qr numeric DEFAULT 0,
  notas text,
  registrado_por text NOT NULL,
  pagado_en timestamptz DEFAULT now(),
  CONSTRAINT consignacion_pagos_pkey PRIMARY KEY (id),
  CONSTRAINT consignacion_pagos_consignacion_id_fkey FOREIGN KEY (consignacion_id) REFERENCES public.consignaciones(id)
);

-- 2. MODIFICAR TRANSACTIONS: Añadir subcategoria + montos desglosados
-- ============================================================

ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS subcategoria text;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS monto_efectivo numeric DEFAULT 0;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS monto_qr numeric DEFAULT 0;

-- Migrar datos existentes a nuevo esquema INGRESO/EGRESO con subcategoría
UPDATE public.transactions SET tipo_movimiento = 'INGRESO', subcategoria = 'SERVICIO' WHERE tipo_movimiento = 'PAGO_CLIENTE' AND subcategoria IS NULL;
UPDATE public.transactions SET tipo_movimiento = 'INGRESO', subcategoria = 'PRODUCTO_VENTA' WHERE tipo_movimiento = 'VENTA_PRODUCTO' AND subcategoria IS NULL;
UPDATE public.transactions SET tipo_movimiento = 'EGRESO', subcategoria = 'USO_TIENDA' WHERE tipo_movimiento = 'USO_TIENDA' AND subcategoria IS NULL;
UPDATE public.transactions SET tipo_movimiento = 'EGRESO', subcategoria = 'GASTO_GENERAL' WHERE tipo_movimiento = 'EGRESO' AND subcategoria IS NULL;
UPDATE public.transactions SET subcategoria = 'SANCION' WHERE es_sancion = true AND subcategoria IS NULL;
-- Marcar INGRESO los que tienen tipo_movimiento no reconocido y subcategoría nula
UPDATE public.transactions SET tipo_movimiento = 'INGRESO', subcategoria = 'OTRO' WHERE subcategoria IS NULL AND tipo_movimiento NOT IN ('INGRESO', 'EGRESO');

-- 3. MODIFICAR EGRESOS: Método de pago
-- ============================================================

ALTER TABLE public.egresos ADD COLUMN IF NOT EXISTS metodo_pago text DEFAULT 'efectivo';
ALTER TABLE public.egresos ADD COLUMN IF NOT EXISTS monto_efectivo numeric DEFAULT 0;
ALTER TABLE public.egresos ADD COLUMN IF NOT EXISTS monto_qr numeric DEFAULT 0;

-- 4. ELIMINAR PRECIO_TIENDA DE PRODUCTOS
-- ============================================================

ALTER TABLE public.productos DROP COLUMN IF EXISTS precio_tienda;

-- 5. HABILITAR RLS (Row Level Security) para nuevas tablas
-- ============================================================

ALTER TABLE public.consignaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consignacion_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consignacion_pagos ENABLE ROW LEVEL SECURITY;

-- Policies para que usuarios autenticados puedan acceder
CREATE POLICY "Authenticated users can read consignaciones" ON public.consignaciones FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert consignaciones" ON public.consignaciones FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update consignaciones" ON public.consignaciones FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can read consignacion_items" ON public.consignacion_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert consignacion_items" ON public.consignacion_items FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can read consignacion_pagos" ON public.consignacion_pagos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert consignacion_pagos" ON public.consignacion_pagos FOR INSERT TO authenticated WITH CHECK (true);

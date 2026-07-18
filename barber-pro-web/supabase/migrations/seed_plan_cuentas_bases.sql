-- ====================================================================
-- SEED DE CUENTAS BASE PARA EL PLAN DE CUENTAS
-- Evita el error: violates foreign key constraint "transactions_cuenta_codigo_fkey"
-- y "egresos_cuenta_codigo_fkey" en transacciones y egresos.
-- ====================================================================

INSERT INTO public.plan_cuentas (codigo, detalle, tipo, nivel, es_sancion)
VALUES
  ('000', 'Movimiento General / Sin Categoría', 'EGRESO', 1, false),
  ('ING-001', 'Ingresos por Servicios de Barbería', 'INGRESO', 1, false),
  ('EGR-GEN', 'Gastos Generales y Varios', 'EGRESO', 1, false),
  ('EGR-COM', 'Pago de Comisiones y Sueldos', 'EGRESO', 1, false),
  ('ING-SANCION', 'Ingreso por Sanción al Personal', 'INGRESO', 1, false),
  ('EGR-BONO', 'Pago de Bonos e Incentivos', 'EGRESO', 1, false),
  ('ACT-001', 'Anticipos y Préstamos al Personal', 'ACTIVO', 1, false),
  ('EGRESO', 'Pago de Consignaciones y Proveedores', 'EGRESO', 1, false),
  ('4.1.2', 'Ingresos por Venta de Productos', 'INGRESO', 2, false),
  ('4.1.3', 'Otros Ingresos / Bonos y Premios', 'INGRESO', 2, false),
  ('EGR-CIE', 'Diferencia de Cierre de Caja / Arqueo', 'EGRESO', 1, false)
ON CONFLICT (codigo) DO UPDATE SET
  detalle = EXCLUDED.detalle,
  tipo = EXCLUDED.tipo;

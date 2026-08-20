-- ====================================================================
-- MIGRACIÓN: Reparar transacciones POS con método de pago incorrecto
-- ====================================================================
-- PROBLEMA: El checkout POS no consideraba el anticipo QR ni el método
-- de pago real al crear la transacción en la tabla transactions.
-- Las citas tienen los datos correctos (metodo_pago, anticipo_monto,
-- comprobante_url), pero las transacciones se guardaron como 'efectivo'.
--
-- SOLUCIÓN: Cruzar transactions con citas por empleado_id = barbero_id,
-- cliente_id, y fecha cercana. Luego actualizar la transacción con los
-- datos reales de la cita.
-- ====================================================================

-- PASO 1: Ver transacciones SERVICIOS que podrían estar mal
-- (antes de actualizar, puedes ejecutar esto para ver cuáles se afectan)
SELECT 
  t.id AS tx_id,
  t.fecha,
  t.nombre AS cliente,
  t.metodo_pago AS tx_metodo,
  t.monto_efectivo AS tx_ef,
  t.monto_qr AS tx_qr,
  t.costo AS tx_total,
  t.glosa,
  c.id AS cita_id,
  c.metodo_pago AS cita_metodo,
  c.anticipo_monto AS cita_anticipo,
  c.precio AS cita_precio,
  c.estado AS cita_estado
FROM transactions t
JOIN citas c 
  ON c.barbero_id = t.empleado_id
  AND c.cliente_id = t.cliente_id
  AND c.estado = 'completado'
  AND ABS(c.precio - t.costo) < 1  -- mismo monto (tolerancia < 1 Bs)
  AND t.fecha::text = to_char(c.updated_at AT TIME ZONE 'America/La_Paz', 'YYYY-MM-DD')
WHERE t.subcategoria = 'SERVICIO'
  AND t.libro = 'SERVICIOS'
  AND t.tipo_movimiento = 'INGRESO'
  -- Solo las que tienen método de pago incorrecto
  AND (
    -- La cita dice QR pero la transacción dice efectivo
    (c.metodo_pago IN ('qr', 'tarjeta') AND t.metodo_pago = 'efectivo')
    -- O la cita tiene anticipo pero la transacción no lo refleja
    OR (COALESCE(c.anticipo_monto, 0) > 0 AND COALESCE(t.monto_qr, 0) = 0)
    -- O la cita dice mixto pero la transacción dice efectivo
    OR (c.metodo_pago = 'mixto' AND t.metodo_pago = 'efectivo')
  )
ORDER BY t.fecha DESC;


-- PASO 2: Actualizar las transacciones con los datos reales de las citas
-- ⚠️ EJECUTAR SOLO DESPUÉS DE REVISAR EL PASO 1
UPDATE transactions t
SET
  cita_id = c.id,
  metodo_pago = CASE
    -- Si tiene anticipo QR + pago en efectivo => mixto
    WHEN COALESCE(c.anticipo_monto, 0) > 0 AND c.metodo_pago = 'efectivo' THEN 'mixto'
    -- Si tiene anticipo QR + pago QR => qr
    WHEN COALESCE(c.anticipo_monto, 0) > 0 AND c.metodo_pago IN ('qr', 'tarjeta') THEN 'qr'
    -- Sin anticipo, usar método de la cita tal cual
    ELSE COALESCE(c.metodo_pago, t.metodo_pago)
  END,
  monto_efectivo = CASE
    WHEN COALESCE(c.anticipo_monto, 0) > 0 AND c.metodo_pago = 'efectivo'
      THEN c.precio - COALESCE(c.anticipo_monto, 0)
    WHEN c.metodo_pago = 'efectivo' THEN c.precio
    WHEN c.metodo_pago = 'mixto' THEN COALESCE(t.monto_efectivo, 0)
    ELSE 0
  END,
  monto_qr = CASE
    WHEN COALESCE(c.anticipo_monto, 0) > 0 AND c.metodo_pago IN ('qr', 'tarjeta')
      THEN c.precio  -- todo fue QR (anticipo + resto)
    WHEN COALESCE(c.anticipo_monto, 0) > 0 AND c.metodo_pago = 'efectivo'
      THEN COALESCE(c.anticipo_monto, 0)  -- solo el anticipo fue QR
    WHEN c.metodo_pago IN ('qr', 'tarjeta') THEN c.precio
    WHEN c.metodo_pago = 'mixto' THEN COALESCE(t.monto_qr, 0)
    ELSE 0
  END,
  cuenta_detalle = COALESCE(
    (SELECT s.nombre FROM servicios s WHERE s.id = c.servicio_id),
    t.cuenta_detalle
  ),
  notas = CASE
    WHEN COALESCE(c.anticipo_monto, 0) > 0
      THEN 'Anticipo QR: Bs ' || c.anticipo_monto 
        || ' | Cobrado en caja (' || COALESCE(c.metodo_pago, 'efectivo') || '): Bs ' 
        || (c.precio - COALESCE(c.anticipo_monto, 0))
        || CASE WHEN c.metodo_pago IN ('qr', 'tarjeta') THEN ' [CORREGIDO]' ELSE '' END
    ELSE COALESCE(t.notas, 'Método corregido desde cita: ' || c.metodo_pago || ' [CORREGIDO]')
  END
FROM citas c
WHERE c.barbero_id = t.empleado_id
  AND c.cliente_id = t.cliente_id
  AND c.estado = 'completado'
  AND ABS(c.precio - t.costo) < 1
  AND t.fecha::text = to_char(c.updated_at AT TIME ZONE 'America/La_Paz', 'YYYY-MM-DD')
  AND t.subcategoria = 'SERVICIO'
  AND t.libro = 'SERVICIOS'
  AND t.tipo_movimiento = 'INGRESO'
  AND (
    (c.metodo_pago IN ('qr', 'tarjeta') AND t.metodo_pago = 'efectivo')
    OR (COALESCE(c.anticipo_monto, 0) > 0 AND COALESCE(t.monto_qr, 0) = 0)
    OR (c.metodo_pago = 'mixto' AND t.metodo_pago = 'efectivo')
  );


-- PASO 3: Vincular cita_id en TODAS las transacciones de servicio que no lo tengan
-- (para poder rastrear en el futuro)
UPDATE transactions t
SET cita_id = c.id
FROM citas c
WHERE c.barbero_id = t.empleado_id
  AND c.cliente_id = t.cliente_id
  AND c.estado = 'completado'
  AND ABS(c.precio - t.costo) < 1
  AND t.fecha::text = to_char(c.updated_at AT TIME ZONE 'America/La_Paz', 'YYYY-MM-DD')
  AND t.subcategoria = 'SERVICIO'
  AND t.libro = 'SERVICIOS'
  AND t.cita_id IS NULL;


-- PASO 4: Verificar resultados
SELECT 
  t.id AS tx_id,
  t.fecha,
  t.nombre,
  t.metodo_pago,
  t.monto_efectivo,
  t.monto_qr,
  t.costo,
  t.cita_id,
  t.notas
FROM transactions t
WHERE t.subcategoria = 'SERVICIO'
  AND t.libro = 'SERVICIOS'
ORDER BY t.fecha DESC
LIMIT 20;

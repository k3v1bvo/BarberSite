-- =============================================
-- MIGRACIÓN ERP BARBERÍA
-- Ejecutar en Supabase SQL Editor (pegar y ejecutar)
-- =============================================

-- =============================================
-- PASO 1: RENOMBRAR ROL recepcionista → coordinador
-- =============================================
UPDATE public.profiles SET role = 'coordinador' WHERE role = 'recepcionista';

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role = ANY (ARRAY['admin'::text, 'coordinador'::text, 'barbero'::text, 'cliente'::text]));

-- =============================================
-- PASO 2: AGREGAR CAMPO C.I. (Cédula de Identidad)
-- =============================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ci VARCHAR(30);
CREATE INDEX IF NOT EXISTS idx_profiles_ci ON public.profiles(ci);

ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS ci VARCHAR(30);
CREATE UNIQUE INDEX IF NOT EXISTS idx_clientes_ci ON public.clientes(ci) WHERE ci IS NOT NULL;

ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS nivel_fidelidad TEXT DEFAULT 'BRONCE';

-- =============================================
-- PASO 3: PLAN DE CUENTAS
-- =============================================
CREATE TABLE IF NOT EXISTS public.plan_cuentas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(50) NOT NULL UNIQUE,
  detalle TEXT NOT NULL,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('ACTIVO','PASIVO','PATRIMONIO','INGRESO','EGRESO')),
  nivel INTEGER NOT NULL,
  es_sancion BOOLEAN DEFAULT FALSE,
  creado_en TIMESTAMPTZ DEFAULT now()
);

-- Insertar cuentas del Excel del cliente
INSERT INTO public.plan_cuentas (codigo, detalle, tipo, nivel, es_sancion) VALUES
  -- ACTIVOS
  ('1', 'ACTIVO', 'ACTIVO', 1, FALSE),
  ('1.1', 'Activo Corriente', 'ACTIVO', 2, FALSE),
  ('1.1.1', 'Caja', 'ACTIVO', 3, FALSE),
  ('1.1.1.1', 'Caja Moneda Nacional', 'ACTIVO', 4, FALSE),
  ('1.1.1.1.1', 'caja chica M.N.', 'ACTIVO', 5, FALSE),
  ('1.1.1.4', 'Bancos', 'ACTIVO', 4, FALSE),
  ('1.1.1.4.1', 'Caja de ahorro M.N. BANCO GANADERO', 'ACTIVO', 5, FALSE),
  ('1.1.3', 'Inventarios', 'ACTIVO', 3, FALSE),
  -- PATRIMONIO
  ('3', 'PATRIMONIO', 'PATRIMONIO', 1, FALSE),
  ('3.1', 'Capital Social', 'PATRIMONIO', 2, FALSE),
  ('3.1.1', 'Socio Maria Eugenia Castillo Chavarria', 'PATRIMONIO', 3, FALSE),
  -- INGRESOS
  ('4', 'INGRESOS', 'INGRESO', 1, FALSE),
  ('4.1', 'Ingresos Operativos', 'INGRESO', 2, FALSE),
  ('4.1.2', 'Ventas y Servicios', 'INGRESO', 3, FALSE),
  ('4.1.2.1', 'Corte de cabello', 'INGRESO', 4, FALSE),
  ('4.1.2.2', 'Arreglo de barba', 'INGRESO', 4, FALSE),
  ('4.1.2.12', 'Combo C.Cabello + A.Barba', 'INGRESO', 4, FALSE),
  ('4.2', 'Otros Ingresos', 'INGRESO', 2, FALSE),
  ('4.2.1', 'Aportes de Capital', 'INGRESO', 3, FALSE),
  ('4.2.2', 'Adelantos de Clientes', 'INGRESO', 3, FALSE),
  ('4.2.3', 'Depósitos Bancarios', 'INGRESO', 3, FALSE),
  ('4.2.4', 'Sanciones', 'INGRESO', 3, TRUE),
  ('4.2.4.3', 'Imcumplimiento horario', 'INGRESO', 4, TRUE),
  ('4.2.4.5', 'Retiro por hora(s) sin permiso', 'INGRESO', 4, TRUE),
  ('4.2.4.6', 'Ausencia sin permiso', 'INGRESO', 4, TRUE),
  -- EGRESOS
  ('5', 'EGRESOS', 'EGRESO', 1, FALSE),
  ('5.1', 'Gastos Operativos', 'EGRESO', 2, FALSE),
  ('5.1.1', 'Compra de Insumos', 'EGRESO', 3, FALSE),
  ('5.1.2', 'Servicios Básicos', 'EGRESO', 3, FALSE),
  ('5.1.3', 'Alquiler', 'EGRESO', 3, FALSE),
  ('5.2', 'Gastos Administrativos', 'EGRESO', 2, FALSE),
  ('5.2.1', 'Gastos de Personal', 'EGRESO', 3, FALSE),
  ('5.2.1.1', 'Remuneraciones', 'EGRESO', 4, FALSE),
  ('5.2.1.1.1', 'Sueldos y salarios', 'EGRESO', 5, FALSE),
  ('5.2.1.1.3', 'Comisiones barberos', 'EGRESO', 5, FALSE),
  ('5.2.3', 'Gastos Varios', 'EGRESO', 3, FALSE),
  ('5.2.3.3', 'TRIPODE APOYADOR para grabar con movil', 'INGRESO', 4, FALSE)
ON CONFLICT (codigo) DO NOTHING;

-- =============================================
-- PASO 4: TABLA TRANSACTIONS (Libro Central)
-- =============================================
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  libro VARCHAR(20) NOT NULL CHECK (libro IN ('CAJA_CHICA','VENTAS','SERVICIOS','BANCO')),
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  ci VARCHAR(30) NOT NULL,
  nombre TEXT NOT NULL,
  cuenta_codigo VARCHAR(50) NOT NULL REFERENCES public.plan_cuentas(codigo),
  cuenta_detalle TEXT NOT NULL,
  glosa TEXT NOT NULL,
  costo NUMERIC(12,2) NOT NULL CHECK (costo >= 0),
  tipo_movimiento VARCHAR(30) NOT NULL,
  es_sancion BOOLEAN DEFAULT FALSE,
  empleado_id UUID REFERENCES public.profiles(id),
  cliente_id UUID REFERENCES public.clientes(id),
  cita_id UUID REFERENCES public.citas(id),
  producto_id UUID REFERENCES public.productos(id),
  cantidad_producto NUMERIC(8,2),
  metodo_pago VARCHAR(20) CHECK (metodo_pago IS NULL OR metodo_pago IN ('efectivo','qr','tarjeta','mixto')),
  usuario_registro VARCHAR(100) NOT NULL,
  notas TEXT,
  creado_en TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tx_fecha_libro ON public.transactions(fecha, libro);
CREATE INDEX IF NOT EXISTS idx_tx_ci ON public.transactions(ci);
CREATE INDEX IF NOT EXISTS idx_tx_cuenta ON public.transactions(cuenta_codigo);
CREATE INDEX IF NOT EXISTS idx_tx_tipo ON public.transactions(tipo_movimiento);
CREATE INDEX IF NOT EXISTS idx_tx_sancion ON public.transactions(es_sancion) WHERE es_sancion = TRUE;

-- =============================================
-- PASO 5: DAILY CLOSURES (Arqueo Diario)
-- =============================================
CREATE TABLE IF NOT EXISTS public.daily_closures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha DATE NOT NULL UNIQUE,
  caja_chica NUMERIC(12,2) DEFAULT 0,
  ventas NUMERIC(12,2) DEFAULT 0,
  servicios NUMERIC(12,2) DEFAULT 0,
  banco NUMERIC(12,2) DEFAULT 0,
  total_registrado NUMERIC(12,2) GENERATED ALWAYS AS (
    caja_chica + ventas + servicios + banco
  ) STORED,
  total_efectivo_fisico NUMERIC(12,2) DEFAULT 0,
  total_qr NUMERIC(12,2) DEFAULT 0,
  diferencia NUMERIC(12,2) GENERATED ALWAYS AS (
    (COALESCE(total_efectivo_fisico, 0) + COALESCE(total_qr, 0)) - (COALESCE(caja_chica, 0) + COALESCE(ventas, 0) + COALESCE(servicios, 0) + COALESCE(banco, 0))
  ) STORED,
  observaciones TEXT,
  usuario_cierre VARCHAR(100) NOT NULL,
  cerrado BOOLEAN DEFAULT FALSE,
  creado_en TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- PASO 6: EGRESOS
-- =============================================
CREATE TABLE IF NOT EXISTS public.egresos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  concepto TEXT NOT NULL,
  proveedor TEXT,
  monto_bruto NUMERIC(12,2) NOT NULL,
  tiene_factura BOOLEAN DEFAULT FALSE,
  iva NUMERIC(12,2) DEFAULT 0,
  it NUMERIC(12,2) DEFAULT 0,
  monto_neto NUMERIC(12,2) NOT NULL,
  numero_factura TEXT,
  cuenta_codigo VARCHAR(50) REFERENCES public.plan_cuentas(codigo),
  usuario_registro VARCHAR(100) NOT NULL,
  notas TEXT,
  creado_en TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- PASO 7: REFERIDOS
-- =============================================
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_recomendante_id UUID REFERENCES public.clientes(id),
  cliente_recomendado_id UUID REFERENCES public.clientes(id),
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  bono_otorgado BOOLEAN DEFAULT FALSE,
  monto_bono NUMERIC(10,2) DEFAULT 0,
  creado_en TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- PASO 8: AUDIT LOG
-- =============================================
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tabla_afectada TEXT NOT NULL,
  registro_id TEXT,
  accion TEXT NOT NULL CHECK (accion IN ('INSERT','UPDATE','DELETE')),
  usuario VARCHAR(100),
  usuario_id UUID,
  fecha TIMESTAMPTZ DEFAULT now(),
  datos_anteriores JSONB,
  datos_nuevos JSONB
);

CREATE INDEX IF NOT EXISTS idx_audit_tabla ON public.audit_log(tabla_afectada);
CREATE INDEX IF NOT EXISTS idx_audit_fecha ON public.audit_log(fecha);

-- =============================================
-- PASO 9: BONOS
-- =============================================
CREATE TABLE IF NOT EXISTS public.bonos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbero_id UUID NOT NULL REFERENCES public.profiles(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('puntualidad','cantidad_servicios','metas','otro')),
  descripcion TEXT,
  monto NUMERIC(10,2) NOT NULL,
  mes INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  anio INTEGER NOT NULL,
  pagado BOOLEAN DEFAULT FALSE,
  pagado_at TIMESTAMPTZ,
  creado_en TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- PASO 10: TRIGGERS
-- =============================================

-- Trigger para auto-marcar sanciones
CREATE OR REPLACE FUNCTION trg_marcar_sancion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.cuenta_codigo LIKE '4.2.4%' THEN
    NEW.es_sancion := TRUE;
    NEW.tipo_movimiento := 'SANCCION';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_marcar_sancion ON public.transactions;
CREATE TRIGGER trigger_marcar_sancion
  BEFORE INSERT ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION trg_marcar_sancion();

-- Trigger de auditoría automática en transactions
CREATE OR REPLACE FUNCTION fn_audit_transactions()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log(tabla_afectada, registro_id, accion, usuario, datos_nuevos)
    VALUES ('transactions', NEW.id::TEXT, 'INSERT', NEW.usuario_registro, to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_log(tabla_afectada, registro_id, accion, usuario, datos_anteriores, datos_nuevos)
    VALUES ('transactions', NEW.id::TEXT, 'UPDATE', NEW.usuario_registro, to_jsonb(OLD), to_jsonb(NEW));
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log(tabla_afectada, registro_id, accion, datos_anteriores)
    VALUES ('transactions', OLD.id::TEXT, 'DELETE', to_jsonb(OLD));
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_transactions ON public.transactions;
CREATE TRIGGER trg_audit_transactions
  AFTER INSERT OR UPDATE OR DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION fn_audit_transactions();

-- =============================================
-- PASO 11: VISTAS (replican el Excel)
-- =============================================
CREATE OR REPLACE VIEW public.vista_caja_chica AS
  SELECT * FROM public.transactions WHERE libro = 'CAJA_CHICA';

CREATE OR REPLACE VIEW public.vista_ventas_servicios AS
  SELECT * FROM public.transactions WHERE libro IN ('VENTAS', 'SERVICIOS');

CREATE OR REPLACE VIEW public.vista_banco AS
  SELECT * FROM public.transactions WHERE libro = 'BANCO';

CREATE OR REPLACE VIEW public.vista_sanciones AS
  SELECT * FROM public.transactions WHERE es_sancion = TRUE;

CREATE OR REPLACE VIEW public.vista_arqueo_diario AS
  SELECT 
    fecha,
    SUM(CASE WHEN libro = 'CAJA_CHICA' THEN costo ELSE 0 END) AS caja_chica,
    SUM(CASE WHEN libro IN ('VENTAS','SERVICIOS') THEN costo ELSE 0 END) AS ventas_servicios,
    SUM(CASE WHEN libro = 'BANCO' THEN costo ELSE 0 END) AS banco,
    SUM(costo) AS total_registrado,
    COUNT(*) AS total_movimientos
  FROM public.transactions 
  GROUP BY fecha
  ORDER BY fecha DESC;

-- =============================================
-- PASO 12: RLS POLICIES
-- =============================================
ALTER TABLE public.plan_cuentas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_closures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.egresos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bonos ENABLE ROW LEVEL SECURITY;

-- Plan de cuentas: lectura para staff
CREATE POLICY "Staff puede ver plan_cuentas" ON public.plan_cuentas
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() 
      AND role IN ('admin','coordinador'))
  );

CREATE POLICY "Admin puede gestionar plan_cuentas" ON public.plan_cuentas
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Transactions: coordinador y admin
CREATE POLICY "Staff contable ver transactions" ON public.transactions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() 
      AND role IN ('admin','coordinador'))
  );

CREATE POLICY "Staff contable crear transactions" ON public.transactions
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() 
      AND role IN ('admin','coordinador','barbero'))
  );

-- Daily closures
CREATE POLICY "Staff contable ver closures" ON public.daily_closures
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() 
      AND role IN ('admin','coordinador'))
  );

CREATE POLICY "Staff contable gestionar closures" ON public.daily_closures
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() 
      AND role IN ('admin','coordinador'))
  );

-- Egresos
CREATE POLICY "Staff contable ver egresos" ON public.egresos
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() 
      AND role IN ('admin','coordinador'))
  );

CREATE POLICY "Staff contable crear egresos" ON public.egresos
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() 
      AND role IN ('admin','coordinador'))
  );

-- Bonos: staff ve, barbero ve los suyos
CREATE POLICY "Staff ver bonos" ON public.bonos
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() 
      AND role IN ('admin','coordinador'))
    OR barbero_id = auth.uid()
  );

CREATE POLICY "Staff contable crear bonos" ON public.bonos
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() 
      AND role IN ('admin','coordinador'))
  );

-- Audit log: solo admin
CREATE POLICY "Admin ver audit" ON public.audit_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() 
      AND role IN ('admin','coordinador'))
  );

-- Referrals
CREATE POLICY "Staff ver referrals" ON public.referrals
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() 
      AND role IN ('admin','coordinador'))
  );

CREATE POLICY "Staff crear referrals" ON public.referrals
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() 
      AND role IN ('admin','coordinador'))
  );

-- =============================================
-- ✅ MIGRACIÓN COMPLETADA
-- =============================================
-- Verifica con: SELECT * FROM plan_cuentas ORDER BY codigo;
-- Verifica roles: SELECT role, count(*) FROM profiles GROUP BY role;

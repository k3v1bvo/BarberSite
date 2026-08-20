-- Agrega la columna codigo_tarjeta a la tabla clientes
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS codigo_tarjeta TEXT UNIQUE;

-- Actualiza la tabla referrals (o la crea si no existe)
CREATE TABLE IF NOT EXISTS referrals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_recomendante_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
    cliente_recomendado_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
    monto_bono DECIMAL(10, 2) DEFAULT 10.00,
    bono_otorgado BOOLEAN DEFAULT FALSE,
    cita_id UUID REFERENCES citas(id) ON DELETE SET NULL,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Asegura que tengamos una columna para comprobantes en egresos
ALTER TABLE egresos ADD COLUMN IF NOT EXISTS comprobante_url TEXT;

-- Asegura que tengamos una columna para comprobantes en transactions
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS comprobante_url TEXT;

-- Crea tabla para las comisiones pendientes
CREATE TABLE IF NOT EXISTS comisiones_pendientes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    barbero_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    cita_id UUID REFERENCES citas(id) ON DELETE SET NULL,
    servicio_id UUID REFERENCES servicios(id) ON DELETE SET NULL,
    monto_servicio DECIMAL(10, 2) NOT NULL,
    porcentaje_comision DECIMAL(5, 2) NOT NULL DEFAULT 30.00,
    monto_comision DECIMAL(10, 2) NOT NULL,
    estado TEXT CHECK (estado IN ('pendiente', 'pagado')) DEFAULT 'pendiente',
    fecha_generacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fecha_pago TIMESTAMP WITH TIME ZONE,
    metodo_pago TEXT,
    comprobante_url TEXT,
    notas TEXT
);

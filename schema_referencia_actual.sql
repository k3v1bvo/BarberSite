-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.profiles (
  id uuid NOT NULL,
  email text NOT NULL UNIQUE,
  full_name text,
  phone text,
  avatar_url text,
  role text DEFAULT 'cliente'::text CHECK (role = ANY (ARRAY['admin'::text, 'coordinador'::text, 'barbero'::text, 'cliente'::text])),
  is_active boolean DEFAULT true,
  comision_porcentaje numeric DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  ci character varying,
  qr_code_url text,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.servicios (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  nombre text NOT NULL,
  descripcion text,
  precio numeric NOT NULL,
  duracion_minutos integer DEFAULT 30,
  color text DEFAULT '#3B82F6'::text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  comision_activa boolean DEFAULT true,
  comision_tipo text DEFAULT 'porcentaje'::text CHECK (comision_tipo = ANY (ARRAY['ninguna'::text, 'porcentaje'::text, 'fija'::text])),
  comision_valor numeric DEFAULT 30,
  comision_acumulable boolean DEFAULT false,
  comision_notas text,
  barberos_excluidos jsonb DEFAULT '[]'::jsonb,
  imagen_url text,
  categoria text DEFAULT 'Cortes'::text,
  imagenes ARRAY DEFAULT '{}'::text[],
  CONSTRAINT servicios_pkey PRIMARY KEY (id)
);
CREATE TABLE public.clientes (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  nombre text NOT NULL,
  telefono text,
  email text,
  cumpleanos date,
  notas text,
  total_visitas integer DEFAULT 0,
  total_gastado numeric DEFAULT 0,
  ultima_visita date,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  ci character varying,
  nivel_fidelidad text DEFAULT 'BRONCE'::text,
  numero_cliente integer NOT NULL DEFAULT nextval('clientes_numero_cliente_seq'::regclass),
  referral_code text UNIQUE,
  referido_por uuid,
  codigo_tarjeta text UNIQUE,
  CONSTRAINT clientes_pkey PRIMARY KEY (id),
  CONSTRAINT clientes_referido_por_fkey FOREIGN KEY (referido_por) REFERENCES public.clientes(id)
);
CREATE TABLE public.citas (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  cliente_id uuid,
  barbero_id uuid,
  servicio_id uuid,
  estado text DEFAULT 'pendiente'::text CHECK (estado = ANY (ARRAY['pendiente_pago'::text, 'pendiente'::text, 'confirmado'::text, 'en_proceso'::text, 'completado'::text, 'cancelado'::text, 'no_presento'::text])),
  fecha_hora timestamp with time zone,
  duracion_real_minutos integer,
  precio numeric NOT NULL,
  comision_barbero numeric,
  descuento numeric DEFAULT 0,
  metodo_pago text CHECK (metodo_pago = ANY (ARRAY['efectivo'::text, 'tarjeta'::text, 'transferencia'::text, 'mixto'::text, NULL::text])),
  monto_efectivo numeric,
  monto_tarjeta numeric,
  monto_transferencia numeric,
  propinas numeric DEFAULT 0,
  productos_adicionales jsonb DEFAULT '[]'::jsonb,
  notas text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  comision_pagada boolean DEFAULT false,
  comision_pago_id uuid,
  anticipo_monto numeric DEFAULT 0,
  anticipo_verificado boolean DEFAULT false,
  anticipo_verificado_por uuid,
  anticipo_verificado_at timestamp with time zone,
  reprogramacion_estado text,
  fecha_hora_solicitada timestamp with time zone,
  CONSTRAINT citas_pkey PRIMARY KEY (id),
  CONSTRAINT citas_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id),
  CONSTRAINT citas_barbero_id_fkey FOREIGN KEY (barbero_id) REFERENCES public.profiles(id),
  CONSTRAINT citas_servicio_id_fkey FOREIGN KEY (servicio_id) REFERENCES public.servicios(id),
  CONSTRAINT citas_comision_pago_id_fkey FOREIGN KEY (comision_pago_id) REFERENCES public.comisiones_pagos(id),
  CONSTRAINT citas_anticipo_verificado_por_fkey FOREIGN KEY (anticipo_verificado_por) REFERENCES public.profiles(id)
);
CREATE TABLE public.productos (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  nombre text NOT NULL,
  sku text UNIQUE,
  descripcion text,
  stock_actual integer DEFAULT 0,
  stock_minimo integer DEFAULT 5,
  precio_costo numeric,
  precio_venta numeric NOT NULL,
  categoria text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  image_url text,
  precio_tienda numeric DEFAULT NULL::numeric,
  CONSTRAINT productos_pkey PRIMARY KEY (id)
);
CREATE TABLE public.inventario_movimientos (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  producto_id uuid NOT NULL,
  tipo text NOT NULL CHECK (tipo = ANY (ARRAY['entrada'::text, 'salida'::text, 'ajuste'::text, 'venta'::text])),
  cantidad integer NOT NULL,
  motivo text,
  referencia_id uuid,
  usuario_id uuid,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  CONSTRAINT inventario_movimientos_pkey PRIMARY KEY (id),
  CONSTRAINT inventario_movimientos_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id),
  CONSTRAINT inventario_movimientos_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.configuracion (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  clave text NOT NULL UNIQUE,
  valor text,
  descripcion text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  CONSTRAINT configuracion_pkey PRIMARY KEY (id)
);
CREATE TABLE public.pedidos (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  cliente_id uuid,
  estado text DEFAULT 'pendiente'::text,
  metodo_entrega text NOT NULL,
  total numeric NOT NULL,
  notas_cliente text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  CONSTRAINT pedidos_pkey PRIMARY KEY (id),
  CONSTRAINT pedidos_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id)
);
CREATE TABLE public.pedido_items (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  pedido_id uuid,
  producto_id uuid,
  cantidad integer NOT NULL DEFAULT 1,
  precio_unitario numeric NOT NULL,
  CONSTRAINT pedido_items_pkey PRIMARY KEY (id),
  CONSTRAINT pedido_items_pedido_id_fkey FOREIGN KEY (pedido_id) REFERENCES public.pedidos(id),
  CONSTRAINT pedido_items_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id)
);
CREATE TABLE public.portafolio (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  image_url text NOT NULL,
  categoria text NOT NULL,
  barbero_id uuid,
  descripcion text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  titulo text,
  CONSTRAINT portafolio_pkey PRIMARY KEY (id),
  CONSTRAINT portafolio_barbero_id_fkey FOREIGN KEY (barbero_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.asistencias (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  hora_entrada timestamp with time zone NOT NULL DEFAULT now(),
  hora_salida timestamp with time zone,
  horas_trabajadas numeric,
  notas text,
  created_at timestamp with time zone DEFAULT now(),
  estado text DEFAULT 'presente'::text,
  cierre_automatico boolean DEFAULT false,
  editado_admin boolean DEFAULT false,
  horas_extras numeric DEFAULT 0,
  CONSTRAINT asistencias_pkey PRIMARY KEY (id),
  CONSTRAINT asistencias_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.notificaciones (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  rol_destino text,
  titulo text NOT NULL,
  mensaje text NOT NULL,
  tipo text DEFAULT 'info'::text,
  leido boolean DEFAULT false,
  link text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  categoria text DEFAULT 'sistema'::text,
  metadata jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT notificaciones_pkey PRIMARY KEY (id),
  CONSTRAINT notificaciones_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.barbero_horario_semanal (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  barbero_id uuid NOT NULL,
  dia_semana smallint NOT NULL CHECK (dia_semana >= 0 AND dia_semana <= 6),
  hora_inicio time without time zone NOT NULL DEFAULT '09:00:00'::time without time zone,
  hora_fin time without time zone NOT NULL DEFAULT '20:00:00'::time without time zone,
  activo boolean NOT NULL DEFAULT true,
  tipo_horario text DEFAULT 'personalizado'::text CHECK (tipo_horario = ANY (ARRAY['manana'::text, 'tarde'::text, 'todo_dia'::text, 'especial'::text, 'medio_turno'::text, 'personalizado'::text])),
  plantilla_id uuid,
  CONSTRAINT barbero_horario_semanal_pkey PRIMARY KEY (id),
  CONSTRAINT barbero_horario_semanal_barbero_id_fkey FOREIGN KEY (barbero_id) REFERENCES public.profiles(id),
  CONSTRAINT barbero_horario_semanal_plantilla_id_fkey FOREIGN KEY (plantilla_id) REFERENCES public.plantillas_horario(id)
);
CREATE TABLE public.barbero_bloqueos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  barbero_id uuid NOT NULL,
  fecha_inicio timestamp with time zone NOT NULL,
  fecha_fin timestamp with time zone NOT NULL,
  tipo text NOT NULL DEFAULT 'bloqueo'::text CHECK (tipo = ANY (ARRAY['bloqueo'::text, 'vacacion'::text, 'dia_libre'::text])),
  motivo text,
  todo_el_dia boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT barbero_bloqueos_pkey PRIMARY KEY (id),
  CONSTRAINT barbero_bloqueos_barbero_id_fkey FOREIGN KEY (barbero_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.testimonios (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cliente_id uuid,
  estrellas integer NOT NULL CHECK (estrellas >= 1 AND estrellas <= 5),
  comentario text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT testimonios_pkey PRIMARY KEY (id),
  CONSTRAINT testimonios_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id)
);
CREATE TABLE public.notificacion_preferencias (
  user_id uuid NOT NULL,
  email_reservas boolean NOT NULL DEFAULT true,
  email_ventas boolean NOT NULL DEFAULT true,
  email_recordatorios boolean NOT NULL DEFAULT true,
  email_alertas boolean NOT NULL DEFAULT true,
  push_reservas boolean NOT NULL DEFAULT true,
  push_ventas boolean NOT NULL DEFAULT true,
  push_recordatorios boolean NOT NULL DEFAULT true,
  push_alertas boolean NOT NULL DEFAULT true,
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT notificacion_preferencias_pkey PRIMARY KEY (user_id),
  CONSTRAINT notificacion_preferencias_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.lealtad_metas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  descripcion text,
  visitas_requeridas integer NOT NULL CHECK (visitas_requeridas > 0),
  tipo_recompensa text NOT NULL CHECK (tipo_recompensa = ANY (ARRAY['porcentaje'::text, 'monto_fijo'::text, 'servicio_gratis'::text, 'producto_gratis'::text])),
  valor_recompensa numeric DEFAULT 0,
  servicio_id text,
  producto_id uuid,
  is_active boolean DEFAULT true,
  orden integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT lealtad_metas_pkey PRIMARY KEY (id),
  CONSTRAINT lealtad_metas_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id)
);
CREATE TABLE public.lealtad_canjes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL,
  meta_id uuid,
  cita_id uuid,
  descripcion text NOT NULL,
  notas text,
  otorgado_por uuid,
  canjeado_at timestamp with time zone DEFAULT now(),
  CONSTRAINT lealtad_canjes_pkey PRIMARY KEY (id),
  CONSTRAINT lealtad_canjes_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id),
  CONSTRAINT lealtad_canjes_meta_id_fkey FOREIGN KEY (meta_id) REFERENCES public.lealtad_metas(id),
  CONSTRAINT lealtad_canjes_cita_id_fkey FOREIGN KEY (cita_id) REFERENCES public.citas(id),
  CONSTRAINT lealtad_canjes_otorgado_por_fkey FOREIGN KEY (otorgado_por) REFERENCES public.profiles(id)
);
CREATE TABLE public.comisiones_pagos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  barbero_id uuid NOT NULL,
  periodo_tipo text NOT NULL CHECK (periodo_tipo = ANY (ARRAY['diario'::text, 'semanal'::text, 'personalizado'::text])),
  fecha_inicio date NOT NULL,
  fecha_fin date NOT NULL,
  monto_total numeric NOT NULL DEFAULT 0,
  metodo_pago text,
  admin_id uuid,
  notas text,
  pagado_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT comisiones_pagos_pkey PRIMARY KEY (id),
  CONSTRAINT comisiones_pagos_barbero_id_fkey FOREIGN KEY (barbero_id) REFERENCES public.profiles(id),
  CONSTRAINT comisiones_pagos_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.sistema_config (
  clave text NOT NULL,
  valor jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT sistema_config_pkey PRIMARY KEY (clave)
);
CREATE TABLE public.plantillas_horario (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  tipo text NOT NULL CHECK (tipo = ANY (ARRAY['manana'::text, 'tarde'::text, 'todo_dia'::text, 'especial'::text, 'medio_turno'::text, 'personalizado'::text])),
  hora_inicio time without time zone NOT NULL DEFAULT '09:00:00'::time without time zone,
  hora_fin time without time zone NOT NULL DEFAULT '20:00:00'::time without time zone,
  descripcion text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT plantillas_horario_pkey PRIMARY KEY (id)
);
CREATE TABLE public.comisiones_audit (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cita_id uuid,
  admin_id uuid,
  comision_anterior numeric,
  comision_nueva numeric,
  motivo text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT comisiones_audit_pkey PRIMARY KEY (id),
  CONSTRAINT comisiones_audit_cita_id_fkey FOREIGN KEY (cita_id) REFERENCES public.citas(id),
  CONSTRAINT comisiones_audit_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.equipo_home (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  especialidad text NOT NULL,
  descripcion text,
  imagen_url text NOT NULL,
  redes_sociales jsonb DEFAULT '{}'::jsonb,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  profile_id uuid,
  CONSTRAINT equipo_home_pkey PRIMARY KEY (id),
  CONSTRAINT equipo_home_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.plan_cuentas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  codigo character varying NOT NULL UNIQUE,
  detalle text NOT NULL,
  tipo character varying NOT NULL CHECK (tipo::text = ANY (ARRAY['ACTIVO'::character varying, 'PASIVO'::character varying, 'PATRIMONIO'::character varying, 'INGRESO'::character varying, 'EGRESO'::character varying]::text[])),
  nivel integer NOT NULL,
  es_sancion boolean DEFAULT false,
  creado_en timestamp with time zone DEFAULT now(),
  CONSTRAINT plan_cuentas_pkey PRIMARY KEY (id)
);
CREATE TABLE public.transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  libro character varying NOT NULL CHECK (libro::text = ANY (ARRAY['CAJA_CHICA'::text, 'VENTAS'::text, 'SERVICIOS'::text, 'BANCO'::text, 'USO_TIENDA'::text, 'EGRESOS'::text])),
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  ci character varying NOT NULL,
  nombre text NOT NULL,
  cuenta_codigo character varying NOT NULL,
  cuenta_detalle text NOT NULL,
  glosa text NOT NULL,
  costo numeric NOT NULL CHECK (costo >= 0::numeric),
  tipo_movimiento character varying NOT NULL,
  es_sancion boolean DEFAULT false,
  empleado_id uuid,
  cliente_id uuid,
  cita_id uuid,
  producto_id uuid,
  cantidad_producto numeric,
  metodo_pago character varying CHECK (metodo_pago IS NULL OR (metodo_pago::text = ANY (ARRAY['efectivo'::text, 'qr'::text, 'tarjeta'::text, 'mixto'::text, 'descuento_caja'::text]))),
  usuario_registro character varying NOT NULL,
  notas text,
  creado_en timestamp with time zone DEFAULT now(),
  comprobante_url text,
  subcategoria text,
  monto_efectivo numeric DEFAULT 0,
  monto_qr numeric DEFAULT 0,
  CONSTRAINT transactions_pkey PRIMARY KEY (id),
  CONSTRAINT transactions_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id),
  CONSTRAINT transactions_cita_id_fkey FOREIGN KEY (cita_id) REFERENCES public.citas(id),
  CONSTRAINT transactions_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id),
  CONSTRAINT transactions_cuenta_codigo_fkey FOREIGN KEY (cuenta_codigo) REFERENCES public.plan_cuentas(codigo),
  CONSTRAINT transactions_empleado_id_fkey FOREIGN KEY (empleado_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.daily_closures (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  fecha date NOT NULL UNIQUE,
  caja_chica numeric DEFAULT 0,
  ventas numeric DEFAULT 0,
  servicios numeric DEFAULT 0,
  banco numeric DEFAULT 0,
  total_registrado numeric DEFAULT (((caja_chica + ventas) + servicios) + banco),
  total_efectivo_fisico numeric DEFAULT 0,
  total_qr numeric DEFAULT 0,
  diferencia numeric DEFAULT ((COALESCE(total_efectivo_fisico, (0)::numeric) + COALESCE(total_qr, (0)::numeric)) - (((COALESCE(caja_chica, (0)::numeric) + COALESCE(ventas, (0)::numeric)) + COALESCE(servicios, (0)::numeric)) + COALESCE(banco, (0)::numeric))),
  observaciones text,
  usuario_cierre character varying NOT NULL,
  cerrado boolean DEFAULT false,
  creado_en timestamp with time zone DEFAULT now(),
  CONSTRAINT daily_closures_pkey PRIMARY KEY (id)
);
CREATE TABLE public.egresos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  concepto text NOT NULL,
  proveedor text,
  monto_bruto numeric NOT NULL,
  tiene_factura boolean DEFAULT false,
  iva numeric DEFAULT 0,
  it numeric DEFAULT 0,
  monto_neto numeric NOT NULL,
  numero_factura text,
  cuenta_codigo character varying,
  usuario_registro character varying NOT NULL,
  notas text,
  creado_en timestamp with time zone DEFAULT now(),
  comprobante_url text,
  metodo_pago text DEFAULT 'efectivo'::text,
  monto_efectivo numeric DEFAULT 0,
  monto_qr numeric DEFAULT 0,
  CONSTRAINT egresos_pkey PRIMARY KEY (id),
  CONSTRAINT egresos_cuenta_codigo_fkey FOREIGN KEY (cuenta_codigo) REFERENCES public.plan_cuentas(codigo)
);
CREATE TABLE public.referrals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cliente_recomendante_id uuid,
  cliente_recomendado_id uuid,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  bono_otorgado boolean DEFAULT false,
  monto_bono numeric DEFAULT 0,
  creado_en timestamp with time zone DEFAULT now(),
  bono_usado boolean DEFAULT false,
  CONSTRAINT referrals_pkey PRIMARY KEY (id),
  CONSTRAINT referrals_cliente_recomendante_id_fkey FOREIGN KEY (cliente_recomendante_id) REFERENCES public.clientes(id),
  CONSTRAINT referrals_cliente_recomendado_id_fkey FOREIGN KEY (cliente_recomendado_id) REFERENCES public.clientes(id)
);
CREATE TABLE public.audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tabla_afectada text NOT NULL,
  registro_id text,
  accion text NOT NULL CHECK (accion = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text])),
  usuario character varying,
  usuario_id uuid,
  fecha timestamp with time zone DEFAULT now(),
  datos_anteriores jsonb,
  datos_nuevos jsonb,
  CONSTRAINT audit_log_pkey PRIMARY KEY (id)
);
CREATE TABLE public.bonos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  barbero_id uuid NOT NULL,
  tipo text NOT NULL CHECK (tipo = ANY (ARRAY['puntualidad'::text, 'cantidad_servicios'::text, 'metas'::text, 'otro'::text])),
  descripcion text,
  monto numeric NOT NULL,
  mes integer NOT NULL CHECK (mes >= 1 AND mes <= 12),
  anio integer NOT NULL,
  pagado boolean DEFAULT false,
  pagado_at timestamp with time zone,
  creado_en timestamp with time zone DEFAULT now(),
  periodo_tipo text DEFAULT 'mensual'::text CHECK (periodo_tipo = ANY (ARRAY['diario'::text, 'semanal'::text, 'mensual'::text])),
  semana integer,
  fecha_inicio date,
  fecha_fin date,
  CONSTRAINT bonos_pkey PRIMARY KEY (id),
  CONSTRAINT bonos_barbero_id_fkey FOREIGN KEY (barbero_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.configuraciones (
  llave text NOT NULL,
  valor jsonb NOT NULL,
  descripcion text,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  CONSTRAINT configuraciones_pkey PRIMARY KEY (llave)
);
CREATE TABLE public.promociones (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  descripcion text,
  tipo text NOT NULL CHECK (tipo = ANY (ARRAY['2x1'::text, 'descuento_porcentaje'::text, 'descuento_fijo'::text, 'servicio_gratis'::text, 'cumpleanos'::text, 'nivel_lealtad'::text])),
  valor numeric DEFAULT 0,
  dias_semana ARRAY DEFAULT '{}'::integer[],
  servicio_id text,
  nivel_requerido text,
  activa boolean DEFAULT true,
  icono text DEFAULT '🎁'::text,
  color text DEFAULT 'amber'::text,
  fecha_inicio date,
  fecha_fin date,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  CONSTRAINT promociones_pkey PRIMARY KEY (id)
);
CREATE TABLE public.cumpleanos_verificados (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL,
  fecha_verificacion date NOT NULL DEFAULT CURRENT_DATE,
  foto_documento_url text,
  tipo_documento text DEFAULT 'carnet'::text CHECK (tipo_documento = ANY (ARRAY['carnet'::text, 'pasaporte'::text, 'licencia'::text, 'universitario'::text, 'otro'::text])),
  promo_id uuid,
  verificado_por uuid,
  notas text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  CONSTRAINT cumpleanos_verificados_pkey PRIMARY KEY (id),
  CONSTRAINT cumpleanos_verificados_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id),
  CONSTRAINT cumpleanos_verificados_promo_id_fkey FOREIGN KEY (promo_id) REFERENCES public.promociones(id),
  CONSTRAINT cumpleanos_verificados_verificado_por_fkey FOREIGN KEY (verificado_por) REFERENCES public.profiles(id)
);
CREATE TABLE public.reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cliente_id uuid,
  barbero_id uuid,
  cita_id uuid,
  estrellas integer NOT NULL CHECK (estrellas >= 1 AND estrellas <= 5),
  comentario text,
  is_public boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT reviews_pkey PRIMARY KEY (id),
  CONSTRAINT reviews_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.profiles(id),
  CONSTRAINT reviews_barbero_id_fkey FOREIGN KEY (barbero_id) REFERENCES public.profiles(id),
  CONSTRAINT reviews_cita_id_fkey FOREIGN KEY (cita_id) REFERENCES public.citas(id)
);
CREATE TABLE public.comisiones_pendientes (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  barbero_id uuid,
  cita_id uuid,
  servicio_id uuid,
  monto_servicio numeric NOT NULL,
  porcentaje_comision numeric NOT NULL DEFAULT 30.00,
  monto_comision numeric NOT NULL,
  estado text DEFAULT 'pendiente'::text CHECK (estado = ANY (ARRAY['pendiente'::text, 'pagado'::text])),
  fecha_generacion timestamp with time zone DEFAULT now(),
  fecha_pago timestamp with time zone,
  metodo_pago text,
  comprobante_url text,
  notas text,
  CONSTRAINT comisiones_pendientes_pkey PRIMARY KEY (id),
  CONSTRAINT comisiones_pendientes_barbero_id_fkey FOREIGN KEY (barbero_id) REFERENCES public.profiles(id),
  CONSTRAINT comisiones_pendientes_cita_id_fkey FOREIGN KEY (cita_id) REFERENCES public.citas(id),
  CONSTRAINT comisiones_pendientes_servicio_id_fkey FOREIGN KEY (servicio_id) REFERENCES public.servicios(id)
);
CREATE TABLE public.inducciones (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  titulo character varying NOT NULL,
  descripcion text,
  categoria character varying DEFAULT 'Servicio Técnico'::character varying,
  servicio_id uuid,
  youtube_url text NOT NULL,
  herramientas_requeridas ARRAY DEFAULT '{}'::text[],
  duracion_minutos integer DEFAULT 15,
  orden integer DEFAULT 0,
  is_published boolean DEFAULT true,
  creado_por uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT inducciones_pkey PRIMARY KEY (id),
  CONSTRAINT inducciones_servicio_id_fkey FOREIGN KEY (servicio_id) REFERENCES public.servicios(id),
  CONSTRAINT inducciones_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES public.profiles(id)
);
CREATE TABLE public.induccion_pasos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  induccion_id uuid,
  numero_paso integer NOT NULL,
  titulo_paso character varying NOT NULL,
  descripcion text,
  timestamp_segundos integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT induccion_pasos_pkey PRIMARY KEY (id),
  CONSTRAINT induccion_pasos_induccion_id_fkey FOREIGN KEY (induccion_id) REFERENCES public.inducciones(id)
);
CREATE TABLE public.induccion_asignaciones (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  induccion_id uuid,
  barbero_id uuid,
  asignado_por uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT induccion_asignaciones_pkey PRIMARY KEY (id),
  CONSTRAINT induccion_asignaciones_induccion_id_fkey FOREIGN KEY (induccion_id) REFERENCES public.inducciones(id),
  CONSTRAINT induccion_asignaciones_barbero_id_fkey FOREIGN KEY (barbero_id) REFERENCES public.profiles(id),
  CONSTRAINT induccion_asignaciones_asignado_por_fkey FOREIGN KEY (asignado_por) REFERENCES public.profiles(id)
);
CREATE TABLE public.induccion_progreso (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  induccion_id uuid,
  barbero_id uuid,
  estado character varying DEFAULT 'completado'::character varying,
  fecha_completado timestamp with time zone DEFAULT now(),
  CONSTRAINT induccion_progreso_pkey PRIMARY KEY (id),
  CONSTRAINT induccion_progreso_induccion_id_fkey FOREIGN KEY (induccion_id) REFERENCES public.inducciones(id),
  CONSTRAINT induccion_progreso_barbero_id_fkey FOREIGN KEY (barbero_id) REFERENCES public.profiles(id)
);
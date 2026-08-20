-- ==============================================================================
-- SOLUCIÓN AL ERROR 500: new row violates row-level security policy for table "audit_log"
-- ==============================================================================
-- Este script permite que los triggers o consultas de la aplicación (al registrar
-- transacciones, ajustes bancarios o egresos) puedan escribir en la tabla audit_log
-- sin ser bloqueados por la política de seguridad (RLS).
-- ==============================================================================

-- 1. Asegurarnos de que RLS esté habilitado
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- 2. Crear política para permitir a usuarios autenticados y al sistema insertar en audit_log
DROP POLICY IF EXISTS "Permitir insertar en audit_log a authenticated" ON public.audit_log;
CREATE POLICY "Permitir insertar en audit_log a authenticated"
ON public.audit_log
FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir insertar en audit_log a service_role" ON public.audit_log;
CREATE POLICY "Permitir insertar en audit_log a service_role"
ON public.audit_log
FOR INSERT
TO service_role
WITH CHECK (true);

-- 3. Permitir ver los registros de auditoría a usuarios autenticados (opcional, para reportes)
DROP POLICY IF EXISTS "Permitir lectura de audit_log a authenticated" ON public.audit_log;
CREATE POLICY "Permitir lectura de audit_log a authenticated"
ON public.audit_log
FOR SELECT
TO authenticated
USING (true);

-- 4. Si existe una función de trigger que escribe en audit_log, nos aseguramos de que se ejecute con privilegios de administrador (SECURITY DEFINER)
-- (Si tu función de trigger tiene otro nombre, esto asegura que las políticas anteriores lo cubran de todas formas)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'log_audit_event') THEN
    ALTER FUNCTION public.log_audit_event() SECURITY DEFINER;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'audit_trigger_fn') THEN
    ALTER FUNCTION public.audit_trigger_fn() SECURITY DEFINER;
  END IF;
END $$;

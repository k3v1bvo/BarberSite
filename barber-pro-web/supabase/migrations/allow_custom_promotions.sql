-- Eliminar la restricción CHECK de los tipos de promociones para permitir valores personalizados
DO $$
DECLARE
    constraint_name text;
BEGIN
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'promociones'::regclass AND contype = 'c';
    
    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE promociones DROP CONSTRAINT ' || constraint_name;
    END IF;
END $$;

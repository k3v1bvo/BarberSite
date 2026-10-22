-- Migración para soporte de Horarios Fraccionados (Turnos Partidos) en BarberSite
-- Permite registrar dos turnos en un mismo día (ej: 09:00 - 12:00 y 17:00 - 21:00)

ALTER TABLE IF EXISTS barbero_horario_semanal
ADD COLUMN IF NOT EXISTS hora_inicio_2 TIME NULL,
ADD COLUMN IF NOT EXISTS hora_fin_2 TIME NULL;

COMMENT ON COLUMN barbero_horario_semanal.hora_inicio_2 IS 'Hora de inicio del segundo turno (horario fraccionado)';
COMMENT ON COLUMN barbero_horario_semanal.hora_fin_2 IS 'Hora de salida del segundo turno (horario fraccionado)';

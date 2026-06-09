-- PharmaCol — Particionado mensual para tablas de alto volumen
-- Ejecutar cuando auditorias/historial superen ~1M filas o en despliegue producción
-- NOTA: Prisma no gestiona particiones nativamente; este script es complementario.

-- =============================================================================
-- AUDITORÍAS — Particionado RANGE por mes
-- =============================================================================

-- Paso 1: Renombrar tabla existente (ejecutar solo una vez en producción)
-- ALTER TABLE auditorias RENAME TO auditorias_legacy;

-- Paso 2: Crear tabla particionada
/*
CREATE TABLE auditorias (
  id          UUID NOT NULL DEFAULT gen_random_uuid(),
  usuario_id  UUID,
  accion      VARCHAR(100) NOT NULL,
  recurso     VARCHAR(100),
  recurso_id  UUID,
  ip_address  VARCHAR(45),
  user_agent  TEXT,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Paso 3: Crear particiones (ejemplo 2026)
CREATE TABLE auditorias_2026_01 PARTITION OF auditorias
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE auditorias_2026_02 PARTITION OF auditorias
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE auditorias_2026_03 PARTITION OF auditorias
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE auditorias_2026_04 PARTITION OF auditorias
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE auditorias_2026_05 PARTITION OF auditorias
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE auditorias_2026_06 PARTITION OF auditorias
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE auditorias_2026_07 PARTITION OF auditorias
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE auditorias_2026_08 PARTITION OF auditorias
  FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE auditorias_2026_09 PARTITION OF auditorias
  FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE auditorias_2026_10 PARTITION OF auditorias
  FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE auditorias_2026_11 PARTITION OF auditorias
  FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE TABLE auditorias_2026_12 PARTITION OF auditorias
  FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');

-- Índices en tabla particionada
CREATE INDEX idx_auditorias_part_usuario ON auditorias (usuario_id, created_at DESC);
CREATE INDEX idx_auditorias_part_accion ON auditorias (accion, created_at DESC);

-- Paso 4: Migrar datos legacy
-- INSERT INTO auditorias SELECT * FROM auditorias_legacy;
-- DROP TABLE auditorias_legacy;
*/

-- =============================================================================
-- FUNCIÓN: Crear partición automática para el mes siguiente
-- =============================================================================

CREATE OR REPLACE FUNCTION pharmacol_create_monthly_partition(
  p_table_name TEXT,
  p_year INT,
  p_month INT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_partition_name TEXT;
  v_start_date DATE;
  v_end_date DATE;
BEGIN
  v_partition_name := format('%s_%s_%s', p_table_name, p_year, lpad(p_month::TEXT, 2, '0'));
  v_start_date := make_date(p_year, p_month, 1);
  v_end_date := v_start_date + INTERVAL '1 month';

  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L)',
    v_partition_name,
    p_table_name,
    v_start_date,
    v_end_date
  );
END;
$$;

COMMENT ON FUNCTION pharmacol_create_monthly_partition IS
  'Crea partición mensual para tablas RANGE-partitioned (auditorias, historial_consultas)';

-- =============================================================================
-- HISTORIAL CONSULTAS — Misma estrategia (comentado, activar en producción)
-- =============================================================================

/*
CREATE TABLE historial_consultas (
  id            UUID NOT NULL DEFAULT gen_random_uuid(),
  usuario_id    UUID NOT NULL,
  tipo_busqueda VARCHAR(50) NOT NULL,
  query         VARCHAR(500) NOT NULL,
  resultado_id  UUID,
  entidad_tipo  VARCHAR(50),
  metadata      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);
*/

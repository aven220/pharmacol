-- PharmaCol — Extensiones PostgreSQL requeridas
-- Ejecutar antes o durante la migración inicial (Prisma las declara en schema.prisma)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- Función de normalización para búsqueda (usada en ETL y triggers)
CREATE OR REPLACE FUNCTION pharmacol_normalize_text(input TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF input IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN lower(
    trim(
      regexp_replace(
        unaccent(input),
        '\s+', ' ', 'g'
      )
    )
  );
END;
$$;

COMMENT ON FUNCTION pharmacol_normalize_text IS
  'Normaliza texto para búsqueda: lowercase, sin acentos, espacios colapsados';

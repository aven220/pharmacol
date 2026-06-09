-- PharmaCol — Índices avanzados post-migración Prisma
-- Ejecutar después de la migración inicial: psql $DATABASE_URL -f database/scripts/002_indexes.sql

-- Búsqueda fuzzy por nombre comercial (trigram GIN)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_medicamentos_nombre_trgm
  ON medicamentos USING GIN (nombre_normalizado gin_trgm_ops);

-- Búsqueda fuzzy por principio activo
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_principios_activos_nombre_trgm
  ON principios_activos USING GIN (nombre_normalizado gin_trgm_ops);

-- Búsqueda fuzzy dispositivos médicos
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dispositivos_nombre_trgm
  ON dispositivos_medicos USING GIN (nombre gin_trgm_ops);

-- Full-text search compuesto medicamentos
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_medicamentos_fts
  ON medicamentos USING GIN (
    to_tsvector('spanish', coalesce(nombre_comercial, '') || ' ' || coalesce(concentracion, ''))
  );

-- Índice parcial: solo medicamentos vigentes (consultas frecuentes)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_medicamentos_vigentes
  ON medicamentos (nombre_normalizado)
  WHERE estado_registro = 'VIGENTE';

-- Índice parcial dispositivos vigentes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dispositivos_vigentes
  ON dispositivos_medicos (nombre)
  WHERE estado_registro = 'VIGENTE';

-- BRIN para auditorías (rangos temporales)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_auditorias_created_brin
  ON auditorias USING BRIN (created_at);

-- BRIN para historial de consultas
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_historial_created_brin
  ON historial_consultas USING BRIN (created_at);

-- Staging sync: búsqueda por hash para deduplicación
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sync_staging_hash
  ON sync_staging (fuente_codigo, hash_contenido);

COMMENT ON INDEX idx_medicamentos_nombre_trgm IS 'Búsqueda fuzzy ILIKE/similarity en nombres comerciales';

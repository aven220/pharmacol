-- PharmaCol — Vistas materializadas para consultas frecuentes
-- Refrescar con: REFRESH MATERIALIZED VIEW CONCURRENTLY mv_medicamentos_busqueda;

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_medicamentos_busqueda AS
SELECT
  m.id,
  m.nombre_comercial,
  m.nombre_normalizado,
  m.concentracion,
  m.forma_farmaceutica,
  m.estado_registro,
  m.fecha_vencimiento,
  ri.numero_registro,
  ri.expediente,
  l.razon_social AS laboratorio,
  t.razon_social AS titular,
  m.atc_codigo,
  array_agg(DISTINCT pa.nombre_oficial) FILTER (WHERE pa.id IS NOT NULL) AS principios_activos,
  array_agg(DISTINCT cc.codigo_completo) FILTER (WHERE cc.id IS NOT NULL) AS codigos_cum
FROM medicamentos m
JOIN registros_invima ri ON ri.id = m.registro_invima_id
LEFT JOIN laboratorios l ON l.id = m.laboratorio_id
LEFT JOIN laboratorios t ON t.id = m.titular_id
LEFT JOIN medicamento_principios_activos mpa ON mpa.medicamento_id = m.id
LEFT JOIN principios_activos pa ON pa.id = mpa.principio_activo_id
LEFT JOIN codigos_cum cc ON cc.medicamento_id = m.id
WHERE m.estado_registro = 'VIGENTE'
GROUP BY
  m.id, m.nombre_comercial, m.nombre_normalizado, m.concentracion,
  m.forma_farmaceutica, m.estado_registro, m.fecha_vencimiento,
  ri.numero_registro, ri.expediente, l.razon_social, t.razon_social, m.atc_codigo;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_medicamentos_busqueda_id
  ON mv_medicamentos_busqueda (id);

CREATE INDEX IF NOT EXISTS idx_mv_medicamentos_busqueda_nombre_trgm
  ON mv_medicamentos_busqueda USING GIN (nombre_normalizado gin_trgm_ops);

COMMENT ON MATERIALIZED VIEW mv_medicamentos_busqueda IS
  'Vista materializada para búsqueda rápida de medicamentos vigentes. Refrescar post-sync INVIMA.';

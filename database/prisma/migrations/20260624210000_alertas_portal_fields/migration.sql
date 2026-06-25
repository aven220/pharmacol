-- Campos para alertas del portal app.invima.gov.co

ALTER TABLE "alertas_sanitarias" ADD COLUMN IF NOT EXISTS "categoria_producto" VARCHAR(80);
ALTER TABLE "alertas_sanitarias" ADD COLUMN IF NOT EXISTS "canal_origen" VARCHAR(20) NOT NULL DEFAULT 'DATOS_GOV';

CREATE INDEX IF NOT EXISTS "alertas_sanitarias_canal_origen_idx" ON "alertas_sanitarias"("canal_origen");
CREATE INDEX IF NOT EXISTS "alertas_sanitarias_categoria_producto_idx" ON "alertas_sanitarias"("categoria_producto");

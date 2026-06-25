-- Alertas sanitarias INVIMA (datos.gov.co jj2d-tee6)

CREATE TABLE "alertas_sanitarias" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "numero_alerta" VARCHAR(30) NOT NULL,
    "fecha_alerta" DATE NOT NULL,
    "titulo" VARCHAR(500) NOT NULL,
    "titulo_normalizado" VARCHAR(500) NOT NULL,
    "descripcion" TEXT NOT NULL,
    "fuente_alerta" VARCHAR(100),
    "tipo_documento" VARCHAR(100),
    "documento_url" TEXT,
    "concepto_sempb" TEXT,
    "acta" VARCHAR(100),
    "hash_contenido" VARCHAR(64) NOT NULL,
    "fuente" "DataOrigin" NOT NULL DEFAULT 'INVIMA',
    "sync_version" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alertas_sanitarias_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "alertas_sanitarias_numero_alerta_key" ON "alertas_sanitarias"("numero_alerta");
CREATE INDEX "alertas_sanitarias_fecha_alerta_idx" ON "alertas_sanitarias"("fecha_alerta" DESC);
CREATE INDEX "alertas_sanitarias_titulo_normalizado_idx" ON "alertas_sanitarias"("titulo_normalizado");
CREATE INDEX "alertas_sanitarias_hash_contenido_idx" ON "alertas_sanitarias"("hash_contenido");

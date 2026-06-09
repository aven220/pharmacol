-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVO', 'INACTIVO', 'BLOQUEADO', 'PENDIENTE_VERIFICACION');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('CC', 'CE', 'NIT', 'PASAPORTE');

-- CreateEnum
CREATE TYPE "LaboratoryType" AS ENUM ('FABRICANTE', 'IMPORTADOR', 'TITULAR', 'DISTRIBUIDOR');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('VIGENTE', 'VENCIDO', 'CANCELADO', 'SUSPENDIDO', 'TRAMITE', 'OTRO', 'NO_EN_FUENTE');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('MEDICAMENTO', 'DISPOSITIVO', 'BIOLOGICO', 'COSMETICO');

-- CreateEnum
CREATE TYPE "DataSourceFormat" AS ENUM ('CSV', 'JSON', 'API_SOCRATA', 'PDF');

-- CreateEnum
CREATE TYPE "SyncJobType" AS ENUM ('PROGRAMADA', 'MANUAL', 'REINTENTO');

-- CreateEnum
CREATE TYPE "SyncJobStatus" AS ENUM ('PENDIENTE', 'EN_PROCESO', 'COMPLETADA', 'FALLIDA', 'PARCIAL');

-- CreateEnum
CREATE TYPE "SyncRecordAction" AS ENUM ('INSERT', 'UPDATE', 'SKIP', 'ERROR');

-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('MEDICAMENTO', 'DISPOSITIVO');

-- CreateEnum
CREATE TYPE "SearchType" AS ENUM ('NOMBRE', 'PRINCIPIO_ACTIVO', 'REGISTRO', 'CUM', 'IUM', 'ATC', 'BARCODE', 'QR', 'OCR', 'IA');

-- CreateEnum
CREATE TYPE "ImageOrigin" AS ENUM ('CAMARA', 'GALERIA');

-- CreateEnum
CREATE TYPE "OcrEngine" AS ENUM ('ML_KIT', 'MANUAL');

-- CreateEnum
CREATE TYPE "IaAnalysisType" AS ENUM ('IDENTIFICACION', 'CORRECCION_OCR', 'COMPARACION');

-- CreateEnum
CREATE TYPE "FraudRiskLevel" AS ENUM ('BAJO', 'MEDIO', 'ALTO', 'CRITICO');

-- CreateEnum
CREATE TYPE "DataOrigin" AS ENUM ('INVIMA', 'MANUAL', 'IA');

-- CreateEnum
CREATE TYPE "DeviceRiskClass" AS ENUM ('I', 'IIa', 'IIb', 'III');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255),
    "nombre" VARCHAR(150) NOT NULL,
    "documento_tipo" "DocumentType",
    "documento_numero" VARCHAR(50),
    "telefono" VARCHAR(20),
    "status" "UserStatus" NOT NULL DEFAULT 'PENDIENTE_VERIFICACION',
    "intentos_fallidos" SMALLINT NOT NULL DEFAULT 0,
    "bloqueado_hasta" TIMESTAMPTZ,
    "email_verificado_at" TIMESTAMPTZ,
    "ultimo_login_at" TIMESTAMPTZ,
    "biometric_enabled" BOOLEAN NOT NULL DEFAULT false,
    "device_fingerprint" VARCHAR(255),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "codigo" VARCHAR(50) NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "descripcion" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permisos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "codigo" VARCHAR(100) NOT NULL,
    "recurso" VARCHAR(50) NOT NULL,
    "accion" VARCHAR(50) NOT NULL,
    "descripcion" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permisos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario_roles" (
    "usuario_id" UUID NOT NULL,
    "rol_id" UUID NOT NULL,
    "assigned_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_roles_pkey" PRIMARY KEY ("usuario_id","rol_id")
);

-- CreateTable
CREATE TABLE "rol_permisos" (
    "rol_id" UUID NOT NULL,
    "permiso_id" UUID NOT NULL,

    CONSTRAINT "rol_permisos_pkey" PRIMARY KEY ("rol_id","permiso_id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id" UUID NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "familia_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revocado_at" TIMESTAMPTZ,
    "device_fingerprint" VARCHAR(255),
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sesiones" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id" UUID NOT NULL,
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sesiones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id" UUID NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "used_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "laboratorios" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nit" VARCHAR(20),
    "razon_social" VARCHAR(300) NOT NULL,
    "nombre_comercial" VARCHAR(300),
    "pais" VARCHAR(3) NOT NULL DEFAULT 'COL',
    "tipo" "LaboratoryType" NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "laboratorios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "principios_activos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre_normalizado" VARCHAR(300) NOT NULL,
    "nombre_oficial" VARCHAR(300) NOT NULL,
    "dci" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "principios_activos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registros_invima" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "numero_registro" VARCHAR(50) NOT NULL,
    "expediente" VARCHAR(50),
    "fecha_expedicion" DATE,
    "fecha_vencimiento" DATE,
    "estado" VARCHAR(50),
    "modalidad" VARCHAR(100),
    "tipo_producto" "ProductType" NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "registros_invima_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "codigos_atc" (
    "codigo" VARCHAR(10) NOT NULL,
    "nivel" SMALLINT NOT NULL,
    "descripcion" VARCHAR(500) NOT NULL,
    "padre_codigo" VARCHAR(10),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "codigos_atc_pkey" PRIMARY KEY ("codigo")
);

-- CreateTable
CREATE TABLE "medicamentos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre_comercial" VARCHAR(300) NOT NULL,
    "nombre_normalizado" VARCHAR(300) NOT NULL,
    "concentracion" VARCHAR(200),
    "forma_farmaceutica" VARCHAR(150),
    "via_administracion" VARCHAR(100),
    "laboratorio_id" UUID,
    "titular_id" UUID,
    "registro_invima_id" UUID NOT NULL,
    "atc_codigo" VARCHAR(10),
    "estado_registro" "RegistrationStatus" NOT NULL DEFAULT 'VIGENTE',
    "fecha_vencimiento" DATE,
    "indicaciones" TEXT,
    "contraindicaciones" TEXT,
    "observaciones_regulatorias" TEXT,
    "hash_contenido" VARCHAR(64),
    "fuente" "DataOrigin" NOT NULL DEFAULT 'INVIMA',
    "sync_version" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "medicamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medicamento_principios_activos" (
    "medicamento_id" UUID NOT NULL,
    "principio_activo_id" UUID NOT NULL,
    "concentracion" VARCHAR(200),
    "es_principal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "medicamento_principios_activos_pkey" PRIMARY KEY ("medicamento_id","principio_activo_id")
);

-- CreateTable
CREATE TABLE "presentaciones" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "medicamento_id" UUID NOT NULL,
    "descripcion" VARCHAR(500) NOT NULL,
    "codigo_barras" VARCHAR(50),
    "codigo_cum" VARCHAR(50),
    "cantidad" DECIMAL(12,4),
    "unidad" VARCHAR(50),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "presentaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "codigos_cum" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "expediente_cum" VARCHAR(50) NOT NULL,
    "consecutivo" VARCHAR(20) NOT NULL,
    "codigo_completo" VARCHAR(60) NOT NULL,
    "estado_cum" VARCHAR(50),
    "medicamento_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "codigos_cum_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "codigos_ium" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "codigo_ium" VARCHAR(100) NOT NULL,
    "medicamento_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "codigos_ium_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispositivos_medicos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre" VARCHAR(500) NOT NULL,
    "descripcion" TEXT,
    "registro_invima_id" UUID NOT NULL,
    "fabricante_id" UUID,
    "importador_id" UUID,
    "clase_riesgo" "DeviceRiskClass",
    "estado_registro" "RegistrationStatus" NOT NULL DEFAULT 'VIGENTE',
    "categoria" VARCHAR(200),
    "codigo_udi_di" VARCHAR(100),
    "hash_contenido" VARCHAR(64),
    "fuente" "DataOrigin" NOT NULL DEFAULT 'INVIMA',
    "sync_version" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "dispositivos_medicos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispositivo_atributos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "dispositivo_id" UUID NOT NULL,
    "clave" VARCHAR(100) NOT NULL,
    "valor" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispositivo_atributos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fuentes_datos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "codigo" VARCHAR(50) NOT NULL,
    "nombre" VARCHAR(200) NOT NULL,
    "formato" "DataSourceFormat" NOT NULL,
    "url_base" TEXT,
    "dataset_id" VARCHAR(20),
    "frecuencia_cron" VARCHAR(50) NOT NULL DEFAULT '0 3 * * *',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "fuentes_datos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sincronizaciones" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "fuente_id" UUID NOT NULL,
    "tipo" "SyncJobType" NOT NULL,
    "status" "SyncJobStatus" NOT NULL DEFAULT 'PENDIENTE',
    "inicio_at" TIMESTAMPTZ,
    "fin_at" TIMESTAMPTZ,
    "registros_leidos" INTEGER NOT NULL DEFAULT 0,
    "registros_insertados" INTEGER NOT NULL DEFAULT 0,
    "registros_actualizados" INTEGER NOT NULL DEFAULT 0,
    "registros_omitidos" INTEGER NOT NULL DEFAULT 0,
    "registros_error" INTEGER NOT NULL DEFAULT 0,
    "checksum_archivo" VARCHAR(64),
    "ejecutado_por_id" UUID,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sincronizaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_registros" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sync_id" UUID NOT NULL,
    "entidad_tipo" VARCHAR(50) NOT NULL,
    "entidad_id" UUID,
    "clave_natural" VARCHAR(100) NOT NULL,
    "accion" "SyncRecordAction" NOT NULL,
    "hash_anterior" VARCHAR(64),
    "hash_nuevo" VARCHAR(64),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_registros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registro_historial" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sync_registro_id" UUID NOT NULL,
    "entidad_tipo" VARCHAR(50) NOT NULL,
    "entidad_id" UUID NOT NULL,
    "diff_before" JSONB,
    "diff_after" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registro_historial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_errores" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sync_id" UUID NOT NULL,
    "fila_numero" INTEGER,
    "campo" VARCHAR(100),
    "valor" TEXT,
    "error_mensaje" TEXT NOT NULL,
    "reintentable" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_errores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_staging" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "fuente_codigo" VARCHAR(50) NOT NULL,
    "clave_natural" VARCHAR(100) NOT NULL,
    "payload" JSONB NOT NULL,
    "hash_contenido" VARCHAR(64) NOT NULL,
    "procesado" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "sync_staging_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imagenes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id" UUID NOT NULL,
    "storage_key" VARCHAR(500) NOT NULL,
    "mime_type" VARCHAR(50) NOT NULL,
    "tamano_bytes" INTEGER NOT NULL,
    "hash_sha256" VARCHAR(64) NOT NULL,
    "origen" "ImageOrigin" NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "imagenes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ocr_resultados" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "imagen_id" UUID NOT NULL,
    "texto_crudo" TEXT,
    "datos_estructurados" JSONB,
    "confianza_promedio" DECIMAL(5,4),
    "motor" "OcrEngine" NOT NULL DEFAULT 'ML_KIT',
    "procesado_en_dispositivo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ocr_resultados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ia_resultados" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ocr_resultado_id" UUID NOT NULL,
    "modelo" VARCHAR(50) NOT NULL,
    "tipo_analisis" "IaAnalysisType" NOT NULL,
    "coincidencias" JSONB,
    "confianza_global" DECIMAL(5,4),
    "inconsistencias" JSONB,
    "tokens_usados" INTEGER,
    "latencia_ms" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ia_resultados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alertas_falsificacion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ia_resultado_id" UUID NOT NULL,
    "nivel_riesgo" "FraudRiskLevel" NOT NULL,
    "reglas_disparadas" JSONB NOT NULL,
    "mensaje_usuario" TEXT NOT NULL,
    "requiere_reporte" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alertas_falsificacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favoritos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id" UUID NOT NULL,
    "entidad_tipo" "EntityType" NOT NULL,
    "entidad_id" UUID NOT NULL,
    "notas" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favoritos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historial_consultas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id" UUID NOT NULL,
    "tipo_busqueda" "SearchType" NOT NULL,
    "query" VARCHAR(500) NOT NULL,
    "resultado_id" UUID,
    "entidad_tipo" "EntityType",
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historial_consultas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditorias" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id" UUID,
    "accion" VARCHAR(100) NOT NULL,
    "recurso" VARCHAR(100),
    "recurso_id" UUID,
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditorias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE INDEX "usuarios_status_idx" ON "usuarios"("status");

-- CreateIndex
CREATE INDEX "usuarios_documento_numero_idx" ON "usuarios"("documento_numero");

-- CreateIndex
CREATE UNIQUE INDEX "roles_codigo_key" ON "roles"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "permisos_codigo_key" ON "permisos"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "permisos_recurso_accion_key" ON "permisos"("recurso", "accion");

-- CreateIndex
CREATE INDEX "refresh_tokens_usuario_id_idx" ON "refresh_tokens"("usuario_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_familia_id_idx" ON "refresh_tokens"("familia_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "sesiones_usuario_id_created_at_idx" ON "sesiones"("usuario_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "password_reset_tokens_token_hash_idx" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_usuario_id_idx" ON "password_reset_tokens"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "laboratorios_nit_key" ON "laboratorios"("nit");

-- CreateIndex
CREATE INDEX "laboratorios_razon_social_idx" ON "laboratorios"("razon_social");

-- CreateIndex
CREATE UNIQUE INDEX "principios_activos_nombre_normalizado_key" ON "principios_activos"("nombre_normalizado");

-- CreateIndex
CREATE INDEX "principios_activos_nombre_oficial_idx" ON "principios_activos"("nombre_oficial");

-- CreateIndex
CREATE UNIQUE INDEX "registros_invima_numero_registro_key" ON "registros_invima"("numero_registro");

-- CreateIndex
CREATE INDEX "registros_invima_expediente_idx" ON "registros_invima"("expediente");

-- CreateIndex
CREATE INDEX "registros_invima_estado_idx" ON "registros_invima"("estado");

-- CreateIndex
CREATE INDEX "codigos_atc_nivel_idx" ON "codigos_atc"("nivel");

-- CreateIndex
CREATE INDEX "codigos_atc_padre_codigo_idx" ON "codigos_atc"("padre_codigo");

-- CreateIndex
CREATE UNIQUE INDEX "medicamentos_registro_invima_id_key" ON "medicamentos"("registro_invima_id");

-- CreateIndex
CREATE INDEX "medicamentos_nombre_normalizado_idx" ON "medicamentos"("nombre_normalizado");

-- CreateIndex
CREATE INDEX "medicamentos_estado_registro_idx" ON "medicamentos"("estado_registro");

-- CreateIndex
CREATE INDEX "medicamentos_laboratorio_id_idx" ON "medicamentos"("laboratorio_id");

-- CreateIndex
CREATE INDEX "medicamentos_titular_id_idx" ON "medicamentos"("titular_id");

-- CreateIndex
CREATE INDEX "medicamentos_hash_contenido_idx" ON "medicamentos"("hash_contenido");

-- CreateIndex
CREATE INDEX "presentaciones_medicamento_id_idx" ON "presentaciones"("medicamento_id");

-- CreateIndex
CREATE INDEX "presentaciones_codigo_barras_idx" ON "presentaciones"("codigo_barras");

-- CreateIndex
CREATE INDEX "presentaciones_codigo_cum_idx" ON "presentaciones"("codigo_cum");

-- CreateIndex
CREATE UNIQUE INDEX "codigos_cum_codigo_completo_key" ON "codigos_cum"("codigo_completo");

-- CreateIndex
CREATE INDEX "codigos_cum_medicamento_id_idx" ON "codigos_cum"("medicamento_id");

-- CreateIndex
CREATE INDEX "codigos_cum_expediente_cum_idx" ON "codigos_cum"("expediente_cum");

-- CreateIndex
CREATE UNIQUE INDEX "codigos_ium_codigo_ium_key" ON "codigos_ium"("codigo_ium");

-- CreateIndex
CREATE INDEX "codigos_ium_medicamento_id_idx" ON "codigos_ium"("medicamento_id");

-- CreateIndex
CREATE UNIQUE INDEX "dispositivos_medicos_registro_invima_id_key" ON "dispositivos_medicos"("registro_invima_id");

-- CreateIndex
CREATE INDEX "dispositivos_medicos_nombre_idx" ON "dispositivos_medicos"("nombre");

-- CreateIndex
CREATE INDEX "dispositivos_medicos_estado_registro_idx" ON "dispositivos_medicos"("estado_registro");

-- CreateIndex
CREATE INDEX "dispositivos_medicos_hash_contenido_idx" ON "dispositivos_medicos"("hash_contenido");

-- CreateIndex
CREATE UNIQUE INDEX "dispositivo_atributos_dispositivo_id_clave_key" ON "dispositivo_atributos"("dispositivo_id", "clave");

-- CreateIndex
CREATE UNIQUE INDEX "fuentes_datos_codigo_key" ON "fuentes_datos"("codigo");

-- CreateIndex
CREATE INDEX "sincronizaciones_fuente_id_created_at_idx" ON "sincronizaciones"("fuente_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "sincronizaciones_status_idx" ON "sincronizaciones"("status");

-- CreateIndex
CREATE INDEX "sync_registros_sync_id_idx" ON "sync_registros"("sync_id");

-- CreateIndex
CREATE INDEX "sync_registros_clave_natural_idx" ON "sync_registros"("clave_natural");

-- CreateIndex
CREATE INDEX "sync_registros_entidad_tipo_entidad_id_idx" ON "sync_registros"("entidad_tipo", "entidad_id");

-- CreateIndex
CREATE UNIQUE INDEX "registro_historial_sync_registro_id_key" ON "registro_historial"("sync_registro_id");

-- CreateIndex
CREATE INDEX "registro_historial_entidad_tipo_entidad_id_idx" ON "registro_historial"("entidad_tipo", "entidad_id");

-- CreateIndex
CREATE INDEX "registro_historial_created_at_idx" ON "registro_historial"("created_at" DESC);

-- CreateIndex
CREATE INDEX "sync_errores_sync_id_idx" ON "sync_errores"("sync_id");

-- CreateIndex
CREATE INDEX "sync_staging_fuente_codigo_procesado_idx" ON "sync_staging"("fuente_codigo", "procesado");

-- CreateIndex
CREATE UNIQUE INDEX "sync_staging_fuente_codigo_clave_natural_key" ON "sync_staging"("fuente_codigo", "clave_natural");

-- CreateIndex
CREATE INDEX "imagenes_usuario_id_idx" ON "imagenes"("usuario_id");

-- CreateIndex
CREATE INDEX "imagenes_hash_sha256_idx" ON "imagenes"("hash_sha256");

-- CreateIndex
CREATE UNIQUE INDEX "ocr_resultados_imagen_id_key" ON "ocr_resultados"("imagen_id");

-- CreateIndex
CREATE UNIQUE INDEX "ia_resultados_ocr_resultado_id_key" ON "ia_resultados"("ocr_resultado_id");

-- CreateIndex
CREATE UNIQUE INDEX "alertas_falsificacion_ia_resultado_id_key" ON "alertas_falsificacion"("ia_resultado_id");

-- CreateIndex
CREATE INDEX "alertas_falsificacion_nivel_riesgo_idx" ON "alertas_falsificacion"("nivel_riesgo");

-- CreateIndex
CREATE INDEX "favoritos_usuario_id_idx" ON "favoritos"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "favoritos_usuario_id_entidad_tipo_entidad_id_key" ON "favoritos"("usuario_id", "entidad_tipo", "entidad_id");

-- CreateIndex
CREATE INDEX "historial_consultas_usuario_id_created_at_idx" ON "historial_consultas"("usuario_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "historial_consultas_tipo_busqueda_idx" ON "historial_consultas"("tipo_busqueda");

-- CreateIndex
CREATE INDEX "auditorias_usuario_id_idx" ON "auditorias"("usuario_id");

-- CreateIndex
CREATE INDEX "auditorias_accion_idx" ON "auditorias"("accion");

-- CreateIndex
CREATE INDEX "auditorias_recurso_recurso_id_idx" ON "auditorias"("recurso", "recurso_id");

-- CreateIndex
CREATE INDEX "auditorias_created_at_idx" ON "auditorias"("created_at" DESC);

-- AddForeignKey
ALTER TABLE "usuario_roles" ADD CONSTRAINT "usuario_roles_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_roles" ADD CONSTRAINT "usuario_roles_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rol_permisos" ADD CONSTRAINT "rol_permisos_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rol_permisos" ADD CONSTRAINT "rol_permisos_permiso_id_fkey" FOREIGN KEY ("permiso_id") REFERENCES "permisos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesiones" ADD CONSTRAINT "sesiones_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "codigos_atc" ADD CONSTRAINT "codigos_atc_padre_codigo_fkey" FOREIGN KEY ("padre_codigo") REFERENCES "codigos_atc"("codigo") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicamentos" ADD CONSTRAINT "medicamentos_laboratorio_id_fkey" FOREIGN KEY ("laboratorio_id") REFERENCES "laboratorios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicamentos" ADD CONSTRAINT "medicamentos_titular_id_fkey" FOREIGN KEY ("titular_id") REFERENCES "laboratorios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicamentos" ADD CONSTRAINT "medicamentos_registro_invima_id_fkey" FOREIGN KEY ("registro_invima_id") REFERENCES "registros_invima"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicamentos" ADD CONSTRAINT "medicamentos_atc_codigo_fkey" FOREIGN KEY ("atc_codigo") REFERENCES "codigos_atc"("codigo") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicamento_principios_activos" ADD CONSTRAINT "medicamento_principios_activos_medicamento_id_fkey" FOREIGN KEY ("medicamento_id") REFERENCES "medicamentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicamento_principios_activos" ADD CONSTRAINT "medicamento_principios_activos_principio_activo_id_fkey" FOREIGN KEY ("principio_activo_id") REFERENCES "principios_activos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presentaciones" ADD CONSTRAINT "presentaciones_medicamento_id_fkey" FOREIGN KEY ("medicamento_id") REFERENCES "medicamentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "codigos_cum" ADD CONSTRAINT "codigos_cum_medicamento_id_fkey" FOREIGN KEY ("medicamento_id") REFERENCES "medicamentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "codigos_ium" ADD CONSTRAINT "codigos_ium_medicamento_id_fkey" FOREIGN KEY ("medicamento_id") REFERENCES "medicamentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispositivos_medicos" ADD CONSTRAINT "dispositivos_medicos_registro_invima_id_fkey" FOREIGN KEY ("registro_invima_id") REFERENCES "registros_invima"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispositivos_medicos" ADD CONSTRAINT "dispositivos_medicos_fabricante_id_fkey" FOREIGN KEY ("fabricante_id") REFERENCES "laboratorios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispositivos_medicos" ADD CONSTRAINT "dispositivos_medicos_importador_id_fkey" FOREIGN KEY ("importador_id") REFERENCES "laboratorios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispositivo_atributos" ADD CONSTRAINT "dispositivo_atributos_dispositivo_id_fkey" FOREIGN KEY ("dispositivo_id") REFERENCES "dispositivos_medicos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sincronizaciones" ADD CONSTRAINT "sincronizaciones_fuente_id_fkey" FOREIGN KEY ("fuente_id") REFERENCES "fuentes_datos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sincronizaciones" ADD CONSTRAINT "sincronizaciones_ejecutado_por_id_fkey" FOREIGN KEY ("ejecutado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_registros" ADD CONSTRAINT "sync_registros_sync_id_fkey" FOREIGN KEY ("sync_id") REFERENCES "sincronizaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registro_historial" ADD CONSTRAINT "registro_historial_sync_registro_id_fkey" FOREIGN KEY ("sync_registro_id") REFERENCES "sync_registros"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_errores" ADD CONSTRAINT "sync_errores_sync_id_fkey" FOREIGN KEY ("sync_id") REFERENCES "sincronizaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imagenes" ADD CONSTRAINT "imagenes_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocr_resultados" ADD CONSTRAINT "ocr_resultados_imagen_id_fkey" FOREIGN KEY ("imagen_id") REFERENCES "imagenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ia_resultados" ADD CONSTRAINT "ia_resultados_ocr_resultado_id_fkey" FOREIGN KEY ("ocr_resultado_id") REFERENCES "ocr_resultados"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alertas_falsificacion" ADD CONSTRAINT "alertas_falsificacion_ia_resultado_id_fkey" FOREIGN KEY ("ia_resultado_id") REFERENCES "ia_resultados"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favoritos" ADD CONSTRAINT "favoritos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_consultas" ADD CONSTRAINT "historial_consultas_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditorias" ADD CONSTRAINT "auditorias_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Extensiones adicionales y función de normalización
CREATE EXTENSION IF NOT EXISTS "unaccent";

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

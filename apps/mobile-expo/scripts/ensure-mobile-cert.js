#!/usr/bin/env node
/**
 * Garantiza certs/server.pem antes de prebuild (local o EAS).
 * 1. Archivo ya presente
 * 2. PHARMACOL_SERVER_CERT_BASE64 (EAS secret)
 * 3. Descarga por HTTPS con openssl
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const dest = path.join(__dirname, '..', 'certs', 'server.pem');
const fallback = path.join(__dirname, 'server-cert.pem');
const host = process.env.PHARMACOL_SERVER_HOST || '20.5.19.8';
const b64 = process.env.PHARMACOL_SERVER_CERT_BASE64?.trim();

function writeCert(buf) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buf);
}

if (fs.existsSync(dest)) {
  console.log('✓ certs/server.pem presente');
  process.exit(0);
}

if (b64) {
  writeCert(Buffer.from(b64, 'base64'));
  console.log('✓ certs/server.pem desde PHARMACOL_SERVER_CERT_BASE64');
  process.exit(0);
}

if (fs.existsSync(fallback)) {
  writeCert(fs.readFileSync(fallback));
  console.log('✓ certs/server.pem desde scripts/server-cert.pem');
  process.exit(0);
}

console.log(`→ Descargando certificado de https://${host} ...`);
try {
  const pem = execSync(
    `echo | openssl s_client -connect ${host}:443 -servername ${host} -showcerts 2>/dev/null | awk '/BEGIN CERTIFICATE/,/END CERTIFICATE/{print}'`,
    { encoding: 'utf8', maxBuffer: 1024 * 1024 },
  );
  if (!pem.includes('BEGIN CERTIFICATE')) {
    throw new Error('openssl no devolvió un certificado válido');
  }
  writeCert(pem);
  console.log('✓ certs/server.pem descargado por HTTPS');
  process.exit(0);
} catch (e) {
  console.error(`
ERROR: Falta certs/server.pem y no se pudo descargar automáticamente.

  bash scripts/prepare-mobile-cert.sh

Sin el certificado, Android rechaza HTTPS autofirmado (Network request failed).
Detalle: ${e instanceof Error ? e.message : e}
`);
  process.exit(1);
}

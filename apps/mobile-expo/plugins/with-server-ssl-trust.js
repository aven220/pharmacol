/**
 * Confía en el certificado autofirmado del servidor (Android dev/release build).
 * No funciona en Expo Go — requiere: npx expo run:android
 */
const fs = require('fs');
const path = require('path');
const {
  withAndroidManifest,
  withDangerousMod,
  AndroidConfig,
} = require('@expo/config-plugins');

const SERVER_HOST = process.env.PHARMACOL_SERVER_HOST || '20.5.19.8';
const CERT_FILE = process.env.PHARMACOL_SERVER_CERT || 'certs/server.pem';

function withServerSslTrust(config) {
  config = withDangerousMod(config, [
    'android',
    async (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot;
      const certSrc = path.join(projectRoot, CERT_FILE);
      const platformRoot = cfg.modRequest.platformProjectRoot;

      const xmlDir = path.join(platformRoot, 'app/src/main/res/xml');
      const rawDir = path.join(platformRoot, 'app/src/main/res/raw');
      fs.mkdirSync(xmlDir, { recursive: true });
      fs.mkdirSync(rawDir, { recursive: true });

      const hasCert = fs.existsSync(certSrc);
      if (hasCert) {
        fs.copyFileSync(certSrc, path.join(rawDir, 'pharmacol_server.pem'));
      }

      const networkConfig = hasCert
        ? `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <domain-config cleartextTrafficPermitted="false">
    <domain includeSubdomains="false">${SERVER_HOST}</domain>
    <trust-anchors>
      <certificates src="@raw/pharmacol_server" />
      <certificates src="system" />
      <certificates src="user" />
    </trust-anchors>
  </domain-config>
  <base-config cleartextTrafficPermitted="true">
    <trust-anchors>
      <certificates src="system" />
      <certificates src="user" />
    </trust-anchors>
  </base-config>
</network-security-config>`
        : `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="true">
    <trust-anchors>
      <certificates src="system" />
      <certificates src="user" />
    </trust-anchors>
  </base-config>
</network-security-config>`;

      fs.writeFileSync(path.join(xmlDir, 'network_security_config.xml'), networkConfig);
      if (!hasCert) {
        console.warn(
          `[with-server-ssl-trust] Falta ${CERT_FILE} — copia el cert del servidor (ver certs/README.md)`,
        );
      }
      return cfg;
    },
  ]);

  config = withAndroidManifest(config, (cfg) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    app.$['android:networkSecurityConfig'] = '@xml/network_security_config';
    return cfg;
  });

  return config;
}

module.exports = withServerSslTrust;

/**
 * Android network security:
 * - Permite HTTP (cleartext) hacia el servidor LAN 192.168.20.26
 * - Si existe certs/server.pem, también confía en HTTPS autofirmado
 */
const fs = require('fs');
const path = require('path');
const {
  withAndroidManifest,
  withDangerousMod,
  AndroidConfig,
} = require('@expo/config-plugins');

const SERVER_HOST = process.env.PHARMACOL_SERVER_HOST || '192.168.20.26';
const CERT_FILE = process.env.PHARMACOL_SERVER_CERT || 'certs/server.pem';
const CERT_FALLBACK = 'scripts/server-cert.pem';

function withServerSslTrust(config) {
  config = withDangerousMod(config, [
    'android',
    async (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot;
      let certSrc = path.join(projectRoot, CERT_FILE);
      const platformRoot = cfg.modRequest.platformProjectRoot;

      const b64 = process.env.PHARMACOL_SERVER_CERT_BASE64?.trim();
      if (b64 && !fs.existsSync(certSrc)) {
        fs.mkdirSync(path.dirname(certSrc), { recursive: true });
        fs.writeFileSync(certSrc, Buffer.from(b64, 'base64'));
      }
      if (!fs.existsSync(certSrc)) {
        const fallback = path.join(projectRoot, CERT_FALLBACK);
        if (fs.existsSync(fallback)) {
          certSrc = fallback;
        }
      }

      const xmlDir = path.join(platformRoot, 'app/src/main/res/xml');
      const rawDir = path.join(platformRoot, 'app/src/main/res/raw');
      fs.mkdirSync(xmlDir, { recursive: true });
      fs.mkdirSync(rawDir, { recursive: true });

      const hasCert = fs.existsSync(certSrc);
      if (hasCert) {
        fs.copyFileSync(certSrc, path.join(rawDir, 'pharmacol_server.pem'));
      }

      const trustBlock = hasCert
        ? `<certificates src="@raw/pharmacol_server" />
      <certificates src="system" />
      <certificates src="user" />`
        : `<certificates src="system" />
      <certificates src="user" />`;

      // cleartext=true: necesario para http://192.168.20.26:3906 en Android 9+
      const networkConfig = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="true">
    <trust-anchors>
      <certificates src="system" />
      <certificates src="user" />
    </trust-anchors>
  </base-config>
  <domain-config cleartextTrafficPermitted="true">
    <domain includeSubdomains="true">${SERVER_HOST}</domain>
    <domain includeSubdomains="true">localhost</domain>
    <domain includeSubdomains="true">10.0.2.2</domain>
    <trust-anchors>
      ${trustBlock}
    </trust-anchors>
  </domain-config>
</network-security-config>`;

      fs.writeFileSync(path.join(xmlDir, 'network_security_config.xml'), networkConfig);
      return cfg;
    },
  ]);

  config = withAndroidManifest(config, (cfg) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    app.$['android:networkSecurityConfig'] = '@xml/network_security_config';
    app.$['android:usesCleartextTraffic'] = 'true';
    return cfg;
  });

  return config;
}

module.exports = withServerSslTrust;

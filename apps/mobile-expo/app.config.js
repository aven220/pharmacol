/** @type {import('expo/config').ExpoConfig} */
const appJson = require('./app.json');

const apiUrl = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/$/, '');
const serverHost = process.env.PHARMACOL_SERVER_HOST || '20.5.19.8';

module.exports = {
  expo: {
    ...appJson.expo,
    plugins: [
      ...(appJson.expo.plugins || []),
      './plugins/with-server-ssl-trust.js',
    ],
    ios: {
      ...appJson.expo.ios,
      infoPlist: {
        ...(appJson.expo.ios?.infoPlist || {}),
        NSAppTransportSecurity: {
          NSExceptionDomains: {
            [serverHost]: {
              NSIncludesSubdomains: true,
              NSExceptionRequiresForwardSecrecy: false,
              NSTemporaryExceptionAllowsInsecureHTTPLoads: false,
            },
          },
        },
      },
    },
    extra: {
      ...appJson.expo.extra,
      apiUrl: apiUrl || undefined,
      serverHost,
    },
  },
};

/** @type {import('expo/config').ExpoConfig} */
const appJson = require('./app.json');

const apiUrl = (
  process.env.EXPO_PUBLIC_API_URL || 'http://192.168.20.26:3906/pharmacol/v1'
).replace(/\/$/, '');

module.exports = {
  expo: {
    ...appJson.expo,
    plugins: [...(appJson.expo.plugins || []), './plugins/with-server-ssl-trust.js'],
    android: {
      ...appJson.expo.android,
      versionCode: 4,
      usesCleartextTraffic: true,
    },
    extra: {
      ...appJson.expo.extra,
      apiUrl,
      eas: {
        projectId:
          process.env.EAS_PROJECT_ID ?? 'a308579f-591f-416a-bc5b-804a897a4312',
      },
    },
  },
};

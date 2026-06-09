/** @type {import('expo/config').ExpoConfig} */
const appJson = require('./app.json');

const apiUrl = (
  process.env.EXPO_PUBLIC_API_URL || 'https://20.5.19.8/pharmacol/v1'
).replace(/\/$/, '');

module.exports = {
  expo: {
    ...appJson.expo,
    android: {
      ...appJson.expo.android,
      versionCode: 1,
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

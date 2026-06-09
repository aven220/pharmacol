/** @type {import('expo/config').ExpoConfig} */
const appJson = require('./app.json');

const apiUrl = (
  process.env.EXPO_PUBLIC_API_URL || 'https://20.5.19.8/pharmacol/v1'
).replace(/\/$/, '');

const isDevClient =
  process.env.EAS_BUILD_PROFILE === 'development' || process.env.EXPO_DEV_CLIENT === '1';

const basePlugins = (appJson.expo.plugins || []).filter((p) => p !== 'expo-dev-client');

module.exports = {
  expo: {
    ...appJson.expo,
    plugins: [...basePlugins, ...(isDevClient ? ['expo-dev-client'] : [])],
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

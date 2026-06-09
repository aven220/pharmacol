/** @type {import('expo/config').ExpoConfig} */
const appJson = require('./app.json');

const apiUrl = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/$/, '');

module.exports = {
  expo: {
    ...appJson.expo,
    extra: {
      ...appJson.expo.extra,
      apiUrl: apiUrl || undefined,
    },
  },
};

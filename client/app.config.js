const appJson = require('./app.json');

const trim = (value) => (typeof value === 'string' ? value.trim() : '');

const revenueCatIosApiKey = trim(process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY);
const revenueCatAndroidApiKey = trim(process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY);

module.exports = () => ({
  expo: {
    ...appJson.expo,
    extra: {
      ...appJson.expo.extra,
      revenueCatIosApiKey,
      revenueCatAndroidApiKey,
    },
  },
});

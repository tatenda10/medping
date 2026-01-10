# Firebase Native Analytics Setup Guide

This guide will help you set up Firebase Analytics with native modules (`@react-native-firebase/analytics`) for iOS and Android.

## ⚠️ Important Notes

- **Development Build Required**: Native Firebase Analytics requires a development build. It will NOT work in Expo Go.
- **Build Commands**: After setup, you'll need to create a development build using EAS Build.

## Step 1: Install Dependencies

```bash
cd client
npm install @react-native-firebase/app @react-native-firebase/analytics
```
md
## Step 2: Download Firebase Configuration Files

### For iOS: GoogleService-Info.plist

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **mediping-6e5ab**
3. Click the iOS app icon (or add iOS app if not added)
4. Enter your bundle identifier: `com.mediping.app`
5. Download `GoogleService-Info.plist`
6. Place it in the `client` directory (root level, same as `app.json`)

### For Android: google-services.json

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **mediping-6e5ab**
3. Click the Android app icon (or add Android app if not added)
4. Enter your package name: `com.mediping.app`
5. Download `google-services.json`
6. Place it in the `client` directory (root level, same as `app.json`)

## Step 3: Verify Configuration Files

Your `client` directory should now have:
```
client/
├── app.json
├── GoogleService-Info.plist  ← iOS config
├── google-services.json        ← Android config
├── package.json
└── ...
```

## Step 4: Create Development Build

Since native Firebase requires native modules, you need to create a development build:

### Using EAS Build (Recommended)

```bash
# Install EAS CLI if not already installed
npm install -g eas-cli

# Login to Expo
eas login

# Build development client
eas build --profile development --platform ios
eas build --platform android --profile development
```

### Or Build Locally (Advanced)

```bash
# For iOS (requires macOS)
npx expo run:ios

# For Android
npx expo run:android
```

## Step 5: Install Development Build on Device

After the build completes:
- **iOS**: Install via TestFlight or download the `.ipa` file
- **Android**: Download the `.apk` file and install on your device

## Step 6: Test Analytics

1. Run your app with the development build
2. Perform actions that trigger analytics events (e.g., login, add medication)
3. Check Firebase Console → Analytics → Events (may take a few minutes to appear)

## Troubleshooting

### "Native Firebase Analytics not available"
- **Cause**: Running in Expo Go or development build not created
- **Solution**: Create and use a development build (see Step 4)

### "GoogleService-Info.plist not found" (iOS)
- **Cause**: File not in correct location or not added to project
- **Solution**: Ensure file is in `client/` directory root, rebuild

### "google-services.json not found" (Android)
- **Cause**: File not in correct location
- **Solution**: Ensure file is in `client/` directory root, rebuild

### Analytics events not appearing
- **Cause**: Debug mode disables analytics by default
- **Solution**: Check that `setAnalyticsCollectionEnabled(true)` is called (already in code)
- **Note**: Events may take 24-48 hours to appear in Firebase Console

## Current Implementation

The `firebaseService.js` now supports:
- ✅ **Web**: Uses Firebase JS SDK (`firebase/analytics`)
- ✅ **iOS/Android**: Uses `@react-native-firebase/analytics`
- ✅ **Fallback**: Logs to console if native analytics unavailable

## Analytics Events Tracked

The following events are automatically tracked:
- Onboarding: `onboarding_started`, `onboarding_welcome_viewed`, etc.
- User: `user_signed_up`, `user_logged_in`, `account_deleted`
- Medication: `medication_added`, `medication_edited`, `medication_deleted`
- Doses: `dose_marked_taken`, `dose_marked_missed`, `dose_marked_skipped`
- Features: `refill_added`, `appointment_added`, `vitals_logged`, etc.
- Screen views: Automatically tracked via `AppNavigator`

## Next Steps

1. ✅ Install dependencies
2. ✅ Download configuration files
3. ✅ Create development build
4. ✅ Test analytics events
5. ✅ Monitor Firebase Console for events

For more information, see:
- [React Native Firebase Documentation](https://rnfirebase.io/)
- [Expo Development Builds](https://docs.expo.dev/development/introduction/)
- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)


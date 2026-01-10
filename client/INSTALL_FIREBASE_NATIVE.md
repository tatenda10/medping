# Install Firebase Native Analytics

## Quick Install

Run this command in the `client` directory:

```bash
npm install @react-native-firebase/app @react-native-firebase/analytics
```

## After Installation

1. **Download Firebase Config Files** (see `FIREBASE_NATIVE_SETUP.md`):
   - Download `GoogleService-Info.plist` for iOS
   - Download `google-services.json` for Android
   - Place both in the `client` directory root

2. **Create Development Build**:
   ```bash
   eas build --profile development --platform ios
   eas build --profile development --platform android
   ```

3. **Test**: Analytics will now work on iOS/Android (not in Expo Go)

## Current Status

✅ Code is ready - just needs:
- Package installation
- Config files
- Development build

The app will gracefully fall back to console logging if native analytics isn't available (e.g., in Expo Go).


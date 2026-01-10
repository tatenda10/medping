# Frontend Package Installation Guide

## Quick Install (All at Once)

Copy and paste this entire command:

```bash
npm install @react-navigation/native @react-navigation/native-stack @react-navigation/bottom-tabs @react-navigation/drawer react-native-screens react-native-safe-area-context react-native-paper react-native-vector-icons @react-native-community/datetimepicker react-native-calendars date-fns react-native-chart-kit react-native-svg expo-image-picker expo-image expo-notifications expo-device react-hook-form @hookform/resolvers yup axios react-native-webview expo-file-system expo-sharing react-native-gesture-handler react-native-reanimated lodash
```

## Or Install by Category

### 1. Navigation (React Navigation - Required)
```bash
npm install @react-navigation/native @react-navigation/native-stack @react-navigation/bottom-tabs @react-navigation/drawer react-native-screens react-native-safe-area-context
```

### 2. UI Components
```bash
npm install react-native-paper react-native-vector-icons @react-native-community/datetimepicker
```

### 3. Calendar & Dates
```bash
npm install react-native-calendars date-fns
```

### 4. Charts & Visualization
```bash
npm install react-native-chart-kit react-native-svg
```

### 5. Image Handling
```bash
npm install expo-image-picker expo-image
```

### 6. Notifications
```bash
npm install expo-notifications expo-device
```

### 7. Forms
```bash
npm install react-hook-form @hookform/resolvers yup
```

### 8. HTTP Client
```bash
npm install axios
```

### 9. PDF & File Handling
```bash
npm install react-native-webview expo-file-system expo-sharing
```

### 10. Utilities
```bash
npm install react-native-gesture-handler react-native-reanimated lodash
```

## After Installation

1. **Fix any compatibility issues:**
   ```bash
   npx expo install --fix
   ```

2. **For iOS (if needed):**
   ```bash
   cd ios && pod install && cd ..
   ```

3. **Restart Expo:**
   ```bash
   npm start
   ```

## Package Descriptions

- **@react-navigation/native** - Core navigation library
- **@react-navigation/native-stack** - Stack navigator
- **@react-navigation/bottom-tabs** - Bottom tab navigator
- **@react-navigation/drawer** - Drawer navigator
- **react-native-screens** - Native screen components
- **react-native-safe-area-context** - Safe area handling
- **react-native-paper** - Material Design components
- **react-native-vector-icons** - Icon library
- **@react-native-community/datetimepicker** - Date/time picker
- **react-native-calendars** - Calendar component
- **date-fns** - Date utility library
- **react-native-chart-kit** - Chart components
- **react-native-svg** - SVG support for charts
- **expo-image-picker** - Image selection
- **expo-image** - Optimized image component
- **expo-notifications** - Push notifications
- **expo-device** - Device info
- **react-hook-form** - Form handling
- **@hookform/resolvers** - Form validation resolvers
- **yup** - Schema validation
- **axios** - HTTP client
- **react-native-view-pdf** - PDF viewer
- **expo-file-system** - File system access
- **expo-sharing** - Share files
- **react-native-gesture-handler** - Gesture handling
- **react-native-reanimated** - Animations
- **lodash** - Utility functions


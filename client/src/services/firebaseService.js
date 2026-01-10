import { initializeApp, getApps } from 'firebase/app';
import { getAnalytics, isSupported, logEvent } from 'firebase/analytics';
import { Platform } from 'react-native';

// Native Firebase Analytics (for iOS/Android)
// This will be null if @react-native-firebase/analytics is not installed
// or if running in Expo Go (which doesn't support native modules)
let nativeAnalytics = null;
if (Platform.OS !== 'web') {
  try {
    // Try to import native Firebase Analytics
    // This will fail gracefully if the package isn't installed
    const analyticsModule = require('@react-native-firebase/analytics');
    if (analyticsModule && analyticsModule.default) {
      nativeAnalytics = analyticsModule.default();
    }
  } catch (error) {
    // @react-native-firebase/analytics not installed or not available
    // This is expected if using Expo Go or if package isn't installed yet
    // We'll fall back to console logging
    if (__DEV__) {
      console.log('ℹ️ Native Firebase Analytics not available (requires development build)');
    }
  }
}

// Firebase configuration from environment variables
// Fallback to default values if env vars are not set (user should copy env.example to .env)
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "AIzaSyCgNK_Nkaop4-STNqWS6LktRsxpmKpWjCI",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "mediping-6e5ab.firebaseapp.com",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "mediping-6e5ab",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "mediping-6e5ab.firebasestorage.app",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "304498638388",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "1:304498638388:web:8604200cc58e584d8c9461",
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-M6ZS8Q56YE",
};

let app = null;
let webAnalytics = null;

// Initialize Firebase
const initializeFirebase = async () => {
  try {
    // Initialize web Firebase (for web platform)
    if (Platform.OS === 'web') {
      // Check if Firebase is already initialized
      if (getApps().length === 0) {
        app = initializeApp(firebaseConfig);
      } else {
        app = getApps()[0];
      }

      const supported = await isSupported();
      if (supported) {
        webAnalytics = getAnalytics(app);
        console.log('✅ Firebase Analytics initialized (Web)');
      } else {
        console.log('⚠️ Firebase Analytics not supported on this platform');
      }
    } else {
      // For native platforms, @react-native-firebase/analytics handles initialization
      // via GoogleService-Info.plist (iOS) and google-services.json (Android)
      if (nativeAnalytics) {
        try {
          // Enable analytics collection (disabled by default in debug mode)
          await nativeAnalytics.setAnalyticsCollectionEnabled(true);
          console.log('✅ Firebase Analytics initialized (Native)');
        } catch (error) {
          console.log('⚠️ Error enabling native analytics:', error.message);
        }
      } else {
        if (__DEV__) {
          console.log('⚠️ Native Firebase Analytics not available - requires development build');
        }
      }
    }
  } catch (error) {
    console.error('❌ Firebase initialization error:', error);
  }
};

// Track an event
const trackEvent = async (eventName, parameters = {}) => {
  try {
    if (Platform.OS === 'web' && webAnalytics) {
      // Web: Use Firebase JS SDK
      logEvent(webAnalytics, eventName, parameters);
      console.log(`📊 Analytics Event (Web): ${eventName}`, parameters);
    } else if (Platform.OS !== 'web' && nativeAnalytics) {
      // Native: Use React Native Firebase
      await nativeAnalytics.logEvent(eventName, parameters);
      if (__DEV__) {
        console.log(`📊 Analytics Event (Native): ${eventName}`, parameters);
      }
    } else {
      // Fallback: Log to console if analytics not available
      console.log(`📊 Analytics Event (Fallback): ${eventName}`, parameters);
    }
  } catch (error) {
    console.error('❌ Analytics tracking error:', error);
  }
};

// Track screen view
const trackScreenView = async (screenName, screenClass = null) => {
  try {
    await trackEvent('screen_view', {
      screen_name: screenName,
      screen_class: screenClass || screenName,
    });
  } catch (error) {
    console.error('❌ Screen view tracking error:', error);
  }
};

// Predefined event tracking functions
const analyticsEvents = {
  // Onboarding events
  onboardingStarted: () => trackEvent('onboarding_started'),
  onboardingWelcomeViewed: () => trackEvent('onboarding_welcome_viewed'),
  onboardingQuestionnaireStarted: () => trackEvent('onboarding_questionnaire_started'),
  onboardingQuestionnaireCompleted: (answersCount) => 
    trackEvent('onboarding_questionnaire_completed', { answers_count: answersCount }),
  onboardingQuestionnaireSkipped: () => trackEvent('onboarding_questionnaire_skipped'),
  
  // Medication events
  firstMedicationAdded: (medicationType) => 
    trackEvent('first_medication_added', { medication_type: medicationType }),
  medicationAdded: (medicationType) => 
    trackEvent('medication_added', { medication_type: medicationType }),
  medicationEdited: () => trackEvent('medication_edited'),
  medicationDeleted: () => trackEvent('medication_deleted'),
  
  // User events
  userSignedUp: (method) => trackEvent('user_signed_up', { method }),
  userLoggedIn: (method) => trackEvent('user_logged_in', { method }),
  userLoggedOut: () => trackEvent('user_logged_out'),
  accountDeleted: () => trackEvent('account_deleted'),
  
  // Dose tracking events
  doseMarkedTaken: () => trackEvent('dose_marked_taken'),
  doseMarkedMissed: () => trackEvent('dose_marked_missed'),
  doseMarkedSkipped: () => trackEvent('dose_marked_skipped'),
  
  // Feature usage
  refillAdded: () => trackEvent('refill_added'),
  appointmentAdded: () => trackEvent('appointment_added'),
  vitalsLogged: (vitalType) => trackEvent('vitals_logged', { vital_type: vitalType }),
  waterIntakeLogged: () => trackEvent('water_intake_logged'),
  exerciseLogged: () => trackEvent('exercise_logged'),
  
  // Caregiver events
  caregiverInvited: () => trackEvent('caregiver_invited'),
  caregiverInvitationAccepted: () => trackEvent('caregiver_invitation_accepted'),
  caregiverDoseLogged: () => trackEvent('caregiver_dose_logged'),
  
  // Export events
  dataExported: (exportType) => trackEvent('data_exported', { export_type: exportType }),
  
  // Notification events
  notificationReceived: () => trackEvent('notification_received'),
  notificationOpened: () => trackEvent('notification_opened'),
  notificationSnoozed: (minutes) => trackEvent('notification_snoozed', { minutes }),
};

// Initialize Firebase on import
initializeFirebase();

export default {
  app,
  webAnalytics,
  nativeAnalytics,
  trackEvent,
  trackScreenView,
  ...analyticsEvents,
};


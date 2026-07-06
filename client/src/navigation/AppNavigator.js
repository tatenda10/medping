import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Platform, ActivityIndicator } from 'react-native';
import { NavigationContainer, CommonActions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNotificationHandler } from '../hooks/useNotificationHandler';
import { navigationRef } from './navigationRef';
import { navigateAfterAuthentication, registerPostAuthReadyHandler } from './postAuthNavigation';
import CreateAccountPrompt from '../components/CreateAccountPrompt';
import SubscriptionPaywallGate from '../components/SubscriptionPaywallGate';
import { useAuth } from '../context/AuthContext';
import clearAllData from '../utils/clearAllData';
import { logoutPurchasesUser } from '../services/purchasesService';
import syncService from '../services/syncService';

// Screens
import SplashScreen from '../screens/SplashScreen';
import LoginScreen from '../screens/LoginScreen';
import SignUpScreen from '../screens/SignUpScreen';
import OnboardingNavigator from './OnboardingNavigator';
import onboardingService from '../services/onboardingService';
import DashboardScreen from '../screens/DashboardScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SettingsScreen from '../screens/SettingsScreen';
import SubscriptionScreen from '../screens/SubscriptionScreen';
import CalendarScreen from '../screens/CalendarScreen';
import MetricsScreen from '../screens/MetricsScreen';
import AddMedicineScreen from '../screens/AddMedicineScreen';
import MedicationDetailScreen from '../screens/MedicationDetailScreen';
import EditMedicineScreen from '../screens/EditMedicineScreen';
import MedicationReminderScreen from '../screens/MedicationReminderScreen';
import InviteCaregiverScreen from '../screens/InviteCaregiverScreen';
import CaregiverInvitationsScreen from '../screens/CaregiverInvitationsScreen';
import AddRefillScreen from '../screens/AddRefillScreen';
import VitalsTrackingScreen from '../screens/VitalsTrackingScreen';
import ExerciseTrackingScreen from '../screens/ExerciseTrackingScreen';
import WaterIntakeScreen from '../screens/WaterIntakeScreen';
import AppointmentsScreen from '../screens/AppointmentsScreen';

// Components
import CustomTabBar from '../components/CustomTabBar';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const SettingsStack = createNativeStackNavigator();

// Component to handle notifications inside NavigationContainer
const NotificationHandler = () => {
  useNotificationHandler();
  return null;
};

// Main Tab Navigator (with FAB wrapper)
const MainTabs = ({ navigation, onLogout }) => {
  const authContext = useAuth();
  const { isAuthenticated, isAuthSync } = authContext;
  const authToken = authContext?.authToken || null;
  const [showCreateAccountPrompt, setShowCreateAccountPrompt] = React.useState(false);
  const [promptMessage, setPromptMessage] = React.useState('');

  // Helper to handle tab press with auth check - uses synchronous check
  const handleTabPress = (routeName, message, preventDefault) => {
    // Use synchronous check for immediate response
    const auth = isAuthSync();
    if (!auth) {
      preventDefault();
      setPromptMessage(message);
      setShowCreateAccountPrompt(true);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        tabBar={(props) => (
          <CustomTabBar
            {...props}
            onBeforeAddMedicine={() => setShowCreateAccountPrompt(false)}
          />
        )}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Tab.Screen
          name="Dashboard"
          options={{
            tabBarButton: () => null, // Hide from default tab bar, handled by CustomTabBar
          }}
        >
          {() => <DashboardScreenWithHeader navigation={navigation} />}
        </Tab.Screen>
        <Tab.Screen
          name="Calendar"
          options={{
            tabBarButton: () => null, // Hide from default tab bar, handled by CustomTabBar
          }}
          listeners={{
            tabPress: (e) => {
              handleTabPress(
                'Calendar',
                'Create an account to access the calendar view and track your medication schedule.',
                () => e.preventDefault()
              );
            },
            beforeRemove: (e) => {
              // Prevent navigation if not authenticated
              if (!isAuthSync()) {
                e.preventDefault();
              }
            },
          }}
        >
          {({ navigation }) => {
            // Only render if authenticated or checking
            if (!isAuthSync() && !isAuthenticated) {
              return null;
            }
            return <CalendarScreen navigation={navigation} />;
          }}
        </Tab.Screen>
        <Tab.Screen
          name="Metrics"
          options={{
            tabBarButton: () => null, // Hide from default tab bar, handled by CustomTabBar
          }}
          listeners={{
            tabPress: (e) => {
              handleTabPress(
                'Metrics',
                'Create an account to view your medication analytics and adherence metrics.',
                () => e.preventDefault()
              );
            },
            beforeRemove: (e) => {
              if (!isAuthSync()) {
                e.preventDefault();
              }
            },
          }}
        >
          {({ navigation }) => {
            if (!isAuthSync() && !isAuthenticated) {
              return null;
            }
            return (
              <View style={{ flex: 1 }}>
                <MetricsScreen navigation={navigation} />
              </View>
            );
          }}
        </Tab.Screen>
        <Tab.Screen
          name="Settings"
          options={{
            tabBarButton: () => null,
          }}
        >
          {() => <SettingsStackNavigator onLogout={onLogout} />}
        </Tab.Screen>
      </Tab.Navigator>

      {/* Create Account Prompt Modal */}
      <CreateAccountPrompt
        visible={showCreateAccountPrompt}
        onClose={() => setShowCreateAccountPrompt(false)}
        message={promptMessage}
      />
    </View>
  );
};

// Dashboard with header
const DashboardScreenWithHeader = ({ navigation }) => {
  return (
    <View style={{ flex: 1 }}>
      <DashboardScreen />
    </View>
  );
};

// Settings tab stack — keeps bottom nav visible on profile & caregiver screens
const SettingsStackNavigator = ({ onLogout }) => {
  const authContext = useAuth();
  const authToken = authContext?.authToken || null;

  return (
    <SettingsStack.Navigator screenOptions={{ headerShown: false }}>
      <SettingsStack.Screen name="SettingsMain">
        {(props) => <SettingsScreen {...props} onLogout={onLogout} />}
      </SettingsStack.Screen>
      <SettingsStack.Screen name="Profile">
        {(props) => <ProfileScreen {...props} userToken={authToken} onLogout={onLogout} />}
      </SettingsStack.Screen>
      <SettingsStack.Screen name="InviteCaregiver" component={InviteCaregiverScreen} />
      <SettingsStack.Screen name="CaregiverInvitations" component={CaregiverInvitationsScreen} />
    </SettingsStack.Navigator>
  );
};

// Main app stack (replaces drawer)
const MainAppNavigator = ({ onLogout }) => {
  const authContext = useAuth();
  const authToken = authContext?.authToken || null;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs">
        {(props) => (
          <>
            <SubscriptionPaywallGate stackNavigation={props.navigation} />
            <MainTabs {...props} onLogout={onLogout} userToken={authToken} />
          </>
        )}
      </Stack.Screen>
      <Stack.Screen name="AddMedicine">
        {({ navigation }) => <AddMedicineScreen navigation={navigation} />}
      </Stack.Screen>
      <Stack.Screen name="MedicationDetail">
        {({ navigation, route }) => <MedicationDetailScreen navigation={navigation} route={route} />}
      </Stack.Screen>
      <Stack.Screen name="EditMedicine">
        {({ navigation, route }) => <EditMedicineScreen navigation={navigation} route={route} />}
      </Stack.Screen>
      <Stack.Screen
        name="MedicationReminder"
        options={{ gestureEnabled: false }}
      >
        {({ navigation, route }) => <MedicationReminderScreen navigation={navigation} route={route} />}
      </Stack.Screen>
      <Stack.Screen name="AddRefill">
        {({ navigation, route }) => <AddRefillScreen navigation={navigation} route={route} />}
      </Stack.Screen>
      <Stack.Screen name="VitalsTracking">
        {({ navigation }) => <VitalsTrackingScreen navigation={navigation} />}
      </Stack.Screen>
      <Stack.Screen name="ExerciseTracking">
        {({ navigation }) => <ExerciseTrackingScreen navigation={navigation} />}
      </Stack.Screen>
      <Stack.Screen name="WaterIntake">
        {({ navigation }) => <WaterIntakeScreen navigation={navigation} />}
      </Stack.Screen>
      <Stack.Screen name="Appointments">
        {({ navigation }) => <AppointmentsScreen navigation={navigation} />}
      </Stack.Screen>
      <Stack.Screen
        name="Subscription"
        options={{ presentation: 'fullScreenModal', gestureEnabled: false }}
      >
        {(props) => <SubscriptionScreen {...props} onLogout={onLogout} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
};

// Legacy name kept for root stack screen registration
const DrawerNavigator = MainAppNavigator;

const AppNavigator = () => {
  const { isAuthenticated, isLoaded, userId, clearAuth } = useAuth();
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [navResetKey, setNavResetKey] = useState(0);
  const isLoggingOutRef = useRef(false);

  useEffect(() => {
    registerPostAuthReadyHandler(() => {
      setNeedsOnboarding(false);
      setIsLoading(false);
    });

    return () => registerPostAuthReadyHandler(null);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      checkAuthStatus();
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      console.warn('⚠️ Auth still loading — showing Splash as guest');
      setNeedsOnboarding(true);
      setIsLoading(false);
    }, 4000);

    return () => clearTimeout(timeoutId);
  }, [isLoaded, isAuthenticated, userId]);

  // Separate effect to handle navigation when auth state changes and user is authenticated
  useEffect(() => {
    if (
      isLoaded &&
      isAuthenticated &&
      userId &&
      !isLoading &&
      !needsOnboarding &&
      !isLoggingOutRef.current
    ) {
      console.log('🚀 User authenticated, checking navigation...', 'needsOnboarding:', needsOnboarding);
      
      // Check if user has data - if so, they should go to MainApp regardless of onboarding flag
      const checkAndNavigate = async () => {
        const hasData = await onboardingService.hasAnyMedications(userId);
        const shouldShowMainApp = true;
        
        if (navigationRef.current?.isReady()) {
          // Wait a bit for state to settle
          setTimeout(async () => {
            const currentRoute = navigationRef.current?.getCurrentRoute();
            console.log('📍 Current route:', currentRoute?.name);

            // Auth screens handle their own navigation (including post-onboarding paywall)
            if (
              currentRoute?.name === 'Login' ||
              currentRoute?.name === 'SignUp' ||
              currentRoute?.name === 'SignIn' ||
              currentRoute?.name === 'CreateAccount'
            ) {
              return;
            }

            if (
              (currentRoute?.name === 'Welcome' ||
                currentRoute?.name === 'Onboarding' ||
                currentRoute?.name === 'AddFirstMedication') &&
              shouldShowMainApp
            ) {
              console.log('🔄 Navigating away from', currentRoute.name, 'after auth');
              await navigateAfterAuthentication();
            } else if (currentRoute?.name === 'Splash') {
              // If on splash screen and authenticated, navigate appropriately
              console.log('🔄 Navigating from Splash to appropriate screen');
              if (shouldShowMainApp) {
                navigationRef.current?.dispatch(
                  CommonActions.reset({
                    index: 0,
                    routes: [{ name: 'MainApp' }],
                  })
                );
              } else {
                navigationRef.current?.navigate('Onboarding');
              }
            }
          }, 300);
        }
      };
      
      checkAndNavigate();
    }
  }, [isLoaded, isAuthenticated, userId, isLoading, needsOnboarding]);

  // Effect to handle navigation when needsOnboarding changes (e.g., after logout)
  // Only trigger when user is NOT authenticated (after logout)
  useEffect(() => {
    if (!isLoading && needsOnboarding && !isAuthenticated && !userId && navigationRef.current?.isReady()) {
      // Wait a bit for the navigation stack to update
      setTimeout(() => {
        const currentRoute = navigationRef.current?.getCurrentRoute();
        // Only navigate if we're not already on Onboarding or Welcome, and user is not authenticated
        if (currentRoute?.name !== 'Onboarding' && currentRoute?.name !== 'Welcome' && currentRoute?.name !== 'Splash') {
          console.log('🔄 needsOnboarding changed (user logged out), navigating to Onboarding/Welcome');
          try {
            navigationRef.current.dispatch(
              CommonActions.reset({
                index: 0,
                routes: [{ name: 'Splash' }],
              })
            );
          } catch (error) {
            console.error('❌ Error navigating to Onboarding:', error);
          }
        }
      }, 100);
    }
  }, [needsOnboarding, isLoading, isAuthenticated, userId]);

  const checkAuthStatus = async () => {
    try {
      console.log('🔍 checkAuthStatus called - isLoaded:', isLoaded, 'isAuthenticated:', isAuthenticated, 'userId:', userId);

      if (isLoggingOutRef.current) {
        return;
      }
      
      if (!isLoaded) {
        console.log('⏳ Waiting for auth to load...');
        return; // Wait for Clerk to load
      }

      // Check if onboarding is completed first
      const completed = await onboardingService.hasCompletedOnboarding();
      console.log('📋 Onboarding completed:', completed);
      
      // Check if there's any data (medications) - for guest users or if onboarding not completed
      const hasData = await onboardingService.hasAnyMedications(userId || null);
      console.log('💊 Has medications data:', hasData, 'for userId:', userId);

      const shouldDeferNavigation =
        navigationRef.current?.getCurrentRoute()?.name === 'Subscription';

      // If user is authenticated AND has data, always show MainApp (skip onboarding)
      // Even if onboarding flag is not set, if they have medications, they've already set up the app
      if (isAuthenticated && userId && hasData) {
        console.log('✅ User authenticated with data - showing MainApp (skipping onboarding)');
        setNeedsOnboarding(false);
        setIsLoading(false);
        if (shouldDeferNavigation) {
          return;
        }
        // Ensure we navigate to MainApp
        setTimeout(() => {
          if (navigationRef.current?.isReady()) {
            const currentRoute = navigationRef.current?.getCurrentRoute();
            if (currentRoute?.name !== 'MainApp') {
              navigationRef.current.dispatch(
                CommonActions.reset({
                  index: 0,
                  routes: [{ name: 'MainApp' }],
                })
              );
            }
          }
        }, 100);
        return;
      }
      
      // If user is authenticated AND onboarding is completed, show MainApp
      if (isAuthenticated && userId && completed) {
        console.log('✅ User authenticated with completed onboarding - showing MainApp');
        setNeedsOnboarding(false);
        setIsLoading(false);
        if (shouldDeferNavigation) {
          return;
        }
        // Ensure we navigate to MainApp
        setTimeout(() => {
          if (navigationRef.current?.isReady()) {
            const currentRoute = navigationRef.current?.getCurrentRoute();
            if (currentRoute?.name !== 'MainApp') {
              navigationRef.current.dispatch(
                CommonActions.reset({
                  index: 0,
                  routes: [{ name: 'MainApp' }],
                })
              );
            }
          }
        }, 100);
        return;
      }
      
      // If user is not authenticated AND has no data, show onboarding/login
      if (!isAuthenticated && !userId && !hasData) {
        console.log('🔒 User not authenticated and no data - showing onboarding/login');
        setNeedsOnboarding(true);
        setIsLoading(false);
        return;
      }

      // Authenticated users should never be sent back to the guest Welcome flow
      if (isAuthenticated && userId) {
        console.log('✅ User authenticated - showing MainApp');
        setNeedsOnboarding(false);
        setIsLoading(false);
        if (shouldDeferNavigation) {
          return;
        }
        setTimeout(() => {
          if (navigationRef.current?.isReady()) {
            const currentRoute = navigationRef.current?.getCurrentRoute();
            if (currentRoute?.name !== 'MainApp') {
              navigationRef.current.dispatch(
                CommonActions.reset({
                  index: 0,
                  routes: [{ name: 'MainApp' }],
                })
              );
            }
          }
        }, 100);
        return;
      }
      
      // If no data exists AND onboarding not completed, show onboarding (guest only)
      if (!hasData && !completed) {
        console.log('📝 No data and onboarding not completed - showing onboarding');
        setNeedsOnboarding(true);
        setIsLoading(false);
        return;
      }
      
      // If data exists, check if onboarding is completed
      if (isAuthenticated && userId) {
        // Authenticated user with data - should have been handled above
        // This is a fallback
        console.log('✅ Authenticated user - needsOnboarding: false (has data)');
        setNeedsOnboarding(false);
        setIsLoading(false);
      } else {
        // No auth but has data (guest mode) - show MainApp if onboarding completed
        if (completed) {
          console.log('✅ Guest with completed onboarding - showing MainApp');
          setNeedsOnboarding(false); // Onboarding done, show MainApp
        } else {
          // Has data but onboarding not completed - show onboarding
          console.log('📝 Guest with data but onboarding not completed - showing onboarding');
          setNeedsOnboarding(true);
        }
      }
    } catch (error) {
      console.error('❌ Error checking auth status:', error);
      // On error, default to showing onboarding only if not authenticated
      setNeedsOnboarding(!isAuthenticated);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginSuccess = async () => {
    console.log('🟢 handleLoginSuccess called');

    await new Promise((resolve) => setTimeout(resolve, 600));
    setNeedsOnboarding(false);
    setIsLoading(false);

    await navigateAfterAuthentication();
  };

  const handleSignUpSuccess = async () => {
    await new Promise((resolve) => setTimeout(resolve, 500));

    setNeedsOnboarding(false);
    setIsLoading(false);

    await navigateAfterAuthentication();
  };

  const handleOnboardingComplete = () => {
    setNeedsOnboarding(false);
  };

  const handleLogout = async () => {
    if (isLoggingOutRef.current) {
      return;
    }

    console.log('🔴 AppNavigator handleLogout called');
    isLoggingOutRef.current = true;

    try {
      syncService.stopAutoSync();

      setNeedsOnboarding(true);
      setIsLoading(false);
      setNavResetKey((key) => key + 1);

      console.log('🔴 Clearing all local data...');
      await clearAllData(false);
      console.log('✅ Local data cleared');

      try {
        await logoutPurchasesUser();
      } catch (purchaseError) {
        console.warn('RevenueCat logout skipped:', purchaseError?.message);
      }

      console.log('🔴 Clearing auth...');
      await clearAuth();
      console.log('✅ Auth cleared');

      if (navigationRef.current?.isReady()) {
        navigationRef.current.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: 'Splash' }],
          })
        );
      }
    } catch (error) {
      console.error('❌ Error logging out:', error);
      setNeedsOnboarding(true);
      setIsLoading(false);
      setNavResetKey((key) => key + 1);
    } finally {
      isLoggingOutRef.current = false;
      syncService.startAutoSync();
    }
  };

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#FFFFFF',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <ActivityIndicator size="large" color="#0284C7" />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <NotificationHandler />
      <Stack.Navigator
        key={needsOnboarding ? `onboarding-${navResetKey}` : `app-${navResetKey}`}
        initialRouteName={needsOnboarding ? 'Splash' : 'MainApp'}
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right', // Smooth slide transition between screens
        }}
      >
        {needsOnboarding ? (
          <>
            <Stack.Screen name="Splash" component={SplashScreen} />
            <Stack.Screen 
              name="Onboarding" 
              component={OnboardingNavigator}
              options={{ headerShown: false }}
            />
            <Stack.Screen name="Login">
              {(props) => <LoginScreen {...props} onLoginSuccess={handleLoginSuccess} />}
            </Stack.Screen>
            <Stack.Screen name="SignUp">
              {(props) => <SignUpScreen {...props} onSignUpSuccess={handleSignUpSuccess} />}
            </Stack.Screen>
            {/* Ensure MainApp route exists even during onboarding so RESET to MainApp works */}
            <Stack.Screen name="MainApp" options={{ headerShown: false }}>
              {() => <DrawerNavigator onLogout={handleLogout} />}
            </Stack.Screen>
          </>
        ) : (
          <>
            {/* Show MainApp if onboarding is complete (authenticated or guest) */}
            <Stack.Screen name="MainApp">
              {() => <DrawerNavigator onLogout={handleLogout} />}
            </Stack.Screen>
            {/* Still allow access to login/signup from MainApp */}
            <Stack.Screen name="Login">
              {(props) => <LoginScreen {...props} onLoginSuccess={handleLoginSuccess} />}
            </Stack.Screen>
            <Stack.Screen name="SignUp">
              {(props) => <SignUpScreen {...props} onSignUpSuccess={handleSignUpSuccess} />}
            </Stack.Screen>
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};


export default AppNavigator;

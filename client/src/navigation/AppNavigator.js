import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Platform } from 'react-native';
import { NavigationContainer, CommonActions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNotificationHandler } from '../hooks/useNotificationHandler';
import { navigationRef } from './navigationRef';
import CreateAccountPrompt from '../components/CreateAccountPrompt';
import { useAuth } from '../context/ClerkAuthContext';
import { useAuth as useClerkAuth, useUser } from '@clerk/clerk-expo';
import databaseService from '../services/databaseService';


// Screens
import SplashScreen from '../screens/SplashScreen';
import LoginScreen from '../screens/LoginScreen';
import SignUpScreen from '../screens/SignUpScreen';
import OnboardingNavigator from './OnboardingNavigator';
import onboardingService from '../services/onboardingService';
import DashboardScreen from '../screens/DashboardScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SettingsScreen from '../screens/SettingsScreen';
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
import DrawerContent from '../components/DrawerContent';
import AppHeader from '../components/AppHeader';
import CustomTabBar from '../components/CustomTabBar';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const Drawer = createDrawerNavigator();

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
        tabBar={(props) => <CustomTabBar {...props} />}
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
            tabBarButton: () => null, // Hide from default tab bar, handled by CustomTabBar
          }}
          listeners={{
            tabPress: (e) => {
              handleTabPress(
                'Settings',
                'Create an account to access settings and manage your account.',
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
            return <SettingsScreen navigation={navigation} onLogout={onLogout} />;
          }}
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

// Drawer Navigator
const DrawerNavigator = ({ onLogout }) => {
  const authContext = useAuth();
  const authToken = authContext?.authToken || null;
  return (
    <Drawer.Navigator
      drawerContent={(props) => <DrawerContent {...props} onLogout={onLogout} />}
      screenOptions={{
        headerShown: false,
        drawerType: 'front',
        drawerStyle: {
          width: '75%', // Make drawer about 3/4 of the screen width
        },
      }}
    >
      <Drawer.Screen name="MainTabs">
        {(props) => <MainTabs {...props} onLogout={onLogout} userToken={authToken} />}
      </Drawer.Screen>
      <Drawer.Screen 
        name="Profile"
        options={{ drawerItemStyle: { display: 'none' } }}
      >
        {(props) => <ProfileScreen {...props} userToken={authToken} onLogout={onLogout} />}
      </Drawer.Screen>
      <Drawer.Screen 
        name="AddMedicine"
        options={{ drawerItemStyle: { display: 'none' } }}
      >
        {({ navigation }) => <AddMedicineScreen navigation={navigation} />}
      </Drawer.Screen>
      <Drawer.Screen 
        name="MedicationDetail"
        options={{ drawerItemStyle: { display: 'none' } }}
      >
        {({ navigation, route }) => <MedicationDetailScreen navigation={navigation} route={route} />}
      </Drawer.Screen>
      <Drawer.Screen 
        name="EditMedicine"
        options={{ drawerItemStyle: { display: 'none' } }}
      >
        {({ navigation, route }) => <EditMedicineScreen navigation={navigation} route={route} />}
      </Drawer.Screen>
      <Drawer.Screen 
        name="MedicationReminder"
        options={{ 
          drawerItemStyle: { display: 'none' },
          headerShown: false,
          gestureEnabled: false, // Prevent swipe back
        }}
      >
        {({ navigation, route }) => <MedicationReminderScreen navigation={navigation} route={route} />}
      </Drawer.Screen>
      <Drawer.Screen 
        name="InviteCaregiver"
        options={{ drawerItemStyle: { display: 'none' } }}
      >
        {({ navigation }) => <InviteCaregiverScreen navigation={navigation} />}
      </Drawer.Screen>
      <Drawer.Screen 
        name="CaregiverInvitations"
        options={{ drawerItemStyle: { display: 'none' } }}
      >
        {({ navigation }) => <CaregiverInvitationsScreen navigation={navigation} />}
      </Drawer.Screen>
      <Drawer.Screen 
        name="AddRefill"
        options={{ drawerItemStyle: { display: 'none' } }}
      >
        {({ navigation, route }) => <AddRefillScreen navigation={navigation} route={route} />}
      </Drawer.Screen>
      <Drawer.Screen 
        name="VitalsTracking"
        options={{ drawerItemStyle: { display: 'none' } }}
      >
        {({ navigation }) => <VitalsTrackingScreen navigation={navigation} />}
      </Drawer.Screen>
      <Drawer.Screen 
        name="ExerciseTracking"
        options={{ drawerItemStyle: { display: 'none' } }}
      >
        {({ navigation }) => <ExerciseTrackingScreen navigation={navigation} />}
      </Drawer.Screen>
      <Drawer.Screen 
        name="WaterIntake"
        options={{ drawerItemStyle: { display: 'none' } }}
      >
        {({ navigation }) => <WaterIntakeScreen navigation={navigation} />}
      </Drawer.Screen>
      <Drawer.Screen 
        name="Appointments"
        options={{ drawerItemStyle: { display: 'none' } }}
      >
        {({ navigation }) => <AppointmentsScreen navigation={navigation} />}
      </Drawer.Screen>
    </Drawer.Navigator>
  );
};

const AppNavigator = () => {
  const { isAuthenticated, isLoaded, userId, user } = useAuth();
  const { signOut, isSignedIn } = useClerkAuth();
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    console.log('🔄 Auth state changed - isLoaded:', isLoaded, 'isAuthenticated:', isAuthenticated, 'userId:', userId, 'isSignedIn:', isSignedIn);
    if (isLoaded) {
      checkAuthStatus();
    }
  }, [isLoaded, isAuthenticated, userId, isSignedIn]);

  // Separate effect to handle navigation when auth state changes and user is authenticated
  useEffect(() => {
    if (isLoaded && isAuthenticated && userId && !isLoading) {
      console.log('🚀 User authenticated, checking navigation...', 'needsOnboarding:', needsOnboarding);
      
      // Check if user has data - if so, they should go to MainApp regardless of onboarding flag
      const checkAndNavigate = async () => {
        const hasData = await onboardingService.hasAnyMedications(userId);
        const shouldShowMainApp = !needsOnboarding || hasData;
        
        if (navigationRef.current?.isReady()) {
          // Wait a bit for state to settle
          setTimeout(() => {
            const currentRoute = navigationRef.current?.getCurrentRoute();
            console.log('📍 Current route:', currentRoute?.name);
            
            // If we're on Login, SignUp, Welcome, or Onboarding screens but user is authenticated with data, go to MainApp
            if ((currentRoute?.name === 'Login' || currentRoute?.name === 'SignUp' || 
                 currentRoute?.name === 'Welcome' || currentRoute?.name === 'Onboarding' ||
                 currentRoute?.name === 'AddFirstMedication') && shouldShowMainApp) {
              console.log('🔄 Navigating away from', currentRoute.name, 'to MainApp (user has data)');
              navigationRef.current?.dispatch(
                CommonActions.reset({
                  index: 0,
                  routes: [{ name: 'MainApp' }],
                })
              );
            } else if (currentRoute?.name === 'Login' || currentRoute?.name === 'SignUp') {
              // If on login/signup but should show onboarding
              if (needsOnboarding && !hasData) {
                console.log('📝 Navigating to Onboarding');
                navigationRef.current?.dispatch(
                  CommonActions.reset({
                    index: 0,
                    routes: [{ name: 'Onboarding' }],
                  })
                );
              }
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
                routes: [{ name: 'Onboarding' }],
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
      
      if (!isLoaded) {
        console.log('⏳ Waiting for Clerk to load...');
        return; // Wait for Clerk to load
      }

      // Check if onboarding is completed first
      const completed = await onboardingService.hasCompletedOnboarding();
      console.log('📋 Onboarding completed:', completed);
      
      // Check if there's any data (medications) - for guest users or if onboarding not completed
      const hasData = await onboardingService.hasAnyMedications(userId || null);
      console.log('💊 Has medications data:', hasData, 'for userId:', userId);
      
      // If user is authenticated AND has data, always show MainApp (skip onboarding)
      // Even if onboarding flag is not set, if they have medications, they've already set up the app
      if (isAuthenticated && userId && hasData) {
        console.log('✅ User authenticated with data - showing MainApp (skipping onboarding)');
        setNeedsOnboarding(false);
        setIsLoading(false);
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
      
      // If no data exists AND onboarding not completed, show onboarding
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
    console.log('🟢 Current auth state - isAuthenticated:', isAuthenticated, 'userId:', userId);
    
    // Wait for Clerk to fully update state
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Force a re-check of auth status
    // The useEffect will also trigger when isAuthenticated/userId changes
    // but we force a check here to ensure immediate update
    await checkAuthStatus();
    
    // If user is authenticated and we have userId, ensure we're not showing onboarding
    // unless they truly need it (no data and onboarding not completed)
    if (isAuthenticated && userId) {
      const hasData = await onboardingService.hasAnyMedications(userId);
      const completed = await onboardingService.hasCompletedOnboarding();
      
      if (hasData || completed) {
        setNeedsOnboarding(false);
        setIsLoading(false);
        
        // Force navigation to MainApp
        if (navigationRef.current?.isReady()) {
          navigationRef.current?.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: 'MainApp' }],
            })
          );
        }
      }
    }
  };

  const handleSignUpSuccess = async () => {
    // Wait a bit for Clerk to update state
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Onboarding is completed after signup (migration happens in SignUpScreen)
    setNeedsOnboarding(false);
    
    // Reset navigation to MainApp
    if (navigationRef.current?.isReady()) {
      setTimeout(() => {
        navigationRef.current?.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: 'MainApp' }],
          })
        );
      }, 100);
    }
  };

  const handleOnboardingComplete = () => {
    setNeedsOnboarding(false);
  };

  const handleLogout = async () => {
    console.log('🔴 AppNavigator handleLogout called');
    try {
      // Sign out from Clerk first
      console.log('🔴 Signing out from Clerk...');
      await signOut();
      console.log('✅ Signed out from Clerk');
      
      // Clear all guest data from database
      console.log('🔴 Clearing guest data from database...');
      try {
        await databaseService.ensureInitialized();
        if (databaseService.db) {
          // Get guest record IDs before deletion (for sync_queue cleanup)
          const guestMedications = await databaseService.db.getAllAsync('SELECT id FROM medications WHERE user_id = ?', ['guest']);
          const guestDoseLogs = await databaseService.db.getAllAsync('SELECT id FROM dose_logs WHERE user_id = ?', ['guest']);
          const guestAppointments = await databaseService.db.getAllAsync('SELECT id FROM appointments WHERE user_id = ?', ['guest']);
          
          // Delete all guest data
          await databaseService.db.runAsync('DELETE FROM medications WHERE user_id = ?', ['guest']);
          await databaseService.db.runAsync('DELETE FROM dose_logs WHERE user_id = ?', ['guest']);
          await databaseService.db.runAsync('DELETE FROM refills WHERE user_id = ?', ['guest']);
          await databaseService.db.runAsync('DELETE FROM vitals_logs WHERE user_id = ?', ['guest']);
          await databaseService.db.runAsync('DELETE FROM health_logs WHERE user_id = ?', ['guest']);
          await databaseService.db.runAsync('DELETE FROM appointments WHERE user_id = ?', ['guest']);
          await databaseService.db.runAsync('DELETE FROM questionnaire_answers WHERE user_id = ?', ['guest']);
          
          // Clean up sync_queue items for guest records (they won't sync anyway)
          for (const med of guestMedications) {
            await databaseService.db.runAsync(
              'DELETE FROM sync_queue WHERE table_name = ? AND record_id = ?',
              ['medications', med.id]
            );
          }
          for (const log of guestDoseLogs) {
            await databaseService.db.runAsync(
              'DELETE FROM sync_queue WHERE table_name = ? AND record_id = ?',
              ['dose_logs', log.id]
            );
          }
          for (const appt of guestAppointments) {
            await databaseService.db.runAsync(
              'DELETE FROM sync_queue WHERE table_name = ? AND record_id = ?',
              ['appointments', appt.id]
            );
          }
          
          console.log('✅ Guest data cleared from database');
        }
      } catch (dbError) {
        console.warn('⚠️ Error clearing guest data from database:', dbError);
        // Continue anyway
      }
      
      // Clear onboarding flags and questionnaire
      console.log('🔴 Clearing onboarding data...');
      await AsyncStorage.multiRemove([
        'onboarding_completed',
        'onboarding_questionnaire',
      ]);
      console.log('✅ Onboarding data cleared');
      
      // Don't manually set needsOnboarding - let checkAuthStatus determine it
      // After logout, user is not authenticated, so checkAuthStatus will show onboarding
      setIsLoading(false);
      
      // Wait for Clerk state to update, then checkAuthStatus will determine navigation
      setTimeout(() => {
        checkAuthStatus();
      }, 300);
    } catch (error) {
      console.error('❌ Error logging out:', error);
    }
  };

  if (isLoading) {
    return null;
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <NotificationHandler />
      <Stack.Navigator
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

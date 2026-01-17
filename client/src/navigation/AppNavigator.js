import React, { useState, useEffect, useRef } from 'react';
import { View, Text } from 'react-native';
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
import { useAuth } from '../context/AuthContext';
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
import FloatingActionButton from '../components/FloatingActionButton';
import AppHeader from '../components/AppHeader';

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
    <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#4285F4',
          tabBarInactiveTintColor: '#999',
          tabBarStyle: {
            height: 80,
            paddingBottom: 12,
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: '#e0e0e0',
            borderRadius: 0,
          },
        }}
      >
        <Tab.Screen
          name="Dashboard"
          options={{
            tabBarLabel: 'Dashboard',
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="dashboard" size={size} color={color} />
            ),
          }}
        >
          {() => <DashboardScreenWithHeader navigation={navigation} />}
        </Tab.Screen>
        <Tab.Screen
          name="Calendar"
          options={{
            tabBarLabel: 'Calendar',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="calendar-outline" size={size} color={color} />
            ),
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
            tabBarLabel: 'Metrics',
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="analytics" size={size} color={color} />
            ),
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
          name="ProfileTab"
          options={{
            tabBarLabel: 'Profile',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="person-circle-outline" size={size} color={color} />
            ),
          }}
          listeners={{
            tabPress: (e) => {
              handleTabPress(
                'ProfileTab',
                'Create an account to view and edit your profile.',
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
              <ProfileScreen 
                navigation={navigation}
                userToken={authToken} 
                onLogout={onLogout} 
              />
            );
          }}
        </Tab.Screen>
        <Tab.Screen
          name="Settings"
          options={{
            tabBarLabel: 'Settings',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="settings-outline" size={size} color={color} />
            ),
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
    </SafeAreaView>
  );
};

// Dashboard with header
const DashboardScreenWithHeader = ({ navigation }) => {
  const { isAuthenticated, isAuthSync, refreshAuth } = useAuth();
  const [showCreateAccountPrompt, setShowCreateAccountPrompt] = React.useState(false);

  // Refresh auth when component mounts or becomes focused
  React.useEffect(() => {
    refreshAuth();
  }, []);

  const handleAddMedicine = () => {
    // Use isAuthenticated as primary check (most reliable)
    // isAuthSync() as fallback for immediate response
    if (isAuthenticated || isAuthSync()) {
      navigation.navigate('AddMedicine');
    } else {
      setShowCreateAccountPrompt(true);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <AppHeader navigation={navigation} />
      <DashboardScreen />
      <FloatingActionButton onPress={handleAddMedicine} />
      {showCreateAccountPrompt && (
        <CreateAccountPrompt
          visible={showCreateAccountPrompt}
          onClose={() => setShowCreateAccountPrompt(false)}
          message="Create an account to add medications and sync them across devices."
        />
      )}
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
  const { isAuthenticated, authToken, updateAuth, refreshAuth } = useAuth();
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  // Re-check auth status periodically (when app comes to foreground)
  useEffect(() => {
    const interval = setInterval(() => {
      checkAuthStatus();
    }, 2000); // Check every 2 seconds
    
    return () => clearInterval(interval);
  }, []);

  const checkAuthStatus = async () => {
    try {
      // Refresh auth from context (uses cache for speed)
      await refreshAuth();
      
      const userData = await AsyncStorage.getItem('userData');
      const parsedUserData = userData ? JSON.parse(userData) : null;
      const userId = parsedUserData?.id || parsedUserData?.user?.id || null;
      
      // Check if there's any data (medications) - this is the key check
      const hasData = await onboardingService.hasAnyMedications(userId);
      
      // If no data exists, always show onboarding (Get Started page)
      if (!hasData) {
        setNeedsOnboarding(true);
        setIsLoading(false);
        return;
      }
      
      // If data exists, check if onboarding is completed
      const completed = await onboardingService.hasCompletedOnboarding();
      
      if (authToken && userData) {
        // Authenticated user with data - show MainApp if onboarding completed
        setNeedsOnboarding(!completed);
      } else {
        // No token but has data (guest mode) - show MainApp if onboarding completed
        if (completed) {
          setNeedsOnboarding(false); // Onboarding done, show MainApp
        } else {
          // Has data but onboarding not completed - show onboarding
          setNeedsOnboarding(true);
        }
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
      // On error, default to showing onboarding
      setNeedsOnboarding(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginSuccess = async () => {
    const token = await AsyncStorage.getItem('authToken');
    const userData = await AsyncStorage.getItem('userData');
    
    // Update auth context (updates cache immediately)
    if (token) {
      await updateAuth(token);
    }
    
    // Check if onboarding is completed
    const completed = await onboardingService.hasCompletedOnboarding();
    setNeedsOnboarding(!completed);
    
    // Reset navigation to MainApp if onboarding is complete
    if (completed && navigationRef.current?.isReady()) {
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

  const handleSignUpSuccess = async (user, token) => {
    // Update auth context (updates cache immediately)
    if (token) {
      await updateAuth(token);
    }
    
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
      // Clear auth data
      console.log('🔴 Clearing userData...');
      await AsyncStorage.removeItem('userData');
      console.log('🔴 Clearing authToken...');
      await AsyncStorage.removeItem('authToken');
      console.log('🔴 Updating auth context...');
      await updateAuth(null); // This clears auth token and updates context
      console.log('🔴 Auth context updated');
      
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
      
      // Navigate to Login screen first
      if (navigationRef.current?.isReady()) {
        console.log('🔴 Navigating to Login screen...');
        try {
          // Try to navigate first
          navigationRef.current.navigate('Login');
          console.log('🔴 Navigated to Login');
          
          // Then reset the navigation stack after a short delay
          setTimeout(() => {
            console.log('🔴 Resetting navigation stack...');
            navigationRef.current.dispatch(
              CommonActions.reset({
                index: 0,
                routes: [{ name: 'Login' }],
              })
            );
            console.log('🔴 Navigation stack reset');
          }, 200);
        } catch (navError) {
          console.error('❌ Navigation error during logout:', navError);
          // Fallback: set needsOnboarding to trigger re-render
          console.log('🔴 Using fallback: setting needsOnboarding to true');
          setNeedsOnboarding(true);
        }
      } else {
        console.warn('⚠️ Navigation ref not ready, setting needsOnboarding to true');
        setNeedsOnboarding(true);
      }
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

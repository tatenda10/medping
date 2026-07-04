import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ClerkProvider } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import AppNavigator from './src/navigation/AppNavigator';
import notificationService from './src/services/notificationService';
import databaseService from './src/services/databaseService';
import syncService from './src/services/syncService';
import backgroundTaskService from './src/services/backgroundTaskService';
import firebaseService from './src/services/firebaseService';
import { AuthProvider } from './src/context/AuthContext';
import { SubscriptionProvider } from './src/context/SubscriptionContext';
import "./global.css"

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

if (!publishableKey) {
  throw new Error('Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in client/.env');
}

export default function App() {
  useEffect(() => {
    const initializeApp = async () => {
      // Initialize local database
      try {
        await databaseService.init();
        console.log('✅ Database initialized');
      } catch (error) {
        console.error('❌ Database initialization failed:', error);
      }

      // Request notification permissions
      await notificationService.requestPermissions();

      // Ensure database is initialized before starting sync
      await databaseService.ensureInitialized();

      // Register background task for notifications and missed dose checking
      await backgroundTaskService.registerBackgroundTask();

      // Start auto-sync (only after database is ready)
      syncService.startAutoSync();

      // Initial sync if online
      const online = await syncService.isOnline();
      if (online) {
        await syncService.syncAll();
      }
    };

    initializeApp();

    // Cleanup on unmount
    return () => {
      syncService.stopAutoSync();
      // Note: We don't unregister background task on unmount
      // as it should continue running when app is closed
    };
  }, []);

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <AuthProvider>
        <SubscriptionProvider>
          <AppNavigator />
          <StatusBar style="auto" />
        </SubscriptionProvider>
      </AuthProvider>
    </ClerkProvider>
  );
}

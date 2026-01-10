import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import AppNavigator from './src/navigation/AppNavigator';
import notificationService from './src/services/notificationService';
import databaseService from './src/services/databaseService';
import syncService from './src/services/syncService';
import firebaseService from './src/services/firebaseService';
import { AuthProvider } from './src/context/AuthContext';
import "./global.css"

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
    };
  }, []);

  return (
    <AuthProvider>
      <AppNavigator />
      <StatusBar style="auto" />
    </AuthProvider>
  );
}


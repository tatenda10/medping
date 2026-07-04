/**
 * Utility function to clear all local data from the app
 * Can be called from React Native components
 * 
 * Usage:
 *   import clearAllData from '../utils/clearAllData';
 *   await clearAllData();
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Alert } from 'react-native';
import databaseService from '../services/databaseService';

/**
 * Clear all local data
 * @param {boolean} showAlert - Whether to show success/error alerts
 * @returns {Promise<void>}
 */
export default async function clearAllData(showAlert = false) {
  try {
    console.log('🧹 Starting to clear all local data...\n');

    // Step 1: Clear AsyncStorage
    console.log('📦 Step 1: Clearing AsyncStorage...');
    const keysToRemove = [
      'authToken',
      'userData',
      'onboarding_completed',
      'onboarding_questionnaire',
      'pending_post_onboarding_paywall',
    ];

    // Get all keys to see what's stored
    const allKeys = await AsyncStorage.getAllKeys();
    console.log(`   Found ${allKeys.length} keys in AsyncStorage`);
    
    // Remove specific keys
    await AsyncStorage.multiRemove(keysToRemove);
    console.log('   ✅ Removed:', keysToRemove.join(', '));

    // Step 2: Clear local database (only on native platforms)
    if (Platform.OS !== 'web') {
      console.log('\n💾 Step 2: Clearing local database...');
      
      try {
        await databaseService.ensureInitialized();
        
        if (databaseService.db) {
          // List of all tables to clear
          const tables = [
            'medications',
            'dose_logs',
            'refills',
            'health_logs',
            'vitals_logs',
            'appointments',
            'questionnaire_answers',
            'sync_queue',
          ];

          // Delete all data from each table
          for (const table of tables) {
            try {
              await databaseService.db.runAsync(`DELETE FROM ${table}`);
              const count = await databaseService.db.getAllAsync(`SELECT COUNT(*) as count FROM ${table}`);
              console.log(`   ✅ Cleared table: ${table} (${count[0]?.count || 0} rows remaining)`);
            } catch (error) {
              console.warn(`   ⚠️  Error clearing ${table}:`, error.message);
            }
          }

          console.log('   ✅ All database tables cleared');
        } else {
          console.log('   ⚠️  Database not initialized (may not exist yet)');
        }
      } catch (dbError) {
        console.warn('   ⚠️  Could not clear database:', dbError.message);
        console.log('   ℹ️  Database may not exist or may be locked');
      }
    } else {
      console.log('\n💾 Step 2: Skipping database (web platform)');
    }

    console.log('\n✅ All local data cleared successfully!');
    
    if (showAlert) {
      Alert.alert(
        'Data Cleared',
        'All local data has been cleared successfully.',
        [{ text: 'OK' }]
      );
    }

    return true;
  } catch (error) {
    console.error('❌ Error clearing data:', error);
    
    if (showAlert) {
      Alert.alert(
        'Error',
        `Failed to clear data: ${error.message}`,
        [{ text: 'OK' }]
      );
    }
    
    throw error;
  }
}


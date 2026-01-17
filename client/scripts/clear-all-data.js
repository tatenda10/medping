/**
 * Script to clear all local data from the app
 * This includes:
 * - AsyncStorage (authToken, userData, onboarding flags)
 * - Local SQLite database (all tables)
 * 
 * Usage:
 *   node scripts/clear-all-data.js
 * 
 * Or in React Native:
 *   import clearAllData from './scripts/clear-all-data';
 *   await clearAllData();
 */

const AsyncStorage = require('@react-native-async-storage/async-storage');
const { Platform } = require('react-native');

// Import database service
const DatabaseService = require('../src/services/databaseService').default;
const databaseService = new DatabaseService();

/**
 * Clear all local data
 */
async function clearAllData() {
  console.log('🧹 Starting to clear all local data...\n');

  try {
    // Step 1: Clear AsyncStorage
    console.log('📦 Step 1: Clearing AsyncStorage...');
    const keysToRemove = [
      'authToken',
      'userData',
      'onboarding_completed',
      'onboarding_questionnaire',
    ];

    // Get all keys to see what's stored
    const allKeys = await AsyncStorage.getAllKeys();
    console.log(`   Found ${allKeys.length} keys in AsyncStorage`);
    
    // Remove specific keys
    await AsyncStorage.multiRemove(keysToRemove);
    console.log('   ✅ Removed:', keysToRemove.join(', '));

    // Optionally remove all keys (uncomment if needed)
    // await AsyncStorage.clear();
    // console.log('   ✅ Cleared all AsyncStorage keys');

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
    console.log('\n📝 Summary:');
    console.log('   - AsyncStorage: Cleared');
    if (Platform.OS !== 'web') {
      console.log('   - Local Database: Cleared');
    }
    console.log('\n🔄 You may need to restart the app for changes to take effect.');

  } catch (error) {
    console.error('❌ Error clearing data:', error);
    throw error;
  }
}

// If running as a script
if (require.main === module) {
  clearAllData()
    .then(() => {
      console.log('\n✨ Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Failed:', error);
      process.exit(1);
    });
}

// Export for use in React Native
module.exports = clearAllData;


import * as Network from 'expo-network';
import axios from 'axios';
import BASE_URL from '../context/Api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import databaseService from './databaseService';

class SyncService {
  constructor() {
    this.isSyncing = false;
    this.syncInterval = null;
  }

  /**
   * Check if device is online
   */
  async isOnline() {
    try {
      const networkState = await Network.getNetworkStateAsync();
      return networkState.isConnected && networkState.isInternetReachable;
    } catch (error) {
      console.error('Error checking network state:', error);
      return false;
    }
  }

  /**
   * Start automatic sync (runs every 30 seconds when online)
   */
  startAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(async () => {
      const online = await this.isOnline();
      if (online && !this.isSyncing) {
        await this.syncAll();
      }
    }, 30000); // Sync every 30 seconds
  }

  /**
   * Stop automatic sync
   */
  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Sync all pending data
   */
  async syncAll() {
    if (this.isSyncing) {
      return;
    }

    const online = await this.isOnline();
    if (!online) {
      console.log('📴 Offline - skipping sync');
      return;
    }

    this.isSyncing = true;
    console.log('🔄 Starting sync...');

    try {
      // Ensure database is initialized before any sync operations
      await databaseService.ensureInitialized();
      
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        console.log('❌ No auth token - skipping sync');
        this.isSyncing = false;
        return;
      }

      // Sync medications
      await this.syncMedications(token);

      // Sync dose logs
      await this.syncDoseLogs(token);

      // Sync queue operations
      await this.syncQueue(token);

      // Fetch latest data from server
      await this.fetchLatestData(token);

      console.log('✅ Sync completed');
    } catch (error) {
      console.error('❌ Sync error:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Sync medications to server
   */
  async syncMedications(token) {
    try {
      // Ensure database is initialized
      await databaseService.ensureInitialized();
      const unsyncedMedications = await databaseService.getUnsyncedMedications();

      for (const medication of unsyncedMedications) {
        try {
          // Check if it's a new medication or update
          const existing = await databaseService.getMedicationById(medication.id);
          const isNew = !existing || !existing.server_synced;

          if (isNew) {
            // Create on server
            const response = await axios.post(
              `${BASE_URL}/medications`,
              medication,
              { headers: { 'Authorization': `Bearer ${token}` } }
            );

            if (response.data.success) {
              // Update local record with server data
              const serverMedication = response.data.medication;
              await databaseService.saveMedication(serverMedication, false);
              await databaseService.markMedicationSynced(medication.id);
              console.log(`✅ Synced medication: ${medication.name}`);
            }
          } else {
            // Update on server
            const response = await axios.put(
              `${BASE_URL}/medications/${medication.id}`,
              medication,
              { headers: { 'Authorization': `Bearer ${token}` } }
            );

            if (response.data.success) {
              await databaseService.markMedicationSynced(medication.id);
              console.log(`✅ Updated medication: ${medication.name}`);
            }
          }
        } catch (error) {
          console.error(`❌ Error syncing medication ${medication.id}:`, error);
          // Continue with next medication
        }
      }
    } catch (error) {
      console.error('Error syncing medications:', error);
    }
  }

  /**
   * Sync dose logs to server
   */
  async syncDoseLogs(token) {
    try {
      // Ensure database is initialized
      await databaseService.ensureInitialized();
      const unsyncedDoseLogs = await databaseService.getUnsyncedDoseLogs();

      for (const doseLog of unsyncedDoseLogs) {
        try {
          // Skip test medications (medication_id starting with "test-")
          if (doseLog.medication_id && doseLog.medication_id.startsWith('test-')) {
            console.log(`⏭️ Skipping test dose log: ${doseLog.id}`);
            // Mark as synced to avoid retrying
            await databaseService.markDoseLogSynced(doseLog.id);
            continue;
          }

          const response = await axios.post(
            `${BASE_URL}/dose-logs`,
            {
              medication_id: doseLog.medication_id,
              scheduled_time: doseLog.scheduled_time,
              status: doseLog.status,
              notes: doseLog.notes,
            },
            { headers: { 'Authorization': `Bearer ${token}` } }
          );

          if (response.data.success) {
            await databaseService.markDoseLogSynced(doseLog.id);
            console.log(`✅ Synced dose log: ${doseLog.id}`);
          }
        } catch (error) {
          // Handle 404 (medication not found) or 400 (validation error) by marking as synced
          // to avoid infinite retry loops
          if (error.response?.status === 404 || error.response?.status === 400) {
            console.log(`⚠️ Dose log ${doseLog.id} cannot be synced (medication not found or invalid), marking as synced`);
            await databaseService.markDoseLogSynced(doseLog.id);
          } else {
            console.error(`❌ Error syncing dose log ${doseLog.id}:`, error.response?.status || error.message);
            // Continue with next dose log
          }
        }
      }
    } catch (error) {
      console.error('Error syncing dose logs:', error);
    }
  }

  /**
   * Sync queue operations (for deleted items, etc.)
   */
  async syncQueue(token) {
    try {
      // Ensure database is initialized
      await databaseService.ensureInitialized();
      const queue = await databaseService.getSyncQueue();

      for (const item of queue) {
        try {
          const data = JSON.parse(item.data);

          if (item.operation_type === 'delete' && item.table_name === 'medications') {
            // Delete medication on server
            try {
              await axios.delete(
                `${BASE_URL}/medications/${item.record_id}`,
                { headers: { 'Authorization': `Bearer ${token}` } }
              );
              await databaseService.removeFromSyncQueue(item.id);
              console.log(`✅ Deleted medication on server: ${item.record_id}`);
            } catch (error) {
              if (error.response?.status === 404) {
                // Already deleted on server
                await databaseService.removeFromSyncQueue(item.id);
              } else {
                await databaseService.incrementSyncRetry(item.id);
              }
            }
          }
        } catch (error) {
          console.error(`❌ Error syncing queue item ${item.id}:`, error);
          await databaseService.incrementSyncRetry(item.id);
        }
      }
    } catch (error) {
      console.error('Error syncing queue:', error);
    }
  }

  /**
   * Fetch latest data from server and merge with local
   */
  async fetchLatestData(token) {
    try {
      // Ensure database is initialized
      await databaseService.ensureInitialized();
      // Fetch medications from server
      const response = await axios.get(`${BASE_URL}/medications`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.data.success) {
        const serverMedications = response.data.medications || [];

        for (const serverMed of serverMedications) {
          const localMed = await databaseService.getMedicationById(serverMed.id);

          if (!localMed || !localMed.server_synced) {
            // Server has newer data, update local
            await databaseService.saveMedication(serverMed, false);
            await databaseService.markMedicationSynced(serverMed.id);
          } else if (localMed.updated_at < serverMed.updated_at) {
            // Server has newer version, update local
            await databaseService.saveMedication(serverMed, false);
            await databaseService.markMedicationSynced(serverMed.id);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching latest data:', error);
    }
  }

  /**
   * Force immediate sync
   */
  async forceSync() {
    await this.syncAll();
  }
}

export default new SyncService();


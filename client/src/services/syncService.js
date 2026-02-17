import * as Network from 'expo-network';
import { clerkAxios, checkAuthentication } from '../utils/clerkAxios';
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
   * Check if user is authenticated by trying to get a token
   */
  async isAuthenticated() {
    return await checkAuthentication();
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

    // Check if user is authenticated before attempting sync
    const authenticated = await this.isAuthenticated();
    if (!authenticated) {
      console.log('🔒 User not authenticated - skipping sync');
      return;
    }

    this.isSyncing = true;
    console.log('🔄 Starting sync...');

    try {
      // Ensure database is initialized before any sync operations
      await databaseService.ensureInitialized();

      // Sync medications
      await this.syncMedications();

      // Sync dose logs
      await this.syncDoseLogs();

      // Sync queue operations
      await this.syncQueue();

      // Fetch latest data from server
      await this.fetchLatestData();

      console.log('✅ Sync completed');
    } catch (error) {
      // Better error handling
      if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
        console.log('📴 Network error - server may be unreachable or CORS issue');
      } else if (error.response?.status === 401) {
        console.log('🔒 Not authenticated - skipping sync');
      } else {
        console.error('❌ Sync error:', error.message || error);
      }
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Compare two timestamps and return which is newer
   * Returns: 'local' | 'server' | 'equal'
   */
  compareTimestamps(localTimestamp, serverTimestamp) {
    if (!localTimestamp && !serverTimestamp) return 'equal';
    if (!localTimestamp) return 'server';
    if (!serverTimestamp) return 'local';
    
    const localDate = new Date(localTimestamp);
    const serverDate = new Date(serverTimestamp);
    
    if (isNaN(localDate.getTime()) || isNaN(serverDate.getTime())) {
      // If timestamps are invalid, assume local is newer to preserve local changes
      return 'local';
    }
    
    if (localDate.getTime() > serverDate.getTime()) {
      return 'local';
    } else if (serverDate.getTime() > localDate.getTime()) {
      return 'server';
    }
    return 'equal';
  }

  /**
   * Sync medications to server with conflict resolution
   */
  async syncMedications() {
    try {
      // Ensure database is initialized
      await databaseService.ensureInitialized();
      const unsyncedMedications = await databaseService.getUnsyncedMedications();

      // Only sync medications that belong to authenticated users (not guest)
      const userMedications = unsyncedMedications.filter(med => med.user_id !== 'guest');
      
      if (userMedications.length === 0) {
        return; // No medications to sync
      }

      for (const medication of userMedications) {
        try {
          // Check if it's a new medication or update
          const existing = await databaseService.getMedicationById(medication.id);
          const isNew = !existing || !existing.server_synced;

          if (isNew) {
            // Create on server (new medications don't have conflicts)
            const response = await clerkAxios.post(
              `/medications`,
              medication
            );

            if (response.data.success) {
              // Update local record with server data
              const serverMedication = response.data.medication;
              await databaseService.saveMedication(serverMedication, false);
              await databaseService.markMedicationSynced(medication.id);
              console.log(`✅ Synced medication: ${medication.name}`);
            }
          } else {
            // For existing medications, check for conflicts before updating
            // Fetch server version first to compare timestamps
            let serverMedication = null;
            try {
              const serverResponse = await clerkAxios.get(`/medications/${medication.id}`);
              if (serverResponse.data.success && serverResponse.data.medication) {
                serverMedication = serverResponse.data.medication;
              }
            } catch (fetchError) {
              // If medication doesn't exist on server (404), treat as new
              if (fetchError.response?.status === 404) {
                console.log(`⚠️ Medication ${medication.id} not found on server, creating...`);
                // Create it as new
                const createResponse = await clerkAxios.post(`/medications`, medication);
                if (createResponse.data.success) {
                  const newServerMed = createResponse.data.medication;
                  await databaseService.saveMedication(newServerMed, false);
                  await databaseService.markMedicationSynced(medication.id);
                  console.log(`✅ Created medication on server: ${medication.name}`);
                }
                continue;
              }
              // For other errors, proceed with update attempt
              console.log(`⚠️ Could not fetch server version for ${medication.id}, proceeding with update`);
            }

            // Compare timestamps if we have server version
            if (serverMedication) {
              const comparison = this.compareTimestamps(
                medication.updated_at,
                serverMedication.updated_at
              );

              if (comparison === 'server') {
                // Server has newer version, update local with server data
                console.log(`🔄 Server has newer version of ${medication.name}, updating local...`);
                await databaseService.saveMedication(serverMedication, false);
                await databaseService.markMedicationSynced(medication.id);
                console.log(`✅ Updated local medication from server: ${medication.name}`);
                continue; // Skip sending local update
              } else if (comparison === 'equal') {
                // Timestamps are equal, mark as synced (no changes needed)
                console.log(`✅ Medication ${medication.name} is already in sync`);
                await databaseService.markMedicationSynced(medication.id);
                continue;
              }
              // If local is newer, proceed with sending update
            }

            // Send local update to server (local is newer or server version unavailable)
            try {
              const response = await clerkAxios.put(
                `/medications/${medication.id}`,
                medication
              );

              if (response.data.success) {
                // Update local with server response (in case server made any modifications)
                if (response.data.medication) {
                  await databaseService.saveMedication(response.data.medication, false);
                }
                await databaseService.markMedicationSynced(medication.id);
                console.log(`✅ Updated medication on server: ${medication.name}`);
              }
            } catch (updateError) {
              // Handle conflict errors (409)
              if (updateError.response?.status === 409) {
                console.log(`⚠️ Conflict detected for ${medication.name}, resolving...`);
                // Fetch latest server version and compare again
                try {
                  const conflictResponse = await clerkAxios.get(`/medications/${medication.id}`);
                  if (conflictResponse.data.success && conflictResponse.data.medication) {
                    const latestServer = conflictResponse.data.medication;
                    const conflictComparison = this.compareTimestamps(
                      medication.updated_at,
                      latestServer.updated_at
                    );

                    if (conflictComparison === 'server' || conflictComparison === 'equal') {
                      // Server is newer or equal, use server version
                      console.log(`🔄 Resolving conflict: using server version for ${medication.name}`);
                      await databaseService.saveMedication(latestServer, false);
                      await databaseService.markMedicationSynced(medication.id);
                    } else {
                      // Local is still newer, try update again with latest server data merged
                      console.log(`🔄 Resolving conflict: local is newer, retrying update for ${medication.name}`);
                      // Merge local changes with server data (keep local changes but use server's updated_at)
                      const mergedMedication = {
                        ...medication,
                        updated_at: new Date().toISOString(), // Use current time to indicate this is newer
                      };
                      const retryResponse = await clerkAxios.put(
                        `/medications/${medication.id}`,
                        mergedMedication
                      );
                      if (retryResponse.data.success) {
                        if (retryResponse.data.medication) {
                          await databaseService.saveMedication(retryResponse.data.medication, false);
                        }
                        await databaseService.markMedicationSynced(medication.id);
                        console.log(`✅ Resolved conflict and updated: ${medication.name}`);
                      }
                    }
                  }
                } catch (resolveError) {
                  console.error(`❌ Error resolving conflict for ${medication.id}:`, resolveError.message);
                  // Mark as synced to prevent infinite retry loop
                  await databaseService.markMedicationSynced(medication.id);
                }
              } else {
                throw updateError; // Re-throw non-conflict errors
              }
            }
          }
        } catch (error) {
          // Better error handling
          if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
            console.log(`📴 Network error syncing medication ${medication.id} - server may be unreachable`);
            // Don't log as error, just continue - will retry later
          } else if (error.response?.status === 401) {
            console.log(`🔒 Not authenticated - skipping sync for medication ${medication.id}`);
            // Don't continue syncing if not authenticated
            break;
          } else {
            console.error(`❌ Error syncing medication ${medication.id}:`, error.message || error);
            // Continue with next medication for other errors
          }
        }
      }
    } catch (error) {
      if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
        console.log('📴 Network error - server may be unreachable');
      } else {
        console.error('Error syncing medications:', error);
      }
    }
  }

  /**
   * Sync dose logs to server
   */
  async syncDoseLogs() {
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

          const response = await clerkAxios.post(
            `/dose-logs`,
            {
              medication_id: doseLog.medication_id,
              scheduled_time: doseLog.scheduled_time,
              status: doseLog.status,
              notes: doseLog.notes,
            }
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
  async syncQueue() {
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
              await clerkAxios.delete(
                `/medications/${item.record_id}`
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
  async fetchLatestData() {
    try {
      // Check if user is authenticated before attempting fetch
      const authenticated = await this.isAuthenticated();
      if (!authenticated) {
        console.log('🔒 User not authenticated - skipping fetch latest data');
        return;
      }

      // Ensure database is initialized
      await databaseService.ensureInitialized();
      
      // Fetch medications from server with retry logic
      let response;
      let retries = 3;
      let lastError;
      
      while (retries > 0) {
        try {
          response = await clerkAxios.get(`/medications`);
          break; // Success, exit retry loop
        } catch (error) {
          lastError = error;
          retries--;
          
          if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
            if (retries > 0) {
              console.log(`📴 Network error fetching medications, retrying... (${retries} attempts left)`);
              // Wait a bit before retrying
              await new Promise(resolve => setTimeout(resolve, 1000));
            } else {
              console.log('📴 Network error fetching latest data - server may be unreachable or temporarily unavailable');
              return; // Give up after retries
            }
          } else if (error.response?.status === 401) {
            console.log('🔒 Not authenticated - skipping fetch');
            return; // Don't retry auth errors
          } else {
            // Other errors - don't retry
            throw error;
          }
        }
      }
      
      if (!response) {
        // All retries failed
        return;
      }

      if (response.data.success) {
        const serverMedications = response.data.medications || [];

        for (const serverMed of serverMedications) {
          try {
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
          } catch (saveError) {
            console.error('Error saving medication from server:', saveError);
            // Continue with next medication
          }
        }
      }
    } catch (error) {
      // Final error handling for non-network errors
      if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
        // Already handled in retry logic above
        return;
      } else if (error.response?.status === 401) {
        console.log('🔒 Not authenticated - skipping fetch');
      } else {
        console.error('Error fetching latest data:', error.message || error);
      }
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


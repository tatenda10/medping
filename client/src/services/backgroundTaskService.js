import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import databaseService from './databaseService';
import notificationService from './notificationService';
import syncService from './syncService';
import { format, addMinutes, isBefore, startOfDay, endOfDay } from 'date-fns';

const BACKGROUND_TASK_NAME = 'medication-background-task';

/**
 * Background task that runs periodically to:
 * 1. Check for missed doses and log them
 * 2. Reschedule notifications if needed
 * 3. Sync data with server
 */
TaskManager.defineTask(BACKGROUND_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('❌ Background task error:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }

  try {
    console.log('🔄 Background task started');

    // Ensure database is initialized
    await databaseService.ensureInitialized();

    // Get current user ID (check both authenticated and guest)
    let userId = null;
    try {
      const userData = await AsyncStorage.getItem('userData');
      if (userData) {
        const parsed = JSON.parse(userData);
        userId = parsed.userId || parsed.id;
      }
    } catch (e) {
      // Continue with guest check
    }

    // If no authenticated user, check for guest medications
    if (!userId) {
      userId = 'guest';
    }

    // Get all medications for this user
    const medications = await databaseService.getMedications(userId);
    
    if (medications.length === 0) {
      console.log('📭 No medications found, skipping background task');
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    let missedDosesLogged = 0;
    const now = new Date();
    const today = startOfDay(now);
    const todayStr = format(today, 'yyyy-MM-dd');

    // Check for missed doses in the last 2 hours
    // This ensures we catch doses that were missed while the app was closed
    const twoHoursAgo = addMinutes(now, -120);

    for (const medication of medications) {
      if (!medication.start_date) continue;
      
      const startDate = new Date(medication.start_date);
      const startDateStr = format(startDate, 'yyyy-MM-dd');
      if (todayStr < startDateStr) continue;
      
      if (!medication.is_continuous && medication.end_date) {
        const endDate = new Date(medication.end_date);
        const endDateStr = format(endDate, 'yyyy-MM-dd');
        if (todayStr > endDateStr) continue;
      }

      let times = medication.times_of_day;
      if (typeof times === 'string') {
        try {
          times = JSON.parse(times);
        } catch (e) {
          continue;
        }
      }
      if (!Array.isArray(times) || times.length === 0) continue;

      // Get existing dose logs for today
      const doseLogs = await databaseService.getDoseLogs(userId, medication.id);
      const todayLogs = doseLogs.filter(log => {
        const logDate = new Date(log.scheduled_time);
        return format(logDate, 'yyyy-MM-dd') === todayStr;
      });

      for (const time of times) {
        const [hours, minutes] = time.split(':').map(Number);
        const scheduledDateTime = new Date(today);
        scheduledDateTime.setHours(hours, minutes, 0, 0);

        // Only check doses that were scheduled in the past 2 hours
        if (scheduledDateTime < twoHoursAgo || scheduledDateTime > now) {
          continue;
        }

        // Check if this dose was already logged
        const matchingLog = todayLogs.find(log => {
          const logDate = new Date(log.scheduled_time);
          return (
            logDate.getHours() === hours &&
            logDate.getMinutes() === minutes
          );
        });

        // If no log exists and the scheduled time has passed, it's missed
        if (!matchingLog && isBefore(scheduledDateTime, now)) {
          // Check if it's been more than 15 minutes since scheduled time
          // This prevents logging doses that are just about to happen
          const minutesSinceScheduled = (now - scheduledDateTime) / (1000 * 60);
          if (minutesSinceScheduled >= 15) {
            // Log as missed dose
            const doseLog = {
              id: `dose_${Date.now()}_${medication.id}_${time}`,
              user_id: userId,
              medication_id: medication.id,
              scheduled_time: scheduledDateTime.toISOString(),
              status: 'missed',
              taken_time: null,
              synced: 0,
            };

            try {
              await databaseService.saveDoseLog(doseLog);
              missedDosesLogged++;
              console.log(`📝 Logged missed dose: ${medication.name} at ${time}`);
            } catch (error) {
              console.error(`Error logging missed dose for ${medication.name}:`, error);
            }
          }
        }
      }
    }

    // Reschedule notifications if needed (check if we have enough scheduled)
    try {
      const scheduledCount = await notificationService.getScheduledNotificationCount();
      if (scheduledCount < 50) {
        // If we have very few notifications, reschedule all
        console.log('🔄 Rescheduling notifications (low count detected)');
        await notificationService.rescheduleAllNotificationsWithGrouping(userId, databaseService);
      }
    } catch (error) {
      console.error('Error rescheduling notifications:', error);
    }

    // Sync data if user is authenticated (but don't fail if auth check fails)
    if (userId !== 'guest') {
      try {
        // Try to sync - if auth fails, that's okay, we'll sync when app opens
        const isAuthenticated = await syncService.isAuthenticated();
        if (isAuthenticated) {
          // Only sync if we're online and authenticated
          const online = await syncService.isOnline();
          if (online) {
            await syncService.syncAll();
          }
        }
      } catch (error) {
        // Silently fail - background tasks shouldn't throw errors
        // The app will sync when it opens next time
        console.log('Background sync skipped (auth or network issue)');
      }
    }

    console.log(`✅ Background task completed - logged ${missedDosesLogged} missed doses`);
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error('❌ Background task failed:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

class BackgroundTaskService {
  /**
   * Register background fetch task
   */
  async registerBackgroundTask() {
    if (Platform.OS === 'web') {
      console.log('⚠️ Background tasks not supported on web');
      return false;
    }

    try {
      // Check if background fetch is available
      const isAvailable = await BackgroundFetch.isAvailableAsync();
      if (!isAvailable) {
        console.warn('⚠️ Background fetch is not available on this device');
        return false;
      }

      // Check current status
      const status = await BackgroundFetch.getStatusAsync();
      
      if (status === BackgroundFetch.BackgroundFetchStatus.Restricted) {
        console.warn('⚠️ Background fetch is restricted on this device');
        return false;
      }

      if (status === BackgroundFetch.BackgroundFetchStatus.Denied) {
        console.warn('⚠️ Background fetch permission denied');
        return false;
      }

      // Register the task
      await BackgroundFetch.registerTaskAsync(BACKGROUND_TASK_NAME, {
        minimumInterval: 15, // Run at least every 15 minutes
        stopOnTerminate: false, // Continue running when app is terminated
        startOnBoot: true, // Start when device boots
      });

      console.log('✅ Background task registered');
      return true;
    } catch (error) {
      console.error('❌ Error registering background task:', error);
      return false;
    }
  }

  /**
   * Unregister background fetch task
   */
  async unregisterBackgroundTask() {
    if (Platform.OS === 'web') {
      return;
    }

    try {
      const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_TASK_NAME);
      if (isRegistered) {
        await BackgroundFetch.unregisterTaskAsync(BACKGROUND_TASK_NAME);
        console.log('✅ Background task unregistered');
      }
    } catch (error) {
      console.error('❌ Error unregistering background task:', error);
    }
  }

  /**
   * Check if background task is registered
   */
  async isTaskRegistered() {
    if (Platform.OS === 'web') {
      return false;
    }

    try {
      return await TaskManager.isTaskRegisteredAsync(BACKGROUND_TASK_NAME);
    } catch (error) {
      console.error('Error checking task registration:', error);
      return false;
    }
  }

  /**
   * Get background fetch status
   */
  async getStatus() {
    if (Platform.OS === 'web') {
      return null;
    }

    try {
      return await BackgroundFetch.getStatusAsync();
    } catch (error) {
      console.error('Error getting background fetch status:', error);
      return null;
    }
  }
}

export default new BackgroundTaskService();


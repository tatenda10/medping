import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { format } from 'date-fns';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

class NotificationService {
  constructor() {
    this.notificationIds = new Map(); // Store notification IDs by medication ID
    this.setupNotificationChannel();
  }

  /**
   * Set up notification channel for Android (required for proper sound/ringing)
   */
  async setupNotificationChannel() {
    if (Platform.OS === 'android') {
      try {
        await Notifications.setNotificationChannelAsync('medication-reminders', {
          name: 'Medication Reminders',
          importance: Notifications.AndroidImportance.MAX, // MAX importance ensures sound always plays
          sound: 'default',
          vibrationPattern: [0, 250, 250, 250],
          enableVibrate: true,
          enableLights: true,
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          showBadge: true,
        });
        console.log('✅ Notification channel created with MAX importance');
      } catch (error) {
        console.error('Error setting up notification channel:', error);
      }
    }
  }

  /**
   * Request notification permissions
   */
  async requestPermissions() {
    if (!Device.isDevice) {
      console.warn('Must use physical device for Push Notifications');
      return false;
    }

    // Ensure notification channel is set up first (Android)
    await this.setupNotificationChannel();

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('Failed to get push token for push notification!');
      return false;
    }

    // Request critical alerts on iOS
    if (Platform.OS === 'ios') {
      const { status: criticalStatus } = await Notifications.getCriticalPermissionsAsync();
      if (criticalStatus !== 'granted') {
        await Notifications.requestCriticalPermissionsAsync();
      }
    }

    return finalStatus === 'granted';
  }

  /**
   * Schedule a medication reminder notification
   */
  async scheduleMedicationNotification(medication, time, date, isGrouped = false, groupedMedications = []) {
    try {
      let title, body, medicationIds;
      
      if (isGrouped && groupedMedications.length > 1) {
        // Grouped notification
        const medNames = groupedMedications.map(m => m.name).join(', ');
        title = `💊 ${groupedMedications.length} Medications Due`;
        body = `Time to take: ${medNames}`;
        medicationIds = groupedMedications.map(m => m.id);
      } else {
        // Single medication notification
        title = '💊 Medication Reminder';
        body = `Time to take ${medication.name} - ${medication.dosage}`;
        medicationIds = [medication.id];
      }

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: title,
          body: body,
          sound: true, // Use true to ensure sound always plays
          priority: Notifications.AndroidNotificationPriority.MAX,
          categoryId: isGrouped ? 'MEDICATION_REMINDER_GROUPED' : 'MEDICATION_REMINDER',
          channelId: Platform.OS === 'android' ? 'medication-reminders' : undefined,
          data: {
            medicationId: medication.id, // Primary medication ID for backward compatibility
            medicationIds: medicationIds, // Array of all medication IDs
            medicationName: medication.name,
            dosage: medication.dosage,
            time: time,
            date: date,
            isGrouped: isGrouped,
            groupedMedications: groupedMedications.map(m => ({
              id: m.id,
              name: m.name,
              dosage: m.dosage,
            })),
          },
          // Make it ring like a call - but dismissible
          ...(Platform.OS === 'android' && {
            autoCancel: true, // Can be dismissed
          }),
          ...(Platform.OS === 'ios' && {
            interruptionLevel: 'critical',
          }),
        },
        trigger: {
          type: 'date',
          date: date,
          repeats: medication.frequency === 'daily',
        },
      });

      // Store notification ID for all medications in the group
      medicationIds.forEach(medId => {
        const key = `${medId}-${time}-${date}`;
        if (!this.notificationIds.has(medId)) {
          this.notificationIds.set(medId, []);
        }
        this.notificationIds.get(medId).push({ id: notificationId, key, time, date, isGrouped });
      });

      return notificationId;
    } catch (error) {
      console.error('Error scheduling notification:', error);
      return null;
    }
  }

  /**
   * Schedule all notifications for a medication (with grouping support)
   */
  async scheduleMedicationNotifications(medication, allMedications = null) {
    try {
      // First, check how many notifications are already scheduled
      const allScheduled = await Notifications.getAllScheduledNotificationsAsync();
      const currentCount = allScheduled.length;
      const maxAllowed = 450; // Leave some room below the 500 limit
      
      // If we're close to the limit, cancel old notifications first
      if (currentCount > 300) {
        console.log(`⚠️ ${currentCount} notifications scheduled, cleaning up old ones...`);
        await this.cleanupOldNotifications();
      }
      
      // Cancel existing notifications for this medication
      await this.cancelMedicationNotifications(medication.id);

      if (!medication.times_of_day) return;

      // Parse times_of_day
      let times = medication.times_of_day;
      if (typeof times === 'string') {
        try {
          times = JSON.parse(times);
        } catch (e) {
          console.error('Error parsing times_of_day:', e);
          return;
        }
      }

      if (!Array.isArray(times) || times.length === 0) return;

      const startDate = new Date(medication.start_date);
      const endDate = medication.is_continuous ? null : (medication.end_date ? new Date(medication.end_date) : null);
      const now = new Date();
      
      // Reduce to next 30 days to stay under the 500 limit
      const maxDays = 30;
      const maxDate = endDate 
        ? new Date(Math.min(endDate.getTime(), now.getTime() + maxDays * 24 * 60 * 60 * 1000))
        : new Date(now.getTime() + maxDays * 24 * 60 * 60 * 1000);
      
      // Start from today or start_date, whichever is later
      let currentDate = new Date(Math.max(startDate.getTime(), now.getTime()));
      
      let scheduledCount = 0;
      const maxNotifications = Math.min(300, maxAllowed - currentCount); // Safety limit, respect Android limit
      
      if (maxNotifications <= 0) {
        console.warn(`⚠️ Cannot schedule notifications - limit reached (${currentCount}/500)`);
        return;
      }
      
      // If we have all medications, use grouping
      const useGrouping = allMedications && allMedications.length > 0;
      
      // Schedule for each day until maxDate
      while (currentDate <= maxDate && scheduledCount < maxNotifications) {
        for (const time of times) {
          if (scheduledCount >= maxNotifications) break;
          
          // Check current count before scheduling
          const currentScheduled = await Notifications.getAllScheduledNotificationsAsync();
          if (currentScheduled.length >= maxAllowed) {
            console.warn(`⚠️ Reached notification limit (${currentScheduled.length}/500), stopping scheduling`);
            break;
          }
          
          try {
            const [hours, minutes] = time.split(':').map(Number);
            if (isNaN(hours) || isNaN(minutes)) {
              console.warn(`Invalid time format: ${time}`);
              continue;
            }
            
            const notificationDate = new Date(currentDate);
            notificationDate.setHours(hours, minutes, 0, 0);
            
            // Only schedule future notifications
            if (notificationDate > now) {
              if (useGrouping) {
                // Find all medications due at this time
                const groupedMeds = this.findMedicationsAtTime(allMedications, time, notificationDate);
                
                if (groupedMeds.length > 1) {
                  // Schedule grouped notification
                  await this.scheduleMedicationNotification(medication, time, notificationDate, true, groupedMeds);
                  scheduledCount++;
                } else {
                  // Single medication, schedule normally
                  await this.scheduleMedicationNotification(medication, time, notificationDate, false, []);
                  scheduledCount++;
                }
              } else {
                // No grouping, schedule normally
                await this.scheduleMedicationNotification(medication, time, notificationDate, false, []);
                scheduledCount++;
              }
            }
          } catch (error) {
            // If it's the limit error, stop scheduling
            if (error.message && error.message.includes('Maximum limit')) {
              console.warn(`⚠️ Reached Android notification limit, stopping scheduling`);
              break;
            }
            console.error(`Error scheduling notification for ${time} on ${currentDate}:`, error);
            // Continue with next time
          }
        }
        
        // Break if we've hit the limit
        const currentScheduled = await Notifications.getAllScheduledNotificationsAsync();
        if (currentScheduled.length >= maxAllowed) {
          break;
        }
        
        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
        
        // If not daily, break after first day
        if (medication.frequency !== 'daily') {
          break;
        }
      }
      
      console.log(`✅ Scheduled ${scheduledCount} notifications for ${medication.name}`);
    } catch (error) {
      console.error('Error scheduling medication notifications:', error);
      // Don't throw - allow medication to be saved even if notifications fail
    }
  }

  /**
   * Find all medications due at a specific time
   */
  findMedicationsAtTime(medications, time, date) {
    const dateStr = date.toISOString().split('T')[0];
    const [hours, minutes] = time.split(':').map(Number);
    
    return medications.filter(med => {
      // Check if medication is active on this date
      const startDate = new Date(med.start_date);
      const startDateStr = startDate.toISOString().split('T')[0];
      
      if (dateStr < startDateStr) return false;
      
      if (!med.is_continuous && med.end_date) {
        const endDate = new Date(med.end_date);
        const endDateStr = endDate.toISOString().split('T')[0];
        if (dateStr > endDateStr) return false;
      }
      
      // Check if medication has this time
      let times = med.times_of_day;
      if (typeof times === 'string') {
        try {
          times = JSON.parse(times);
        } catch (e) {
          return false;
        }
      }
      
      if (!Array.isArray(times)) return false;
      
      return times.includes(time);
    });
  }

  /**
   * Reschedule all notifications with grouping (call this after adding/updating medications)
   */
  async rescheduleAllNotificationsWithGrouping(userId, databaseService) {
    try {
      // Cancel all existing notifications
      await this.cancelAllNotifications();
      
      // Get all medications
      const medications = await databaseService.getMedications(userId);
      
      // Schedule notifications for each medication (they will be grouped automatically)
      for (const medication of medications) {
        await this.scheduleMedicationNotifications(medication, medications);
      }
      
      console.log('✅ Rescheduled all notifications with grouping');
    } catch (error) {
      console.error('Error rescheduling notifications with grouping:', error);
    }
  }

  /**
   * Cancel all notifications for a medication
   */
  async cancelMedicationNotifications(medicationId) {
    try {
      const ids = this.notificationIds.get(medicationId);
      if (ids && ids.length > 0) {
        for (const { id } of ids) {
          await Notifications.cancelScheduledNotificationAsync(id);
        }
        this.notificationIds.delete(medicationId);
      }
    } catch (error) {
      console.error('Error canceling notifications:', error);
    }
  }

  /**
   * Cancel all scheduled notifications
   */
  async cancelAllNotifications() {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      this.notificationIds.clear();
    } catch (error) {
      console.error('Error canceling all notifications:', error);
    }
  }

  /**
   * Clean up old notifications (older than 7 days)
   */
  async cleanupOldNotifications() {
    try {
      const allScheduled = await Notifications.getAllScheduledNotificationsAsync();
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      let canceledCount = 0;
      for (const notification of allScheduled) {
        if (notification.trigger && notification.trigger.date) {
          const triggerDate = new Date(notification.trigger.date);
          // Cancel notifications that are in the past or older than 7 days
          if (triggerDate < sevenDaysAgo) {
            try {
              await Notifications.cancelScheduledNotificationAsync(notification.identifier);
              canceledCount++;
            } catch (error) {
              // Continue with next notification
            }
          }
        }
      }
      
      if (canceledCount > 0) {
        console.log(`🧹 Cleaned up ${canceledCount} old notifications`);
      }
    } catch (error) {
      console.error('Error cleaning up old notifications:', error);
    }
  }

  /**
   * Schedule a snooze notification
   */
  async scheduleSnoozeNotification(medication, originalTime, snoozeMinutes = 10) {
    const snoozeDate = new Date();
    snoozeDate.setMinutes(snoozeDate.getMinutes() + snoozeMinutes);

    return await this.scheduleMedicationNotification(
      medication,
      originalTime,
      snoozeDate
    );
  }

  /**
   * Get all scheduled notifications
   */
  async getAllScheduledNotifications() {
    return await Notifications.getAllScheduledNotificationsAsync();
  }

  /**
   * Get count of scheduled notifications
   */
  async getScheduledNotificationCount() {
    const notifications = await Notifications.getAllScheduledNotificationsAsync();
    return notifications.length;
  }

  /**
   * Cancel notifications for medications that no longer exist
   */
  async cancelNotificationsForDeletedMedications(activeMedicationIds) {
    try {
      const allScheduled = await Notifications.getAllScheduledNotificationsAsync();
      let canceledCount = 0;
      
      for (const notification of allScheduled) {
        const medicationId = notification.content?.data?.medicationId;
        if (medicationId && !activeMedicationIds.includes(medicationId)) {
          try {
            await Notifications.cancelScheduledNotificationAsync(notification.identifier);
            canceledCount++;
          } catch (error) {
            // Continue with next notification
          }
        }
      }
      
      if (canceledCount > 0) {
        console.log(`🧹 Canceled ${canceledCount} notifications for deleted medications`);
      }
    } catch (error) {
      console.error('Error canceling notifications for deleted medications:', error);
    }
  }

  /**
   * Send a test notification that appears like a call (rings, persistent, requires interaction)
   */
  async sendTestNotification() {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '💊 Medication Reminder',
          body: 'Time to take Test Medication - 10mg',
          sound: true, // Use true instead of 'default' to ensure sound plays
          priority: Notifications.AndroidNotificationPriority.MAX,
          categoryId: 'MEDICATION_REMINDER',
          channelId: Platform.OS === 'android' ? 'medication-reminders' : undefined,
          data: {
            medicationId: 'test-123',
            medicationName: 'Test Medication',
            dosage: '10mg',
            time: '12:00',
            date: new Date().toISOString(),
          },
          // Make it ring like a call - but dismissible
          ...(Platform.OS === 'android' && {
            autoCancel: true, // Can be dismissed
            vibrate: true,
          }),
          ...(Platform.OS === 'ios' && {
            interruptionLevel: 'critical',
          }),
        },
        trigger: null, // null means send immediately
      });
      return true;
    } catch (error) {
      console.error('Error sending test notification:', error);
      return false;
    }
  }

  /**
   * Schedule appointment reminder notification
   */
  async scheduleAppointmentReminder(appointment) {
    try {
      await this.requestPermissions();
      await this.setupNotificationChannel();

      const appointmentDate = new Date(appointment.scheduled_time);
      const reminderMinutes = appointment.reminder_minutes || 60;
      const reminderDate = new Date(appointmentDate.getTime() - reminderMinutes * 60 * 1000);

      // Don't schedule if reminder time is in the past
      if (reminderDate <= new Date()) {
        console.log('Appointment reminder time is in the past, skipping');
        return null;
      }

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: '📅 Appointment Reminder',
          body: `${appointment.title}${appointment.doctor_name ? ` with ${appointment.doctor_name}` : ''} at ${format(appointmentDate, 'h:mm a')}`,
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
          categoryId: 'APPOINTMENT_REMINDER',
          channelId: Platform.OS === 'android' ? 'medication-reminders' : undefined,
          data: {
            appointmentId: appointment.id,
            appointmentTitle: appointment.title,
            appointmentTime: appointmentDate.toISOString(),
            type: 'appointment',
          },
        },
        trigger: {
          date: reminderDate,
        },
      });

      // Store notification ID
      const ids = this.notificationIds.get(`appt_${appointment.id}`) || [];
      ids.push({ id: notificationId, type: 'appointment' });
      this.notificationIds.set(`appt_${appointment.id}`, ids);

      console.log(`✅ Scheduled appointment reminder for ${appointment.title}`);
      return notificationId;
    } catch (error) {
      console.error('Error scheduling appointment reminder:', error);
      return null;
    }
  }

  /**
   * Cancel appointment reminder notifications
   */
  async cancelAppointmentReminders(appointmentId) {
    try {
      const ids = this.notificationIds.get(`appt_${appointmentId}`);
      if (ids && ids.length > 0) {
        for (const { id } of ids) {
          await Notifications.cancelScheduledNotificationAsync(id);
        }
        this.notificationIds.delete(`appt_${appointmentId}`);
      }
    } catch (error) {
      console.error('Error canceling appointment reminders:', error);
    }
  }
}

// Create notification categories with action buttons
const notificationActions = [
  {
    identifier: 'TAKEN',
    buttonTitle: 'Taken',
    options: {
      opensAppToForeground: false,
    },
  },
  {
    identifier: 'SNOOZE_5',
    buttonTitle: 'Snooze 5min',
    options: {
      opensAppToForeground: false,
    },
  },
  {
    identifier: 'SNOOZE_10',
    buttonTitle: 'Snooze 10min',
    options: {
      opensAppToForeground: false,
    },
  },
  {
    identifier: 'SNOOZE_30',
    buttonTitle: 'Snooze 30min',
    options: {
      opensAppToForeground: false,
    },
  },
  {
    identifier: 'MISSED',
    buttonTitle: 'Missed',
    options: {
      opensAppToForeground: false,
    },
  },
];

// Set up notification categories (only on native platforms, not web)
if (Platform.OS !== 'web') {
  try {
    Notifications.setNotificationCategoryAsync('MEDICATION_REMINDER', notificationActions);
    Notifications.setNotificationCategoryAsync('MEDICATION_REMINDER_GROUPED', notificationActions);

    // Create appointment reminder category
    const appointmentActions = [
      {
        identifier: 'VIEW',
        buttonTitle: 'View',
        options: {
          opensAppToForeground: true,
        },
      },
      {
        identifier: 'SNOOZE_15',
        buttonTitle: 'Snooze 15min',
        options: {
          opensAppToForeground: false,
        },
      },
    ];

    Notifications.setNotificationCategoryAsync('APPOINTMENT_REMINDER', appointmentActions);
  } catch (error) {
    console.log('Notification categories not available on this platform:', error);
  }
}

export default new NotificationService();


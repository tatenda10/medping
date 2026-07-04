import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { navigationRef } from '../navigation/navigationRef';
import notificationService from '../services/notificationService';
import { clerkAxios } from '../utils/clerkAxios';
import databaseService from '../services/databaseService';
import syncService from '../services/syncService';
import { useAuth } from '../context/AuthContext';

// Simple ID generator for React Native
const generateId = () => {
  return `dose_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Navigate using navigationRef (works even when navigator isn't ready)
 */
const navigate = (name, params) => {
  const tryNavigate = () => {
    if (navigationRef.current?.isReady()) {
      try {
        // Navigate to the screen - it's in the Drawer navigator inside MainApp
        navigationRef.current.navigate('MainApp', {
          screen: 'MedicationReminder',
          params: params,
        });
      } catch (error) {
        console.error('Navigation error:', error);
      }
    } else {
      return false;
    }
    return true;
  };

  if (!tryNavigate()) {
    // Wait a bit and retry if navigation isn't ready
    setTimeout(() => {
      if (!tryNavigate()) {
        console.warn('Navigation not ready, cannot navigate to:', name);
      }
    }, 500);
  }
};

/**
 * Hook to handle notification interactions
 */
export const useNotificationHandler = () => {
  const navigation = useNavigation();
  const { userId, isAuthenticated } = useAuth();
  const notificationListener = useRef();
  const responseListener = useRef();

  useEffect(() => {
    // Handle notifications received while app is foregrounded
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', {
        title: notification.request.content.title,
        body: notification.request.content.body,
        data: notification.request.content.data,
      });
      
      // Navigate to full-screen medication reminder when notification is received
      const data = notification.request.content.data || {};
      const { medicationId, medicationName, dosage, time, date } = data;
      
      if (medicationId) {
        // Use navigationRef for reliable navigation
        navigate('MedicationReminder', {
          medicationId,
          medicationName,
          dosage,
          time,
          date,
        });
      }
    });

    // Handle notification interactions (taps, action buttons)
    responseListener.current = Notifications.addNotificationResponseReceivedListener(async response => {
      const { actionIdentifier, notification } = response;
      const data = notification.request.content.data || {};
      const { medicationId, medicationName, dosage, time, date } = data;

      console.log('Notification action:', actionIdentifier, data);

      try {
        const scheduledTime = new Date(date);

        // Check if this is a grouped notification
        const isGrouped = data.isGrouped || false;
        const medicationIds = data.medicationIds || [medicationId];
        const groupedMedications = data.groupedMedications || [];

        switch (actionIdentifier) {
          case 'TAKEN':
            // Log all medications in group as taken
            if (isGrouped && medicationIds.length > 1) {
              for (const medId of medicationIds) {
                await logDose(medId, scheduledTime, 'taken');
              }
            } else {
              await logDose(medicationId, scheduledTime, 'taken');
            }
            // Cancel the notification
            await Notifications.dismissNotificationAsync(notification.request.identifier);
            break;

          case 'SNOOZE_5':
            await handleSnooze(medicationId, time, 5, isGrouped, medicationIds);
            await Notifications.dismissNotificationAsync(notification.request.identifier);
            break;

          case 'SNOOZE_10':
            await handleSnooze(medicationId, time, 10, isGrouped, medicationIds);
            await Notifications.dismissNotificationAsync(notification.request.identifier);
            break;

          case 'SNOOZE_30':
            await handleSnooze(medicationId, time, 30, isGrouped, medicationIds);
            await Notifications.dismissNotificationAsync(notification.request.identifier);
            break;

          case 'MISSED':
            // Log all medications in group as missed
            if (isGrouped && medicationIds.length > 1) {
              for (const medId of medicationIds) {
                await logDose(medId, scheduledTime, 'missed');
              }
            } else {
              await logDose(medicationId, scheduledTime, 'missed');
            }
            await Notifications.dismissNotificationAsync(notification.request.identifier);
            break;

          default:
            // Default tap - navigate to full-screen medication reminder with ringing
            if (medicationId) {
              // Use navigationRef for reliable navigation even when app is in background
              navigate('MedicationReminder', {
                medicationId,
                medicationName,
                dosage,
                time,
                date,
                isGrouped,
                groupedMedications,
              });
            }
            break;
        }
      } catch (error) {
        console.error('Error handling notification action:', error);
      }
    });

    return () => {
      // New Expo Notifications API: subscriptions have a .remove() method
      if (notificationListener.current && typeof notificationListener.current.remove === 'function') {
        notificationListener.current.remove();
      }
      if (responseListener.current && typeof responseListener.current.remove === 'function') {
        responseListener.current.remove();
      }
    };
  }, [navigation, userId, isAuthenticated]);

  const handleSnooze = async (medicationId, originalTime, minutes, isGrouped = false, medicationIds = []) => {
    try {
      const snoozeDate = new Date();
      snoozeDate.setMinutes(snoozeDate.getMinutes() + minutes);

      if (isGrouped && medicationIds.length > 1) {
        // Snooze all medications in the group
        for (const medId of medicationIds) {
          try {
            const response = await clerkAxios.get(`/medications/${medId}`);

            if (response.data.success) {
              const medication = response.data.medication;
              await notificationService.scheduleMedicationNotification(
                medication,
                originalTime,
                snoozeDate
              );
            }
          } catch (error) {
            console.error(`Error snoozing medication ${medId}:`, error);
          }
        }
      } else {
        // Single medication snooze
        const response = await clerkAxios.get(`/medications/${medicationId}`);

        if (response.data.success) {
          const medication = response.data.medication;
          await notificationService.scheduleMedicationNotification(
            medication,
            originalTime,
            snoozeDate
          );
        }
      }
    } catch (error) {
      console.error('Error handling snooze:', error);
    }
  };

  const logDose = async (medicationId, scheduledTime, status) => {
    try {
      // Use Clerk userId from context
      if (!userId || !isAuthenticated) {
        console.log('User not authenticated, skipping dose log');
        return;
      }

      // Save to local database first (offline-first)
      const doseLog = {
        id: generateId(),
        user_id: userId,
        medication_id: medicationId,
        scheduled_time: scheduledTime.toISOString(),
        status: status,
        taken_time: status === 'taken' ? new Date().toISOString() : null,
      };

      await databaseService.saveDoseLog(doseLog);

      // Try to sync to server (if online)
      const online = await syncService.isOnline();
      if (online) {
        try {
          await clerkAxios.post(
            '/dose-logs',
            {
              medication_id: medicationId,
              scheduled_time: scheduledTime.toISOString(),
              status: status,
            }
          );
          await databaseService.markDoseLogSynced(doseLog.id);
        } catch (error) {
          console.log('📴 Offline or server error - saved locally, will sync later');
        }
      }
    } catch (error) {
      console.error('Error logging dose:', error);
    }
  };
};


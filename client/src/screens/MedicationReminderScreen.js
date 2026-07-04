import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import { clerkAxios } from '../utils/clerkAxios';
import databaseService from '../services/databaseService';
import syncService from '../services/syncService';
import { useAuth } from '../context/AuthContext';

// Simple ID generator for React Native
const generateId = () => {
  return `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

const MedicationReminderScreen = ({ route, navigation }) => {
  const { userId, isAuthenticated } = useAuth();
  const { medicationId, medicationName, dosage, time, date } = route.params || {};
  const [sound, setSound] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const soundRef = useRef(null);

  useEffect(() => {
    // Start playing looping ringtone when screen opens
    playRingtone();

    // Cleanup: stop sound when component unmounts
    return () => {
      stopRingtone();
    };
  }, []);

  const playRingtone = async () => {
    try {
      // Request audio permissions
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        console.warn('Audio permission not granted');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: false,
      });

      // Use local beep sound from assets
      try {
        const { sound: soundObject } = await Audio.Sound.createAsync(
          require('../../assets/beep-01a.wav'),
          { 
            shouldPlay: true,
            isLooping: true,
            volume: 1.0,
            rate: 1.0,
          }
        );
        soundRef.current = soundObject;
        setSound(soundObject);
      } catch (soundError) {
        console.error('Error loading beep sound:', soundError);
        // Continue without sound - the notification already played
      }
    } catch (error) {
      console.error('Error setting up audio:', error);
      // If sound fails, continue without sound (notification already played)
    }
  };

  const stopRingtone = async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
        setSound(null);
      }
    } catch (error) {
      console.error('Error stopping ringtone:', error);
    }
  };

  const handleAction = async (action) => {
    setIsLoading(true);
    await stopRingtone();

    try {
      const currentUserId = userId || 'guest';
      const scheduledTime = new Date(date);

      if (action === 'taken' || action === 'missed') {
        // Save to local database first (offline-first)
        const doseLog = {
          id: generateId(),
          user_id: currentUserId,
          medication_id: medicationId,
          scheduled_time: scheduledTime.toISOString(),
          status: action,
          taken_time: action === 'taken' ? new Date().toISOString() : null,
        };

        if (Platform.OS !== 'web') {
          await databaseService.saveDoseLog(doseLog);
        }

        // Try to sync to server (if online and authenticated)
        const online = await syncService.isOnline();
        if (online && isAuthenticated) {
          try {
            await clerkAxios.post(
              '/dose-logs',
              {
                medication_id: medicationId,
                scheduled_time: scheduledTime.toISOString(),
                status: action,
              }
            );
            if (Platform.OS !== 'web') {
              await databaseService.markDoseLogSynced(doseLog.id);
            }
          } catch (error) {
            console.log('📴 Offline or server error - saved locally, will sync later');
          }
        }
      }

      // Navigate to MainTabs -> Dashboard
      navigation.navigate('MainTabs', { screen: 'Dashboard' });
    } catch (error) {
      console.error('Error handling medication action:', error);
      Alert.alert('Error', 'Failed to log medication action');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSnooze = async (minutes) => {
    setIsLoading(true);
    await stopRingtone();

    try {
      // Fetch medication details
      const response = await clerkAxios.get(`/medications/${medicationId}`);

      if (response.data.success) {
        const medication = response.data.medication;
        const snoozeDate = new Date();
        snoozeDate.setMinutes(snoozeDate.getMinutes() + minutes);

        // Reschedule notification via notification service
        const notificationService = require('../services/notificationService').default;
        await notificationService.scheduleMedicationNotification(
          medication,
          time,
          snoozeDate
        );

        navigation.navigate('Dashboard');
      }
    } catch (error) {
      console.error('Error handling snooze:', error);
      Alert.alert('Error', 'Failed to snooze medication');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header with X button */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()} 
          style={styles.closeButton}
        >
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.content}>
        {/* Medication Info */}
        <View style={styles.medicationInfo}>
          <Text style={styles.emoji}>💊</Text>
          <Text style={styles.medicationName}>{medicationName || 'Medication Reminder'}</Text>
          <Text style={styles.dosage}>{dosage || 'Take your medication'}</Text>
          <Text style={styles.time}>{time || 'Now'}</Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[styles.actionButton, styles.takenButton]}
            onPress={() => handleAction('taken')}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.actionButtonText}>✓ Taken</Text>
            )}
          </TouchableOpacity>

          <View style={styles.snoozeContainer}>
            <Text style={styles.snoozeLabel}>Snooze:</Text>
            <View style={styles.snoozeButtons}>
              <TouchableOpacity
                style={[styles.snoozeButton, styles.snooze5Button]}
                onPress={() => handleSnooze(5)}
                disabled={isLoading}
              >
                <Text style={styles.snoozeButtonText}>5min</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.snoozeButton, styles.snooze10Button]}
                onPress={() => handleSnooze(10)}
                disabled={isLoading}
              >
                <Text style={styles.snoozeButtonText}>10min</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.snoozeButton, styles.snooze30Button]}
                onPress={() => handleSnooze(30)}
                disabled={isLoading}
              >
                <Text style={styles.snoozeButtonText}>30min</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.actionButton, styles.missedButton]}
            onPress={() => handleAction('missed')}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.actionButtonText}>✗ Missed</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: '#666',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  medicationInfo: {
    alignItems: 'center',
    marginBottom: 60,
  },
  emoji: {
    fontSize: 80,
    marginBottom: 20,
  },
  medicationName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  dosage: {
    fontSize: 20,
    color: '#666',
    marginBottom: 10,
    textAlign: 'center',
  },
  time: {
    fontSize: 18,
    color: '#999',
    textAlign: 'center',
  },
  actionsContainer: {
    width: '100%',
    maxWidth: 400,
  },
  actionButton: {
    paddingVertical: 18,
    paddingHorizontal: 30,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
    minHeight: 56,
  },
  takenButton: {
    backgroundColor: '#4CAF50',
  },
  missedButton: {
    backgroundColor: '#F44336',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  snoozeContainer: {
    marginVertical: 20,
    alignItems: 'center',
  },
  snoozeLabel: {
    fontSize: 16,
    color: '#666',
    marginBottom: 12,
    fontWeight: '600',
  },
  snoozeButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  snoozeButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 70,
    alignItems: 'center',
  },
  snooze5Button: {
    backgroundColor: '#FF9800',
  },
  snooze10Button: {
    backgroundColor: '#FF5722',
  },
  snooze30Button: {
    backgroundColor: '#E91E63',
  },
  snoozeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default MedicationReminderScreen;


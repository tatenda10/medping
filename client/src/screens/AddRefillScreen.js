import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import axios from 'axios';
import BASE_URL from '../context/Api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format } from 'date-fns';
import AppHeader from '../components/AppHeader';
import databaseService from '../services/databaseService';
import syncService from '../services/syncService';
import { getAuthToken } from '../utils/authToken';

const AddRefillScreen = ({ navigation, route }) => {
  const medicationId = route?.params?.medicationId;
  const [loading, setLoading] = useState(false);
  const [quantity, setQuantity] = useState('');
  const [refillDate, setRefillDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [notes, setNotes] = useState('');
  const [medication, setMedication] = useState(null);

  useEffect(() => {
    loadMedication();
  }, [medicationId]);

  const loadMedication = async () => {
    try {
      const userData = await AsyncStorage.getItem('userData');
      const user = userData ? JSON.parse(userData) : null;
      const userId = user?.id || user?.user?.id;

      if (!userId || !medicationId) return;

      const med = await databaseService.getMedicationById(medicationId);
      setMedication(med);
    } catch (error) {
      console.error('Error loading medication:', error);
    }
  };

  const handleSubmit = async () => {
    if (!quantity || parseInt(quantity) <= 0) {
      Alert.alert('Error', 'Please enter a valid quantity');
      return;
    }

    setLoading(true);
    try {
      const userData = await AsyncStorage.getItem('userData');
      const user = userData ? JSON.parse(userData) : null;
      const userId = user?.id || user?.user?.id;

      if (!userId) {
        Alert.alert('Error', 'User not found');
        setLoading(false);
        return;
      }

      const refillData = {
        medication_id: medicationId,
        quantity: parseInt(quantity),
        refill_date: refillDate.toISOString(),
        notes: notes.trim() || null,
      };

      // Save locally first
      const refill = {
        id: `refill_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        user_id: userId,
        ...refillData,
      };

      await databaseService.saveRefill(refill);

      // Try to sync to server
      const online = await syncService.isOnline();
      if (online) {
        try {
          const token = await getAuthToken();
          const response = await axios.post(`${BASE_URL}/refills`, refillData, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });

          if (response.data.success) {
            // Update local refill with server ID if needed
            await databaseService.markRefillSynced?.(response.data.refill.id);
          }
        } catch (error) {
          console.error('Error syncing refill:', error);
          // Continue - will sync later
        }
      }

      Alert.alert(
        'Success',
        `Refill added successfully. Quantity updated to ${medication?.quantity_remaining ? medication.quantity_remaining + parseInt(quantity) : parseInt(quantity)}.`,
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      console.error('Error adding refill:', error);
      Alert.alert('Error', 'Failed to add refill. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader navigation={navigation} />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {medication && (
          <View style={styles.medicationInfo}>
            <Text style={styles.medicationName}>{medication.name}</Text>
            <Text style={styles.medicationDosage}>{medication.dosage}</Text>
            {medication.quantity_remaining !== null && (
              <Text style={styles.currentQuantity}>
                Current quantity: {medication.quantity_remaining}
              </Text>
            )}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.label}>Quantity <Text style={styles.asterisk}>*</Text></Text>
          <TextInput
            style={styles.input}
            placeholder="Enter quantity"
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="number-pad"
            placeholderTextColor="#999"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Refill Date <Text style={styles.asterisk}>*</Text></Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={styles.dateButtonText}>
              {format(refillDate, 'MMM d, yyyy')}
            </Text>
            <MaterialIcons name="calendar-today" size={20} color="#4285F4" />
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={refillDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(event, selectedDate) => {
                setShowDatePicker(Platform.OS === 'ios');
                if (selectedDate) {
                  setRefillDate(selectedDate);
                }
                if (Platform.OS === 'android' && event.type !== 'dismissed') {
                  setShowDatePicker(false);
                }
              }}
            />
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Notes (Optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Any additional notes about this refill"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            placeholderTextColor="#999"
          />
        </View>

        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>Add Refill</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  medicationInfo: {
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  medicationName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  medicationDosage: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  currentQuantity: {
    fontSize: 14,
    color: '#4285F4',
    fontWeight: '600',
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  asterisk: {
    color: '#E53935',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#333',
    backgroundColor: '#fff',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
  },
  dateButtonText: {
    fontSize: 14,
    color: '#333',
  },
  submitButton: {
    backgroundColor: '#4285F4',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AddRefillScreen;


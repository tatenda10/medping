import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import BASE_URL from '../context/Api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppHeader from '../components/AppHeader';
import BottomTabBar from '../components/BottomTabBar';
import notificationService from '../services/notificationService';
import { MEDICATION_TYPES } from '../utils/medicationIcons';
import { useAuthCheck } from '../hooks/useAuthCheck';
import CreateAccountPrompt from '../components/CreateAccountPrompt';

const EditMedicineScreen = ({ route, navigation }) => {
  const { isAuthenticated } = useAuthCheck();
  const [showCreateAccountPrompt, setShowCreateAccountPrompt] = useState(false);
  const { medicationId, medication: initialMedication } = route.params;
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setShowCreateAccountPrompt(true);
    }
  }, [isAuthenticated]);
  
  // Form fields
  const [name, setName] = useState(initialMedication?.name || '');
  const [dosage, setDosage] = useState(initialMedication?.dosage || '');
  const [medicationType, setMedicationType] = useState(initialMedication?.medication_type || 'tablet');
  const [timesOfDay, setTimesOfDay] = useState(() => {
    if (!initialMedication?.times_of_day) return [];
    const times = typeof initialMedication.times_of_day === 'string' 
      ? JSON.parse(initialMedication.times_of_day) 
      : initialMedication.times_of_day;
    return times.map(time => {
      const [hours, minutes] = time.split(':');
      const date = new Date();
      date.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      return date;
    });
  });
  const [startDate, setStartDate] = useState(
    initialMedication?.start_date ? new Date(initialMedication.start_date) : new Date()
  );
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [endDate, setEndDate] = useState(
    initialMedication?.end_date ? new Date(initialMedication.end_date) : null
  );
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [isContinuous, setIsContinuous] = useState(initialMedication?.is_continuous ?? true);
  const [foodInstructions, setFoodInstructions] = useState(initialMedication?.food_instructions || '');
  const [notes, setNotes] = useState(initialMedication?.notes || '');
  const [photo, setPhoto] = useState(initialMedication?.photo_url || null);
  const [quantityRemaining, setQuantityRemaining] = useState(
    initialMedication?.quantity_remaining?.toString() || ''
  );
  const [lowStockThreshold, setLowStockThreshold] = useState(
    initialMedication?.low_stock_threshold?.toString() || '7'
  );
  
  // Time picker states
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timePickerIndex, setTimePickerIndex] = useState(null);
  const [tempTime, setTempTime] = useState(new Date());

  const handleAddTime = () => {
    const newTime = new Date();
    newTime.setHours(8, 0, 0, 0);
    setTimesOfDay([...timesOfDay, newTime]);
  };

  const handleRemoveTime = (index) => {
    const newTimes = timesOfDay.filter((_, i) => i !== index);
    setTimesOfDay(newTimes);
  };

  const handleTimeChange = (event, selectedTime) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
    }
    if (event.type !== 'dismissed' && selectedTime && timePickerIndex !== null) {
      const newTimes = [...timesOfDay];
      newTimes[timePickerIndex] = selectedTime;
      setTimesOfDay(newTimes);
      if (Platform.OS === 'ios') {
        setShowTimePicker(false);
      }
      setTimePickerIndex(null);
    } else if (Platform.OS === 'android' && event.type === 'dismissed') {
      setTimePickerIndex(null);
    }
  };

  const openTimePicker = (index) => {
    setTempTime(timesOfDay[index] || new Date());
    setTimePickerIndex(index);
    setShowTimePicker(true);
  };

  const formatTime = (date) => {
    if (!date) return '';
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant camera roll permissions');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setPhoto(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter medication name');
      return;
    }
    if (!dosage.trim()) {
      Alert.alert('Required', 'Please enter dosage');
      return;
    }
    if (timesOfDay.length === 0) {
      Alert.alert('Required', 'Please add at least one time of day');
      return;
    }

    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      
      // Format times for API
      const formattedTimes = timesOfDay.map(time => formatTime(time));
      
      // Determine frequency and times_per_day based on timesOfDay array
      let calculatedFrequency = 'custom';
      let calculatedTimesPerDay = timesOfDay.length;

      if (timesOfDay.length === 1) {
        calculatedFrequency = 'daily';
      } else if (timesOfDay.length === 24) {
        calculatedFrequency = 'hourly';
      }

      const medicationData = {
        name: name.trim(),
        dosage: dosage.trim(),
        medication_type: medicationType,
        frequency: calculatedFrequency,
        times_per_day: calculatedTimesPerDay,
        times_of_day: formattedTimes,
        start_date: startDate.toISOString(),
        end_date: isContinuous ? null : (endDate ? endDate.toISOString() : null),
        is_continuous: isContinuous,
        food_instructions: foodInstructions.trim() || null,
        notes: notes.trim() || null,
        photo_url: photo,
        quantity_remaining: quantityRemaining ? parseInt(quantityRemaining) : null,
        low_stock_threshold: lowStockThreshold ? parseInt(lowStockThreshold) : 7,
      };

      const response = await axios.put(
        `${BASE_URL}/medications/${medicationId}`,
        medicationData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (response.data.success) {
        Alert.alert('Success', 'Medication updated successfully', [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]);
      }
    } catch (error) {
      console.error('Update medication error:', error);
      Alert.alert(
        'Error',
        error.response?.data?.message || 'Failed to update medication'
      );
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <AppHeader navigation={navigation} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Text style={{ fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 20 }}>
            Create an account to edit medications and sync changes across devices.
          </Text>
        </View>
        <CreateAccountPrompt
          visible={showCreateAccountPrompt}
          onClose={() => {
            setShowCreateAccountPrompt(false);
            navigation.goBack();
          }}
          message="Create an account to edit medications and sync changes across devices."
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <AppHeader navigation={navigation} />
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Medication Name */}
          <View style={styles.section}>
            <Text style={styles.label}>
              Medication Name <Text style={styles.asterisk}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Aspirin"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          </View>

          {/* Dosage */}
          <View style={styles.section}>
            <Text style={styles.label}>
              Dosage <Text style={styles.asterisk}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 10mg, 2 tablets, 5ml"
              value={dosage}
              onChangeText={setDosage}
            />
          </View>

          {/* Medication Type */}
          <View style={styles.section}>
            <Text style={styles.label}>
              Medication Type <Text style={styles.asterisk}>*</Text>
            </Text>
            <View style={styles.typeContainer}>
              {MEDICATION_TYPES.map((type) => (
                <TouchableOpacity
                  key={type.value}
                  style={[
                    styles.typeButton,
                    medicationType === type.value && styles.typeButtonSelected
                  ]}
                  onPress={() => setMedicationType(type.value)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.typeButtonText,
                    medicationType === type.value && styles.typeButtonTextSelected
                  ]}>
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Times of Day */}
          <View style={styles.section}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>
                Times of Day <Text style={styles.asterisk}>*</Text>
              </Text>
              <TouchableOpacity
                onPress={handleAddTime}
                style={styles.addTimeButton}
              >
                <Text style={styles.addTimeIcon}>+</Text>
              </TouchableOpacity>
            </View>
            {timesOfDay.map((time, index) => (
              <View key={index} style={styles.timeRow}>
                <TouchableOpacity
                  style={styles.timeButton}
                  onPress={() => openTimePicker(index)}
                >
                  <Text style={styles.timeButtonText}>
                    {formatTime(time)}
                  </Text>
                </TouchableOpacity>
                {showTimePicker && timePickerIndex === index && (
                  <DateTimePicker
                    value={tempTime}
                    mode="time"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={handleTimeChange}
                  />
                )}
                <TouchableOpacity
                  onPress={() => handleRemoveTime(index)}
                  style={styles.removeTimeButton}
                >
                  <Text style={styles.removeTimeIcon}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>

          {/* Start Date */}
          <View style={styles.section}>
            <Text style={styles.label}>
              Start Date <Text style={styles.asterisk}>*</Text>
            </Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowStartDatePicker(true)}
            >
              <Text style={styles.dateButtonText}>
                {startDate.toLocaleDateString()}
              </Text>
            </TouchableOpacity>
            {showStartDatePicker && (
              <DateTimePicker
                value={startDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, selectedDate) => {
                  setShowStartDatePicker(Platform.OS === 'ios');
                  if (selectedDate) {
                    setStartDate(selectedDate);
                  }
                }}
              />
            )}
          </View>

          {/* End Date / Continuous */}
          <View style={styles.section}>
            <View style={styles.switchRow}>
              <View style={styles.switchLabelContainer}>
                <Text style={styles.label}>Continuous Medication</Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.toggleSwitch,
                  isContinuous && styles.toggleSwitchActive,
                ]}
                onPress={() => setIsContinuous(!isContinuous)}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.toggleSwitchThumb,
                    isContinuous && { transform: [{ translateX: 24 }] },
                  ]}
                />
              </TouchableOpacity>
            </View>
            {!isContinuous && (
              <>
                <Text style={[styles.label, { marginTop: 15 }]}>End Date</Text>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => setShowEndDatePicker(true)}
                >
                  <Text style={styles.dateButtonText}>
                    {endDate
                      ? endDate.toLocaleDateString()
                      : 'Select end date'}
                  </Text>
                </TouchableOpacity>
                {showEndDatePicker && (
                  <DateTimePicker
                    value={endDate || new Date()}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, selectedDate) => {
                      setShowEndDatePicker(Platform.OS === 'ios');
                      if (selectedDate) {
                        setEndDate(selectedDate);
                      }
                    }}
                  />
                )}
              </>
            )}
          </View>

          {/* Food Instructions */}
          <View style={styles.section}>
            <Text style={styles.label}>Food Instructions (Optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="e.g., Take with food, Take on an empty stomach"
              value={foodInstructions}
              onChangeText={setFoodInstructions}
              multiline
            />
          </View>

          {/* Notes */}
          <View style={styles.section}>
            <Text style={styles.label}>Notes (Optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Any additional notes about this medication"
              value={notes}
              onChangeText={setNotes}
              multiline
            />
          </View>

          {/* Photo */}
          <View style={styles.section}>
            <Text style={styles.label}>Medication Photo (Optional)</Text>
            <TouchableOpacity style={styles.photoButton} onPress={pickImage}>
              {photo ? (
                <Image source={{ uri: photo }} style={styles.photoPreview} />
              ) : (
                <Text style={styles.photoButtonText}>Upload Photo</Text>
              )}
            </TouchableOpacity>
            {photo && (
              <TouchableOpacity
                onPress={() => setPhoto(null)}
                style={styles.removePhotoButton}
              >
                <Text style={styles.removePhotoButtonText}>Remove Photo</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Quantity Remaining */}
          <View style={styles.section}>
            <Text style={styles.label}>Quantity Remaining (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 30"
              value={quantityRemaining}
              onChangeText={setQuantityRemaining}
              keyboardType="number-pad"
            />
          </View>

          {/* Low Stock Threshold */}
          <View style={styles.section}>
            <Text style={styles.label}>Low Stock Alert (days)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 7"
              value={lowStockThreshold}
              onChangeText={setLowStockThreshold}
              keyboardType="number-pad"
            />
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>Update Medication</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
      <BottomTabBar />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 25,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  asterisk: {
    color: '#d32f2f',
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  addTimeButton: {
    width: 35,
    height: 35,
    borderRadius: 17.5,
    backgroundColor: '#4285F4',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#4285F4',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  addTimeIcon: {
    fontSize: 22,
    color: '#fff',
    fontWeight: '300',
    lineHeight: 22,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  timeButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 15,
    backgroundColor: '#fff',
  },
  timeButtonText: {
    fontSize: 18,
    color: '#333',
    fontWeight: '600',
    textAlign: 'center',
  },
  removeTimeButton: {
    width: 35,
    height: 35,
    borderRadius: 17.5,
    backgroundColor: '#d32f2f',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#d32f2f',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  removeTimeIcon: {
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold',
  },
  dateButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
  },
  dateButtonText: {
    fontSize: 16,
    color: '#333',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  switchLabelContainer: {
    flex: 1,
  },
  toggleSwitch: {
    width: 56,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ddd',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleSwitchActive: {
    backgroundColor: '#4285F4',
  },
  toggleSwitchThumb: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  photoButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9f9f9',
    minHeight: 120,
  },
  photoButtonText: {
    fontSize: 16,
    color: '#666',
  },
  photoPreview: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    resizeMode: 'contain',
  },
  removePhotoButton: {
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  removePhotoButtonText: {
    color: '#d32f2f',
    fontSize: 14,
  },
  typeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  typeButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#ddd',
    backgroundColor: '#fff',
    minWidth: 100,
    alignItems: 'center',
  },
  typeButtonSelected: {
    borderColor: '#4285F4',
    backgroundColor: '#E3F2FD',
  },
  typeButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  typeButtonTextSelected: {
    color: '#4285F4',
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#d32f2f',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default EditMedicineScreen;


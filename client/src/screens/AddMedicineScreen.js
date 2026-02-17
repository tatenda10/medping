import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clerkAxios } from '../utils/clerkAxios';
import notificationService from '../services/notificationService';
import databaseService from '../services/databaseService';
import syncService from '../services/syncService';
import { MEDICATION_TYPES, getMedicationIcon } from '../utils/medicationIcons';
import { format, addDays, eachDayOfInterval, startOfDay } from 'date-fns';
import { useAuth } from '../context/ClerkAuthContext';
// Simple ID generator for React Native
const generateId = () => {
  return `med_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

const AddMedicineScreen = ({ navigation }) => {
  const { userId } = useAuth();
  const [loading, setLoading] = useState(false);
  const scrollViewRef = useRef(null);
  const quantityRemainingYRef = useRef(0);
  const lowStockYRef = useRef(0);


  // Helper function to scroll to a position
  const scrollToPosition = (y) => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ y, animated: true });
    }
  };
  
  // Form fields
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [timesOfDay, setTimesOfDay] = useState([]);
  const [startDate, setStartDate] = useState(new Date());
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [endDate, setEndDate] = useState(null);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [isContinuous, setIsContinuous] = useState(true);
  const [foodInstructions, setFoodInstructions] = useState('');
  const [notes, setNotes] = useState('');
  const [reasonForTreatment, setReasonForTreatment] = useState('');
  const [photo, setPhoto] = useState(null);
  const [quantityRemaining, setQuantityRemaining] = useState('');
  const [lowStockThreshold, setLowStockThreshold] = useState('7');
  const [medicationType, setMedicationType] = useState('tablet');
  const [schedulePattern, setSchedulePattern] = useState('daily'); // daily, weekly, alternating
  const [selectedDays, setSelectedDays] = useState([]); // For weekly pattern: ['monday', 'tuesday', etc.]
  const [alternatingType, setAlternatingType] = useState('left_right'); // left_right, day_cycle
  const [alternatingCurrent, setAlternatingCurrent] = useState('left'); // left, right, day1, day2
  const [alternatingDaysOn, setAlternatingDaysOn] = useState('3'); // For day cycle: days to take
  const [alternatingDaysOff, setAlternatingDaysOff] = useState('1'); // For day cycle: days to skip
  
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
      // Use Clerk userId if authenticated, otherwise use 'guest'
      const currentUserId = userId || 'guest';
      
      // Format times for API
      const formattedTimes = timesOfDay.map(time => formatTime(time));
      
      // Calculate frequency and times_per_day from timesOfDay array
      const timesPerDayCount = timesOfDay.length;
      const frequency = timesPerDayCount === 1 ? 'daily' : 'custom';

      // Generate ID for offline support
      const medicationId = generateId();

      const medicationData = {
        id: medicationId,
        user_id: currentUserId,
        name: name.trim(),
        dosage: dosage.trim(),
        frequency: frequency,
        times_per_day: timesPerDayCount,
        times_of_day: formattedTimes,
        start_date: startDate.toISOString(),
        end_date: isContinuous ? null : (endDate ? endDate.toISOString() : null),
        is_continuous: isContinuous,
        food_instructions: foodInstructions.trim() || null,
        notes: notes.trim() || null,
        reason_for_treatment: reasonForTreatment.trim() || null,
        photo_url: photo || null,
        quantity_remaining: quantityRemaining ? parseInt(quantityRemaining) : null,
        low_stock_threshold: lowStockThreshold ? parseInt(lowStockThreshold) : 7,
        schedule_pattern: schedulePattern,
        selected_days: schedulePattern === 'weekly' ? JSON.stringify(selectedDays) : null,
        alternating_type: schedulePattern === 'alternating' ? alternatingType : null,
        alternating_current: schedulePattern === 'alternating' ? alternatingCurrent : null,
        alternating_days_on: schedulePattern === 'alternating' && alternatingType === 'day_cycle' ? parseInt(alternatingDaysOn) : null,
        alternating_days_off: schedulePattern === 'alternating' && alternatingType === 'day_cycle' ? parseInt(alternatingDaysOff) : null,
      };

      // Save to local database first (offline-first) - skip on web
      if (Platform.OS !== 'web') {
        try {
          console.log('💾 Saving medication to local database...');
          await databaseService.saveMedication(medicationData, true);
          console.log('✅ Medication saved to local database');
        } catch (dbError) {
          console.warn('⚠️ Failed to save to local database:', dbError.message);
          // Continue - will try to save to server
        }
      } else {
        console.log('🌐 Web platform - skipping local database save');
      }

      // Schedule notifications for the new medication (don't block on errors)
      try {
        console.log('🔔 Scheduling notifications...');
        await notificationService.scheduleMedicationNotifications(medicationData);
        console.log('✅ Notifications scheduled');
      } catch (notifError) {
        console.error('⚠️ Error scheduling notifications (non-blocking):', notifError);
        // Don't throw - medication is saved, notifications can be scheduled later
      }

      // Try to sync to server (if online and authenticated)
      const online = await syncService.isOnline();
      if (online && userId) {
        try {
          const response = await clerkAxios.post('/medications', medicationData);

          if (response.data.success) {
            // Update local record with server data (skip on web)
            if (Platform.OS !== 'web') {
              try {
                await databaseService.saveMedication(response.data.medication, false);
                await databaseService.markMedicationSynced(medicationId);
              } catch (dbError) {
                console.warn('⚠️ Failed to update local database with server data:', dbError.message);
              }
            }
          }
        } catch (error) {
          console.log('📴 Offline or server error - saved locally, will sync later');
        }
      } else if (!userId) {
        console.log('👤 Guest mode - medication saved locally only');
      }

      // Clear form for adding another medication
      setName('');
      setDosage('');
      setMedicationType('tablet');
      setTimesOfDay([]);
      setStartDate(new Date());
      setEndDate(null);
      setIsContinuous(true);
      setFoodInstructions('');
      setNotes('');
      setReasonForTreatment('');
      setSchedulePattern('daily');
      setAlternatingType('left_right');
      setAlternatingCurrent('left');
      setPhoto(null);
      setQuantityRemaining('');
      setLowStockThreshold('7');

      Alert.alert('Success', 'Medication added successfully!', [
        {
          text: 'Add Another',
          onPress: () => {
            // Form is already cleared, scroll to top
            scrollViewRef.current?.scrollTo({ y: 0, animated: true });
          },
        },
        {
          text: 'Done',
          onPress: () => {
            // Navigate to Dashboard via MainTabs
            navigation.navigate('MainTabs', { screen: 'Dashboard' });
          },
        },
      ]);
    } catch (error) {
      console.error('Add medication error:', error);
      Alert.alert(
        'Error',
        error.response?.data?.message || 'Failed to add medication'
      );
    } finally {
      setLoading(false);
    }
  };


  const canContinue = name.trim().length > 0 && dosage.trim().length > 0 && timesOfDay.length > 0;

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top', 'bottom']}>
      {/* Header */}
      <View className="flex-row items-center px-5 pt-4 pb-3">
        <TouchableOpacity 
          className="w-10 h-10 rounded-full bg-gray-100 justify-center items-center mr-3"
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text className="text-2xl font-bold text-gray-900 flex-1">Add Medication</Text>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView 
          ref={scrollViewRef}
          className="flex-1" 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 120 }}
          nestedScrollEnabled={true}
        >
          <View className="p-6">
            {/* Medication Name */}
            <View className="mb-6">
              <Text className="text-sm font-semibold text-gray-600 mb-2">
                Medication Name <Text style={{ color: '#E53935' }}>*</Text>
              </Text>
              <TextInput
                className="bg-gray-50 rounded-xl p-4 text-base"
                placeholder="e.g., Aspirin"
                placeholderTextColor="#999"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
            </View>

            {/* Dosage */}
            <View className="mb-6">
              <Text className="text-sm font-semibold text-gray-600 mb-2">
                Dosage <Text style={{ color: '#E53935' }}>*</Text>
              </Text>
              <TextInput
                className="bg-gray-50 rounded-xl p-4 text-base"
                placeholder="e.g., 100mg, 1 tablet"
                placeholderTextColor="#999"
                value={dosage}
                onChangeText={setDosage}
              />
            </View>

            {/* Medication Type */}
            <View className="mb-6">
              <Text className="text-sm font-semibold text-gray-600 mb-2">
                Medication Type <Text style={{ color: '#E53935' }}>*</Text>
              </Text>
              <View className="flex-row flex-wrap justify-between gap-2">
                {MEDICATION_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type.value}
                    className={`w-[31%] py-3 px-2 rounded-xl items-center justify-center ${
                      medicationType === type.value ? '' : ''
                    }`}
                    style={{
                      backgroundColor: medicationType === type.value ? '#90CDF4' : '#F5F5F5',
                    }}
                    onPress={() => setMedicationType(type.value)}
                    activeOpacity={0.7}
                  >
                    <View className="flex-row items-center justify-start gap-2 w-full">
                      {getMedicationIcon(
                        type.value, 
                        20, 
                        medicationType === type.value ? '#fff' : '#666'
                      )}
                      <Text 
                        className="text-xs font-medium"
                        style={{
                          color: medicationType === type.value ? '#fff' : '#666',
                          fontWeight: medicationType === type.value ? '600' : '500',
                        }}
                      >
                        {type.label}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Times of Day */}
            <View className="mb-6">
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-sm font-semibold text-gray-600">
                  Times of Day <Text style={{ color: '#E53935' }}>*</Text>
                </Text>
                <TouchableOpacity
                  onPress={handleAddTime}
                  className="w-10 h-10 rounded-full items-center justify-center"
                  style={{ backgroundColor: '#90CDF4' }}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="add" size={24} color="white" />
                </TouchableOpacity>
              </View>
              {timesOfDay.length === 0 && (
                <Text className="text-sm text-gray-400 italic mt-2">
                  Tap the + button to add a time
                </Text>
              )}
              {timesOfDay.map((time, index) => (
                <View key={index} className="flex-row items-center mb-3 gap-3">
                  <TouchableOpacity
                    className="flex-1 bg-gray-50 rounded-xl p-4"
                    onPress={() => openTimePicker(index)}
                    activeOpacity={0.7}
                  >
                    <Text className="text-base text-gray-900 font-medium">
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
                    className="w-10 h-10 rounded-full items-center justify-center"
                    style={{ backgroundColor: '#E53935' }}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons name="close" size={20} color="white" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            {/* Schedule Pattern */}
            <View className="mb-6">
              <Text className="text-sm font-semibold text-gray-600 mb-2">Schedule Pattern</Text>
              <View className="flex-row gap-2.5 mt-2">
                <TouchableOpacity
                  className="flex-1 py-3 px-4 rounded-lg items-center"
                  style={{
                    backgroundColor: schedulePattern === 'daily' ? '#90CDF4' : '#F5F5F5',
                  }}
                  onPress={() => setSchedulePattern('daily')}
                  activeOpacity={0.7}
                >
                  <Text 
                    className="text-sm font-medium"
                    style={{
                      color: schedulePattern === 'daily' ? '#fff' : '#666',
                      fontWeight: schedulePattern === 'daily' ? '600' : '500',
                    }}
                  >
                    Daily
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 py-3 px-4 rounded-lg items-center"
                  style={{
                    backgroundColor: schedulePattern === 'weekly' ? '#90CDF4' : '#F5F5F5',
                  }}
                  onPress={() => setSchedulePattern('weekly')}
                  activeOpacity={0.7}
                >
                  <Text 
                    className="text-sm font-medium"
                    style={{
                      color: schedulePattern === 'weekly' ? '#fff' : '#666',
                      fontWeight: schedulePattern === 'weekly' ? '600' : '500',
                    }}
                  >
                    Weekly
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 py-3 px-4 rounded-lg items-center"
                  style={{
                    backgroundColor: schedulePattern === 'alternating' ? '#90CDF4' : '#F5F5F5',
                  }}
                  onPress={() => setSchedulePattern('alternating')}
                  activeOpacity={0.7}
                >
                  <Text 
                    className="text-sm font-medium"
                    style={{
                      color: schedulePattern === 'alternating' ? '#fff' : '#666',
                      fontWeight: schedulePattern === 'alternating' ? '600' : '500',
                    }}
                  >
                    Alternating
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Weekly - Day Selection */}
              {schedulePattern === 'weekly' && (
                <View className="mt-4 p-3 bg-gray-50 rounded-xl">
                  <Text className="text-sm font-semibold text-gray-600 mb-3">Select Days:</Text>
                  <View className="gap-2.5">
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => {
                      const dayKey = day.toLowerCase();
                      const isSelected = selectedDays.includes(dayKey);
                      return (
                        <TouchableOpacity
                          key={day}
                          className="py-4 px-4 rounded-xl flex-row items-center justify-between"
                          style={{
                            backgroundColor: isSelected ? '#E0F2FE' : 'white',
                          }}
                          onPress={() => {
                            if (isSelected) {
                              setSelectedDays(selectedDays.filter(d => d !== dayKey));
                            } else {
                              setSelectedDays([...selectedDays, dayKey]);
                            }
                          }}
                          activeOpacity={0.7}
                        >
                          <Text 
                            className="text-base font-medium flex-1"
                            style={{
                              color: isSelected ? '#90CDF4' : '#333',
                              fontWeight: isSelected ? '600' : '500',
                            }}
                          >
                            {day}
                          </Text>
                          {isSelected && (
                            <MaterialIcons name="check" size={20} color="#90CDF4" />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Alternating Options */}
              {schedulePattern === 'alternating' && (
                <View className="mt-4 p-3 bg-gray-50 rounded-xl">
                  <Text className="text-sm font-semibold text-gray-600 mb-2">Alternating Type:</Text>
                  <View className="flex-row gap-2.5">
                    <TouchableOpacity
                      className="flex-1 py-3 px-4 rounded-lg items-center"
                      style={{
                        backgroundColor: alternatingType === 'left_right' ? '#90CDF4' : '#F5F5F5',
                      }}
                      onPress={() => setAlternatingType('left_right')}
                      activeOpacity={0.7}
                    >
                      <Text 
                        className="text-sm font-medium"
                        style={{
                          color: alternatingType === 'left_right' ? '#fff' : '#666',
                          fontWeight: alternatingType === 'left_right' ? '600' : '500',
                        }}
                      >
                        Left/Right
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      className="flex-1 py-3 px-4 rounded-lg items-center"
                      style={{
                        backgroundColor: alternatingType === 'day_cycle' ? '#90CDF4' : '#F5F5F5',
                      }}
                      onPress={() => setAlternatingType('day_cycle')}
                      activeOpacity={0.7}
                    >
                      <Text 
                        className="text-sm font-medium"
                        style={{
                          color: alternatingType === 'day_cycle' ? '#fff' : '#666',
                          fontWeight: alternatingType === 'day_cycle' ? '600' : '500',
                        }}
                      >
                        Day Cycle
                      </Text>
                    </TouchableOpacity>
                  </View>
                  
                  {alternatingType === 'left_right' && (
                    <View className="mt-4">
                      <Text className="text-sm font-semibold text-gray-600 mb-2">Start with:</Text>
                      <View className="flex-row gap-2.5">
                        <TouchableOpacity
                          className="flex-1 py-3 px-4 rounded-lg items-center"
                          style={{
                            backgroundColor: alternatingCurrent === 'left' ? '#90CDF4' : '#F5F5F5',
                          }}
                          onPress={() => setAlternatingCurrent('left')}
                          activeOpacity={0.7}
                        >
                          <Text 
                            className="text-sm font-medium"
                            style={{
                              color: alternatingCurrent === 'left' ? '#fff' : '#666',
                              fontWeight: alternatingCurrent === 'left' ? '600' : '500',
                            }}
                          >
                            Left
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          className="flex-1 py-3 px-4 rounded-lg items-center"
                          style={{
                            backgroundColor: alternatingCurrent === 'right' ? '#90CDF4' : '#F5F5F5',
                          }}
                          onPress={() => setAlternatingCurrent('right')}
                          activeOpacity={0.7}
                        >
                          <Text 
                            className="text-sm font-medium"
                            style={{
                              color: alternatingCurrent === 'right' ? '#fff' : '#666',
                              fontWeight: alternatingCurrent === 'right' ? '600' : '500',
                            }}
                          >
                            Right
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                  
                  {alternatingType === 'day_cycle' && (
                    <View className="mt-4">
                      <Text className="text-sm font-semibold text-gray-600 mb-2">Days On / Days Off:</Text>
                      <View className="flex-row gap-3 mt-2">
                        <View className="flex-1">
                          <Text className="text-xs text-gray-600 mb-1">Take for (days):</Text>
                          <TextInput
                            className="bg-white rounded-xl p-3 text-base text-center"
                            value={alternatingDaysOn}
                            onChangeText={setAlternatingDaysOn}
                            keyboardType="number-pad"
                            placeholder="3"
                            placeholderTextColor="#999"
                          />
                        </View>
                        <View className="flex-1">
                          <Text className="text-xs text-gray-600 mb-1">Skip for (days):</Text>
                          <TextInput
                            className="bg-white rounded-xl p-3 text-base text-center"
                            value={alternatingDaysOff}
                            onChangeText={setAlternatingDaysOff}
                            keyboardType="number-pad"
                            placeholder="1"
                            placeholderTextColor="#999"
                          />
                        </View>
                      </View>
                      <View className="mt-4">
                        <Text className="text-sm font-semibold text-gray-600 mb-2">Start with:</Text>
                        <View className="flex-row gap-2.5">
                          <TouchableOpacity
                            className="flex-1 py-3 px-4 rounded-lg items-center"
                            style={{
                              backgroundColor: alternatingCurrent === 'day1' ? '#90CDF4' : '#F5F5F5',
                            }}
                            onPress={() => setAlternatingCurrent('day1')}
                            activeOpacity={0.7}
                          >
                            <Text 
                              className="text-sm font-medium"
                              style={{
                                color: alternatingCurrent === 'day1' ? '#fff' : '#666',
                                fontWeight: alternatingCurrent === 'day1' ? '600' : '500',
                              }}
                            >
                              Day 1 (Take)
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            className="flex-1 py-3 px-4 rounded-lg items-center"
                            style={{
                              backgroundColor: alternatingCurrent === 'day2' ? '#90CDF4' : '#F5F5F5',
                            }}
                            onPress={() => setAlternatingCurrent('day2')}
                            activeOpacity={0.7}
                          >
                            <Text 
                              className="text-sm font-medium"
                              style={{
                                color: alternatingCurrent === 'day2' ? '#fff' : '#666',
                                fontWeight: alternatingCurrent === 'day2' ? '600' : '500',
                              }}
                            >
                              Day 2 (Skip)
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* Start Date */}
            <View className="mb-6">
              <Text className="text-sm font-semibold text-gray-600 mb-2">
                Start Date <Text style={{ color: '#E53935' }}>*</Text>
              </Text>
              <TouchableOpacity
                className="bg-gray-50 rounded-xl p-4"
                onPress={() => setShowStartDatePicker(true)}
                activeOpacity={0.7}
              >
                <Text className="text-base text-gray-900 font-medium">
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
            <View className="mb-6">
              <View className="flex-row justify-between items-center">
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-gray-600">Continuous Medication</Text>
                  <Text className="text-xs text-gray-500 mt-1">
                    {isContinuous ? 'No end date' : 'Has end date'}
                  </Text>
                </View>
                <Switch
                  value={isContinuous}
                  onValueChange={setIsContinuous}
                  trackColor={{ false: '#767577', true: '#90CDF4' }}
                  thumbColor={isContinuous ? '#fff' : '#f4f3f4'}
                />
              </View>
              {!isContinuous && (
                <View className="mt-4">
                  <Text className="text-sm font-semibold text-gray-600 mb-2">End Date</Text>
                  <TouchableOpacity
                    className="bg-gray-50 rounded-xl p-4"
                    onPress={() => setShowEndDatePicker(true)}
                    activeOpacity={0.7}
                  >
                    <Text className="text-base text-gray-900 font-medium">
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
                </View>
              )}
            </View>

            {/* Food Instructions */}
            <View className="mb-6">
              <Text className="text-sm font-semibold text-gray-600 mb-2">Food Instructions</Text>
              <TextInput
                className="bg-gray-50 rounded-xl p-4 text-base h-20"
                style={{ textAlignVertical: 'top' }}
                placeholder="e.g., Take with food, Take on empty stomach"
                placeholderTextColor="#999"
                value={foodInstructions}
                onChangeText={setFoodInstructions}
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Reason for Treatment */}
            <View className="mb-6">
              <Text className="text-sm font-semibold text-gray-600 mb-2">Reason for Treatment</Text>
              <TextInput
                className="bg-gray-50 rounded-xl p-4 text-base h-20"
                style={{ textAlignVertical: 'top' }}
                placeholder="Why are you taking this medication? (e.g., High blood pressure, Diabetes)"
                placeholderTextColor="#999"
                value={reasonForTreatment}
                onChangeText={setReasonForTreatment}
                multiline
                numberOfLines={2}
              />
            </View>

            {/* Notes */}
            <View className="mb-6">
              <Text className="text-sm font-semibold text-gray-600 mb-2">Notes</Text>
              <TextInput
                className="bg-gray-50 rounded-xl p-4 text-base h-20"
                style={{ textAlignVertical: 'top' }}
                placeholder="Additional notes about this medication"
                placeholderTextColor="#999"
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Photo */}
            <View className="mb-6">
              <Text className="text-sm font-semibold text-gray-600 mb-2">Medication Photo</Text>
              <TouchableOpacity
                className="bg-gray-50 rounded-xl p-5 items-center justify-center min-h-[120px]"
                onPress={pickImage}
                activeOpacity={0.7}
              >
                {photo ? (
                  <Image source={{ uri: photo }} className="w-full h-48 rounded-lg" resizeMode="contain" />
                ) : (
                  <View className="items-center">
                    <MaterialIcons name="add-photo-alternate" size={48} color="#999" />
                    <Text className="text-sm text-gray-600 mt-2">Add Photo</Text>
                  </View>
                )}
              </TouchableOpacity>
              {photo && (
                <TouchableOpacity
                  onPress={() => setPhoto(null)}
                  className="mt-2 self-start"
                  activeOpacity={0.7}
                >
                  <Text className="text-sm font-semibold" style={{ color: '#E53935' }}>Remove Photo</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Quantity Remaining */}
            <View 
              className="mb-6"
              onLayout={(event) => {
                quantityRemainingYRef.current = event.nativeEvent.layout.y;
              }}
            >
              <Text className="text-sm font-semibold text-gray-600 mb-2">Quantity Remaining</Text>
              <TextInput
                className="bg-gray-50 rounded-xl p-4 text-base"
                placeholder="e.g., 30 tablets"
                placeholderTextColor="#999"
                value={quantityRemaining}
                onChangeText={setQuantityRemaining}
                keyboardType="number-pad"
                onFocus={() => {
                  setTimeout(() => {
                    if (quantityRemainingYRef.current) {
                      scrollToPosition(quantityRemainingYRef.current - 100);
                    }
                  }, 100);
                }}
              />
            </View>

            {/* Low Stock Threshold */}
            <View 
              className="mb-6"
              onLayout={(event) => {
                lowStockYRef.current = event.nativeEvent.layout.y;
              }}
            >
              <Text className="text-sm font-semibold text-gray-600 mb-2">Low Stock Alert (days)</Text>
              <TextInput
                className="bg-gray-50 rounded-xl p-4 text-base"
                placeholder="7"
                placeholderTextColor="#999"
                value={lowStockThreshold}
                onChangeText={setLowStockThreshold}
                keyboardType="number-pad"
                onFocus={() => {
                  setTimeout(() => {
                    if (lowStockYRef.current) {
                      scrollToPosition(lowStockYRef.current - 100);
                    }
                  }, 100);
                }}
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer */}
      <View className="px-5 pb-8 pt-4 border-t border-gray-200">
        <TouchableOpacity
          className="rounded-xl p-4 items-center justify-center"
          style={{ 
            backgroundColor: canContinue && !loading ? '#90CDF4' : '#B0BEC5' 
          }}
          onPress={handleSubmit}
          disabled={!canContinue || loading}
          activeOpacity={0.7}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white text-base font-bold">
              {timesOfDay.length > 0 ? 'Add Medication' : 'Add Time to Continue'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default AddMedicineScreen;

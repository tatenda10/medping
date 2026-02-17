import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  Switch,
  KeyboardAvoidingView,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { MaterialIcons } from '@expo/vector-icons';
import { CommonActions } from '@react-navigation/native';
import { MEDICATION_TYPES, getMedicationIcon } from '../../utils/medicationIcons';
import databaseService from '../../services/databaseService';
import firebaseService from '../../services/firebaseService';
import onboardingService from '../../services/onboardingService';
import { navigationRef } from '../../navigation/navigationRef';

const AddFirstMedicationScreen = ({ navigation }) => {
  const scrollViewRef = useRef(null);
  const quantityRemainingYRef = useRef(0);
  const lowStockYRef = useRef(0);
  
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [medicationType, setMedicationType] = useState('tablet');
  const [timesOfDay, setTimesOfDay] = useState([]);
  const [startDate, setStartDate] = useState(new Date());
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [endDate, setEndDate] = useState(null);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [isContinuous, setIsContinuous] = useState(true);
  const [foodInstructions, setFoodInstructions] = useState('');
  const [notes, setNotes] = useState('');
  const [reasonForTreatment, setReasonForTreatment] = useState('');
  const [quantityRemaining, setQuantityRemaining] = useState('');
  const [lowStockThreshold, setLowStockThreshold] = useState('7');
  const [schedulePattern, setSchedulePattern] = useState('daily');
  const [selectedDays, setSelectedDays] = useState([]); // For weekly pattern: ['monday', 'tuesday', etc.]
  const [alternatingType, setAlternatingType] = useState('left_right'); // left_right, day_cycle
  const [alternatingCurrent, setAlternatingCurrent] = useState('left'); // left, right, day1, day2
  const [alternatingDaysOn, setAlternatingDaysOn] = useState('3'); // For day cycle: days to take
  const [alternatingDaysOff, setAlternatingDaysOff] = useState('1'); // For day cycle: days to skip
  
  // Time picker states
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timePickerIndex, setTimePickerIndex] = useState(null);
  const [tempTime, setTempTime] = useState(new Date());
  const [canContinue, setCanContinue] = useState(false);

  // Helper function to scroll to a position
  const scrollToPosition = (y) => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ y, animated: true });
    }
  };

  useEffect(() => {
    checkExistingMedications();
    // Track screen view
    firebaseService.trackScreenView('onboarding_add_first_medication');
  }, []);

  useEffect(() => {
    setCanContinue(
      name.trim().length > 0 &&
      dosage.trim().length > 0 &&
      timesOfDay.length > 0
    );
  }, [name, dosage, timesOfDay]);

  const checkExistingMedications = async () => {
    try {
      await databaseService.ensureInitialized();
      const guestMedications = await databaseService.getMedications('guest');
      if (guestMedications.length > 0) {
        Alert.alert(
          'Medications Found',
          `You have ${guestMedications.length} medication(s) ready to save. Would you like to add another or continue?`,
          [
            { text: 'Add Another', style: 'default' },
            {
              text: 'Continue',
              onPress: () => navigation.navigate('CreateAccount'),
            },
          ]
        );
      }
    } catch (error) {
      console.error('Error checking medications:', error);
    }
  };

  const formatTime = (date) => {
    if (!date) return '';
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const handleAddTime = () => {
    const newTime = new Date();
    newTime.setHours(8, 0, 0, 0);
    setTimesOfDay([...timesOfDay, newTime]);
  };

  const handleRemoveTime = (index) => {
    const newTimes = timesOfDay.filter((_, i) => i !== index);
    setTimesOfDay(newTimes);
  };

  const openTimePicker = (index) => {
    setTempTime(timesOfDay[index] || new Date());
    setTimePickerIndex(index);
    setShowTimePicker(true);
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

  const handleSkip = async () => {
    try {
      console.log('⏭️ Skip button pressed');
      // Mark onboarding as complete
      await onboardingService.completeOnboarding();
      console.log('✅ Onboarding marked as complete');
      
      // Wait a moment for AsyncStorage to update
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Always use navigationRef to reset navigation stack to MainApp
      // This ensures we're resetting at the root level (AppNavigator)
      if (navigationRef.current?.isReady()) {
        console.log('🔄 Resetting navigation to MainApp via navigationRef');
        navigationRef.current.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: 'MainApp' }],
          })
        );
      } else {
        console.warn('⚠️ Navigation ref not ready, waiting and retrying...');
        // Wait a bit more and retry
        setTimeout(() => {
          if (navigationRef.current?.isReady()) {
            console.log('🔄 Retrying navigation reset to MainApp');
            navigationRef.current.dispatch(
              CommonActions.reset({
                index: 0,
                routes: [{ name: 'MainApp' }],
              })
            );
          } else {
            console.error('❌ Navigation ref still not ready after retry');
          }
        }, 500);
      }
    } catch (error) {
      console.error('❌ Error skipping medication:', error);
      // Fallback: try to navigate using navigationRef one more time
      try {
        if (navigationRef.current?.isReady()) {
          navigationRef.current.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: 'MainApp' }],
            })
          );
        }
      } catch (fallbackError) {
        console.error('❌ Fallback navigation also failed:', fallbackError);
      }
    }
  };

  const handleSave = async () => {
    if (!canContinue) {
      Alert.alert('Required Fields', 'Please fill in medication name, dosage, and add at least one time');
      return;
    }

    try {
      await databaseService.ensureInitialized();

      const medicationId = `med_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const formattedTimes = timesOfDay.map((time) => formatTime(time));

      const medicationData = {
        id: medicationId,
        user_id: 'guest',
        name: name.trim(),
        dosage: dosage.trim(),
        medication_type: medicationType,
        frequency: timesOfDay.length === 1 ? 'daily' : 'custom',
        times_per_day: timesOfDay.length,
        times_of_day: JSON.stringify(formattedTimes),
        start_date: startDate.toISOString(),
        end_date: isContinuous ? null : (endDate ? endDate.toISOString() : null),
        is_continuous: isContinuous,
        food_instructions: foodInstructions.trim() || null,
        notes: notes.trim() || null,
        reason_for_treatment: reasonForTreatment.trim() || null,
        quantity_remaining: quantityRemaining ? parseInt(quantityRemaining) : null,
        low_stock_threshold: lowStockThreshold ? parseInt(lowStockThreshold) : 7,
        schedule_pattern: schedulePattern,
        selected_days: schedulePattern === 'weekly' ? JSON.stringify(selectedDays) : null,
        alternating_type: schedulePattern === 'alternating' ? alternatingType : null,
        alternating_current: schedulePattern === 'alternating' ? alternatingCurrent : null,
        alternating_days_on: schedulePattern === 'alternating' && alternatingType === 'day_cycle' ? parseInt(alternatingDaysOn) : null,
        alternating_days_off: schedulePattern === 'alternating' && alternatingType === 'day_cycle' ? parseInt(alternatingDaysOff) : null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        server_synced: 0,
        deleted: 0,
      };

      await databaseService.saveMedication(medicationData, true);

      // Track first medication added
      firebaseService.firstMedicationAdded(medicationType);

      Alert.alert(
        'Medication Added! 🎉',
        'Start exploring the app! You can create an account later from Settings to sync your data.',
        [
          {
            text: 'Add Another',
            onPress: () => {
              // Reset form
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
              setQuantityRemaining('');
              setLowStockThreshold('7');
              setSchedulePattern('daily');
              setSelectedDays([]);
              setAlternatingType('left_right');
              setAlternatingCurrent('left');
              setAlternatingDaysOn('3');
              setAlternatingDaysOff('1');
            },
          },
          {
            text: 'Go to Dashboard',
            style: 'default',
            onPress: async () => {
              try {
                // Mark onboarding as complete
                await onboardingService.completeOnboarding();
                // Wait a moment for AsyncStorage to update
                await new Promise(resolve => setTimeout(resolve, 100));
                
                // Use navigationRef to reset to MainApp at the root level
                if (navigationRef.current?.isReady()) {
                  navigationRef.current.dispatch(
                    CommonActions.reset({
                      index: 0,
                      routes: [{ name: 'MainApp' }],
                    })
                  );
                } else {
                  const parent = navigation.getParent();
                  if (parent) {
                    parent.navigate('MainApp');
                  } else {
                    navigation.goBack();
                  }
                }
              } catch (error) {
                console.error('Error navigating to dashboard:', error);
                navigation.getParent()?.goBack();
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error saving medication:', error);
      Alert.alert('Error', 'Failed to save medication. Please try again.');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="px-6 py-6 flex-row justify-between items-center border-b border-gray-200">
        <Text className="text-lg font-bold text-gray-900 flex-1">Add Medication</Text>
        <TouchableOpacity onPress={handleSkip} className="px-4 py-2">
          <Text className="text-base font-semibold" style={{ color: '#90CDF4' }}>Skip</Text>
        </TouchableOpacity>
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
              <Text className="text-base font-semibold text-gray-800 mb-2">
                Medication Name <Text className="text-danger">*</Text>
              </Text>
              <TextInput
                className="rounded-lg p-3 text-base bg-gray-50"
                placeholder="e.g., Aspirin"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
            </View>

            {/* Dosage */}
            <View className="mb-6">
              <Text className="text-base font-semibold text-gray-800 mb-2">
                Dosage <Text className="text-danger">*</Text>
              </Text>
              <TextInput
                className="rounded-lg p-3 text-base bg-gray-50"
                placeholder="e.g., 100mg, 1 tablet"
                value={dosage}
                onChangeText={setDosage}
              />
            </View>

            {/* Medication Type */}
            <View className="mb-6">
              <Text className="text-base font-semibold text-gray-800 mb-2">
                Medication Type <Text className="text-danger">*</Text>
              </Text>
              <View className="flex-row flex-wrap justify-between gap-2">
                {MEDICATION_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type.value}
                    className={`w-[31%] py-3 px-2 rounded-xl border-2 items-center justify-center ${
                      medicationType === type.value
                        ? 'bg-gray-50 border-2'
                        : 'bg-gray-50 border-gray-300'
                    }`}
                    style={{
                      borderColor: medicationType === type.value ? '#90CDF4' : '#d1d5db',
                      backgroundColor: medicationType === type.value ? '#F0F9FF' : '#f9fafb',
                    }}
                    onPress={() => setMedicationType(type.value)}
                    activeOpacity={0.7}
                  >
                    <View className="flex-row items-center justify-start gap-2 w-full">
                      {getMedicationIcon(
                        type.value, 
                        20, 
                        medicationType === type.value ? '#90CDF4' : null
                      )}
                      <Text className={`text-xs font-medium ${
                        medicationType === type.value
                          ? 'font-semibold'
                          : 'text-gray-600'
                      }`}
                      style={{ color: medicationType === type.value ? '#90CDF4' : '#4b5563' }}
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
                <Text className="text-base font-semibold text-gray-800">
                  Times of Day <Text className="text-danger">*</Text>
                </Text>
                <TouchableOpacity
                  onPress={handleAddTime}
                  className="w-9 h-9 rounded-full items-center justify-center"
                  style={{ backgroundColor: '#90CDF4' }}
                >
                  <Text className="text-white text-xl font-bold">+</Text>
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
                    className="flex-1 rounded-lg p-3 bg-gray-50"
                    onPress={() => openTimePicker(index)}
                  >
                    <Text className="text-base text-gray-800">
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
                    className="w-9 h-9 rounded-full bg-danger items-center justify-center"
                  >
                    <Text className="text-white text-lg font-bold">✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            {/* Schedule Pattern */}
            <View className="mb-6">
              <Text className="text-base font-semibold text-gray-800 mb-2">Schedule Pattern</Text>
              <View className="flex-row gap-2.5 mt-2">
                <TouchableOpacity
                  className={`flex-1 py-3 px-4 rounded-lg border-2 items-center ${
                    schedulePattern === 'daily'
                      ? 'bg-gray-50'
                      : 'bg-gray-50 border-gray-300'
                  }`}
                  style={{
                    borderColor: schedulePattern === 'daily' ? '#90CDF4' : '#d1d5db',
                    backgroundColor: schedulePattern === 'daily' ? '#F0F9FF' : '#f9fafb',
                  }}
                  onPress={() => setSchedulePattern('daily')}
                >
                  <Text className={`text-sm font-medium ${
                    schedulePattern === 'daily'
                      ? 'font-semibold'
                      : 'text-gray-600'
                  }`}
                  style={{ color: schedulePattern === 'daily' ? '#90CDF4' : '#4b5563' }}
                  >
                    Daily
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className={`flex-1 py-3 px-4 rounded-lg border-2 items-center ${
                    schedulePattern === 'weekly'
                      ? 'bg-gray-50'
                      : 'bg-gray-50 border-gray-300'
                  }`}
                  style={{
                    borderColor: schedulePattern === 'weekly' ? '#90CDF4' : '#d1d5db',
                    backgroundColor: schedulePattern === 'weekly' ? '#F0F9FF' : '#f9fafb',
                  }}
                  onPress={() => setSchedulePattern('weekly')}
                >
                  <Text className={`text-sm font-medium ${
                    schedulePattern === 'weekly'
                      ? 'font-semibold'
                      : 'text-gray-600'
                  }`}
                  style={{ color: schedulePattern === 'weekly' ? '#90CDF4' : '#4b5563' }}
                  >
                    Weekly
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className={`flex-1 py-3 px-4 rounded-lg border-2 items-center ${
                    schedulePattern === 'alternating'
                      ? 'bg-gray-50'
                      : 'bg-gray-50 border-gray-300'
                  }`}
                  style={{
                    borderColor: schedulePattern === 'alternating' ? '#90CDF4' : '#d1d5db',
                    backgroundColor: schedulePattern === 'alternating' ? '#F0F9FF' : '#f9fafb',
                  }}
                  onPress={() => setSchedulePattern('alternating')}
                >
                  <Text className={`text-sm font-medium ${
                    schedulePattern === 'alternating'
                      ? 'font-semibold'
                      : 'text-gray-600'
                  }`}
                  style={{ color: schedulePattern === 'alternating' ? '#90CDF4' : '#4b5563' }}
                  >
                    Alternating
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Weekly - Day Selection */}
              {schedulePattern === 'weekly' && (
                <View className="mt-4 p-3 bg-gray-100 rounded-lg">
                  <Text className="text-sm font-semibold text-gray-800 mb-3">Select Days:</Text>
                  <View className="gap-2.5">
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => {
                      const dayKey = day.toLowerCase();
                      const isSelected = selectedDays.includes(dayKey);
                      return (
                        <TouchableOpacity
                          key={day}
                          className={`py-4 px-4 rounded-xl border-2 flex-row items-center justify-between ${
                            isSelected
                              ? 'bg-gray-50'
                              : 'bg-white border-gray-300'
                          }`}
                          style={{
                            borderColor: isSelected ? '#90CDF4' : '#d1d5db',
                            backgroundColor: isSelected ? '#F0F9FF' : '#ffffff',
                          }}
                          onPress={() => {
                            if (isSelected) {
                              setSelectedDays(selectedDays.filter(d => d !== dayKey));
                            } else {
                              setSelectedDays([...selectedDays, dayKey]);
                            }
                          }}
                        >
                          <Text className={`text-base font-medium flex-1 ${
                            isSelected
                              ? 'font-semibold'
                              : 'text-gray-800'
                          }`}
                          style={{ color: isSelected ? '#90CDF4' : '#1f2937' }}
                          >
                            {day}
                          </Text>
                          {isSelected && (
                            <MaterialIcons name="check-circle" size={24} style={{ color: '#90CDF4' }} />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Alternating Options */}
              {schedulePattern === 'alternating' && (
                <View className="mt-4 p-3 bg-gray-100 rounded-lg">
                  <Text className="text-sm font-semibold text-gray-800 mb-2">Alternating Type:</Text>
                  <View className="flex-row gap-2.5">
                    <TouchableOpacity
                      className={`flex-1 py-3 px-4 rounded-lg border-2 items-center ${
                        alternatingType === 'left_right'
                          ? 'bg-gray-50'
                          : 'bg-gray-50 border-gray-300'
                      }`}
                      style={{
                        borderColor: alternatingType === 'left_right' ? '#90CDF4' : '#d1d5db',
                        backgroundColor: alternatingType === 'left_right' ? '#F0F9FF' : '#f9fafb',
                      }}
                      onPress={() => setAlternatingType('left_right')}
                    >
                      <Text className={`text-sm font-medium ${
                        alternatingType === 'left_right'
                          ? 'font-semibold'
                          : 'text-gray-600'
                      }`}
                      style={{ color: alternatingType === 'left_right' ? '#90CDF4' : '#4b5563' }}
                      >
                        Left/Right
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      className={`flex-1 py-3 px-4 rounded-lg border-2 items-center ${
                        alternatingType === 'day_cycle'
                          ? 'bg-gray-50'
                          : 'bg-gray-50 border-gray-300'
                      }`}
                      style={{
                        borderColor: alternatingType === 'day_cycle' ? '#90CDF4' : '#d1d5db',
                        backgroundColor: alternatingType === 'day_cycle' ? '#F0F9FF' : '#f9fafb',
                      }}
                      onPress={() => setAlternatingType('day_cycle')}
                    >
                      <Text className={`text-sm font-medium ${
                        alternatingType === 'day_cycle'
                          ? 'font-semibold'
                          : 'text-gray-600'
                      }`}
                      style={{ color: alternatingType === 'day_cycle' ? '#90CDF4' : '#4b5563' }}
                      >
                        Day Cycle
                      </Text>
                    </TouchableOpacity>
                  </View>
                  
                  {alternatingType === 'left_right' && (
                    <View className="mt-4">
                      <Text className="text-sm font-semibold text-gray-800 mb-2">Start with:</Text>
                      <View className="flex-row gap-2.5">
                        <TouchableOpacity
                          className={`flex-1 py-3 px-4 rounded-lg border-2 items-center ${
                            alternatingCurrent === 'left'
                              ? 'bg-gray-50'
                              : 'bg-gray-50 border-gray-300'
                          }`}
                          style={{
                            borderColor: alternatingCurrent === 'left' ? '#90CDF4' : '#d1d5db',
                            backgroundColor: alternatingCurrent === 'left' ? '#F0F9FF' : '#f9fafb',
                          }}
                          onPress={() => setAlternatingCurrent('left')}
                        >
                          <Text className={`text-sm font-medium ${
                            alternatingCurrent === 'left'
                              ? 'font-semibold'
                              : 'text-gray-600'
                          }`}
                          style={{ color: alternatingCurrent === 'left' ? '#90CDF4' : '#4b5563' }}
                          >
                            Left
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          className={`flex-1 py-3 px-4 rounded-lg border-2 items-center ${
                            alternatingCurrent === 'right'
                              ? 'bg-gray-50'
                              : 'bg-gray-50 border-gray-300'
                          }`}
                          style={{
                            borderColor: alternatingCurrent === 'right' ? '#90CDF4' : '#d1d5db',
                            backgroundColor: alternatingCurrent === 'right' ? '#F0F9FF' : '#f9fafb',
                          }}
                          onPress={() => setAlternatingCurrent('right')}
                        >
                          <Text className={`text-sm font-medium ${
                            alternatingCurrent === 'right'
                              ? 'font-semibold'
                              : 'text-gray-600'
                          }`}
                          style={{ color: alternatingCurrent === 'right' ? '#90CDF4' : '#4b5563' }}
                          >
                            Right
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                  
                  {alternatingType === 'day_cycle' && (
                    <View className="mt-4">
                      <Text className="text-sm font-semibold text-gray-800 mb-2">Days On / Days Off:</Text>
                      <View className="flex-row gap-3 mt-2">
                        <View className="flex-1">
                          <Text className="text-xs text-gray-600 mb-1">Take for (days):</Text>
                          <TextInput
                            className="rounded-lg p-2 text-base bg-gray-50 text-center"
                            value={alternatingDaysOn}
                            onChangeText={setAlternatingDaysOn}
                            keyboardType="number-pad"
                            placeholder="3"
                          />
                        </View>
                        <View className="flex-1">
                          <Text className="text-xs text-gray-600 mb-1">Skip for (days):</Text>
                          <TextInput
                            className="rounded-lg p-2 text-base bg-gray-50 text-center"
                            value={alternatingDaysOff}
                            onChangeText={setAlternatingDaysOff}
                            keyboardType="number-pad"
                            placeholder="1"
                          />
                        </View>
                      </View>
                      <View className="mt-4">
                        <Text className="text-sm font-semibold text-gray-800 mb-2">Start with:</Text>
                        <View className="flex-row gap-2.5">
                          <TouchableOpacity
                            className={`flex-1 py-3 px-4 rounded-lg border-2 items-center ${
                              alternatingCurrent === 'day1'
                                ? 'bg-gray-50'
                                : 'bg-gray-50 border-gray-300'
                            }`}
                            style={{
                              borderColor: alternatingCurrent === 'day1' ? '#90CDF4' : '#d1d5db',
                              backgroundColor: alternatingCurrent === 'day1' ? '#F0F9FF' : '#f9fafb',
                            }}
                            onPress={() => setAlternatingCurrent('day1')}
                          >
                            <Text className={`text-sm font-medium ${
                              alternatingCurrent === 'day1'
                                ? 'font-semibold'
                                : 'text-gray-600'
                            }`}
                            style={{ color: alternatingCurrent === 'day1' ? '#90CDF4' : '#4b5563' }}
                            >
                              Day 1 (Take)
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            className={`flex-1 py-3 px-4 rounded-lg border-2 items-center ${
                              alternatingCurrent === 'day2'
                                ? 'bg-gray-50'
                                : 'bg-gray-50 border-gray-300'
                            }`}
                            style={{
                              borderColor: alternatingCurrent === 'day2' ? '#90CDF4' : '#d1d5db',
                              backgroundColor: alternatingCurrent === 'day2' ? '#F0F9FF' : '#f9fafb',
                            }}
                            onPress={() => setAlternatingCurrent('day2')}
                          >
                            <Text className={`text-sm font-medium ${
                              alternatingCurrent === 'day2'
                                ? 'font-semibold'
                                : 'text-gray-600'
                            }`}
                            style={{ color: alternatingCurrent === 'day2' ? '#90CDF4' : '#4b5563' }}
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
              <Text className="text-base font-semibold text-gray-800 mb-2">
                Start Date <Text className="text-danger">*</Text>
              </Text>
              <TouchableOpacity
                className="rounded-lg p-3 bg-gray-50"
                onPress={() => setShowStartDatePicker(true)}
              >
                <Text className="text-base text-gray-800">
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
                  <Text className="text-base font-semibold text-gray-800">Continuous Medication</Text>
                  <Text className="text-xs text-gray-600 mt-1">
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
                  <Text className="text-base font-semibold text-gray-800 mb-2">End Date</Text>
                  <TouchableOpacity
                    className="rounded-lg p-3 bg-gray-50"
                    onPress={() => setShowEndDatePicker(true)}
                  >
                    <Text className="text-base text-gray-800">
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
              <Text className="text-base font-semibold text-gray-800 mb-2">Food Instructions</Text>
              <TextInput
                className="rounded-lg p-3 text-base bg-gray-50 h-20"
                style={{ textAlignVertical: 'top' }}
                placeholder="e.g., Take with food, Take on empty stomach"
                value={foodInstructions}
                onChangeText={setFoodInstructions}
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Reason for Treatment */}
            <View className="mb-6">
              <Text className="text-base font-semibold text-gray-800 mb-2">Reason for Treatment</Text>
              <TextInput
                className="rounded-lg p-3 text-base bg-gray-50 h-20"
                style={{ textAlignVertical: 'top' }}
                placeholder="Why are you taking this medication? (e.g., High blood pressure, Diabetes)"
                value={reasonForTreatment}
                onChangeText={setReasonForTreatment}
                multiline
                numberOfLines={2}
              />
            </View>

            {/* Notes */}
            <View className="mb-6">
              <Text className="text-base font-semibold text-gray-800 mb-2">Notes</Text>
              <TextInput
                className="rounded-lg p-3 text-base bg-gray-50 h-20"
                style={{ textAlignVertical: 'top' }}
                placeholder="Additional notes about this medication"
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Quantity Remaining */}
            <View 
              className="mb-6"
              onLayout={(event) => {
                quantityRemainingYRef.current = event.nativeEvent.layout.y;
              }}
            >
              <Text className="text-base font-semibold text-gray-800 mb-2">Quantity Remaining</Text>
              <TextInput
                className="rounded-lg p-3 text-base bg-gray-50"
                placeholder="e.g., 30 tablets"
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
              <Text className="text-base font-semibold text-gray-800 mb-2">Low Stock Alert (days)</Text>
              <TextInput
                className="rounded-lg p-3 text-base bg-gray-50"
                placeholder="7"
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
      <View className="p-6 border-t border-gray-300">
        <TouchableOpacity
          className={`py-4 rounded-xl items-center ${
            canContinue ? '' : 'bg-gray-400'
          }`}
          style={{
            backgroundColor: canContinue ? '#90CDF4' : '#9ca3af',
          }}
          onPress={handleSave}
          disabled={!canContinue}
          activeOpacity={0.8}
        >
          <Text className="text-white text-lg font-semibold">
            {timesOfDay.length > 0 ? 'Save & Continue' : 'Add Time to Continue'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default AddFirstMedicationScreen;

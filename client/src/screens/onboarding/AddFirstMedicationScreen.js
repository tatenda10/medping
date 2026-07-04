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
  Modal,
  StyleSheet,
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

const SKY_BLUE = '#90CDF4';

const formStyles = StyleSheet.create({
  fieldGroup: {
    marginBottom: 22,
  },
  label: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  required: {
    color: '#EF4444',
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 17,
    color: '#111827',
  },
  inputFocused: {
    borderColor: SKY_BLUE,
    backgroundColor: '#F8FCFF',
  },
  inputMultiline: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  pickerButton: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  pickerText: {
    fontSize: 17,
    color: '#111827',
  },
});

const FormLabel = ({ children, required }) => (
  <Text style={formStyles.label}>
    {children}
    {required ? <Text style={formStyles.required}> *</Text> : null}
  </Text>
);

const AddFirstMedicationScreen = ({ navigation }) => {
  const scrollViewRef = useRef(null);
  const fieldPositions = useRef({});
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [focusedField, setFocusedField] = useState(null);
  
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
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [savedMedicationName, setSavedMedicationName] = useState('');

  const onFieldLayout = (key, event) => {
    fieldPositions.current[key] = event.nativeEvent.layout.y;
  };

  const scrollToField = (key) => {
    setTimeout(() => {
      const y = fieldPositions.current[key];
      if (y !== undefined && scrollViewRef.current) {
        const offset = keyboardHeight > 0 ? 120 : 24;
        scrollViewRef.current.scrollTo({
          y: Math.max(0, y - offset),
          animated: true,
        });
      }
    }, Platform.OS === 'ios' ? 100 : 80);
  };

  const getInputStyle = (key, extra = {}) => [
    formStyles.input,
    extra,
    focusedField === key && formStyles.inputFocused,
  ];

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
      setFocusedField(null);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (keyboardHeight > 0 && focusedField) {
      scrollToField(focusedField);
    }
  }, [keyboardHeight, focusedField]);

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

  const goToCreateAccount = async () => {
    try {
      setShowSuccessModal(false);
      await onboardingService.completeOnboarding();
      navigation.navigate('CreateAccount');
    } catch (error) {
      console.error('Error navigating to create account:', error);
    }
  };

  const goToDashboard = async () => {
    try {
      setShowSuccessModal(false);
      await onboardingService.completeOnboarding();
      await new Promise((resolve) => setTimeout(resolve, 100));

      if (navigationRef.current?.isReady()) {
        navigationRef.current.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: 'MainApp' }],
          })
        );
      } else {
        navigation.getParent()?.navigate('MainApp');
      }
    } catch (error) {
      console.error('Error navigating to dashboard:', error);
      navigation.getParent()?.goBack();
    }
  };

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
              text: 'Create Account',
              onPress: goToCreateAccount,
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

      setSavedMedicationName(name.trim());
      setShowSuccessModal(true);
    } catch (error) {
      console.error('Error saving medication:', error);
      Alert.alert('Error', 'Failed to save medication. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Add Medication</Text>
        <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.flex}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingBottom: keyboardHeight + 140 }}
          nestedScrollEnabled
        >
          <View style={styles.formContent}>
            <View
              style={formStyles.fieldGroup}
              onLayout={(event) => onFieldLayout('name', event)}
            >
              <FormLabel required>Medication Name</FormLabel>
              <TextInput
                style={getInputStyle('name')}
                placeholder="e.g., Aspirin"
                placeholderTextColor="#9CA3AF"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                onFocus={() => {
                  setFocusedField('name');
                  scrollToField('name');
                }}
                onBlur={() => setFocusedField(null)}
              />
            </View>

            <View
              style={formStyles.fieldGroup}
              onLayout={(event) => onFieldLayout('dosage', event)}
            >
              <FormLabel required>Dosage</FormLabel>
              <TextInput
                style={getInputStyle('dosage')}
                placeholder="e.g., 100mg, 1 tablet"
                placeholderTextColor="#9CA3AF"
                value={dosage}
                onChangeText={setDosage}
                onFocus={() => {
                  setFocusedField('dosage');
                  scrollToField('dosage');
                }}
                onBlur={() => setFocusedField(null)}
              />
            </View>

            {/* Medication Type */}
            <View style={formStyles.fieldGroup}>
              <FormLabel required>Medication Type</FormLabel>
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
            <View style={formStyles.fieldGroup}>
              <View className="flex-row justify-between items-center mb-2">
                <Text style={formStyles.label}>
                  Times of Day<Text style={formStyles.required}> *</Text>
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
                    style={formStyles.pickerButton}
                    onPress={() => openTimePicker(index)}
                  >
                    <Text style={formStyles.pickerText}>{formatTime(time)}</Text>
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
            <View style={formStyles.fieldGroup}>
              <FormLabel>Schedule Pattern</FormLabel>
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
                    <View
                      className="mt-4"
                      onLayout={(event) => onFieldLayout('alternatingDaysOn', event)}
                    >
                      <Text className="text-sm font-semibold text-gray-800 mb-2">Days On / Days Off:</Text>
                      <View className="flex-row gap-3 mt-2">
                        <View className="flex-1">
                          <Text style={[formStyles.label, { fontSize: 15, marginBottom: 6 }]}>Take for (days)</Text>
                          <TextInput
                            style={getInputStyle('alternatingDaysOn', { textAlign: 'center' })}
                            value={alternatingDaysOn}
                            onChangeText={setAlternatingDaysOn}
                            keyboardType="number-pad"
                            placeholder="3"
                            placeholderTextColor="#9CA3AF"
                            onFocus={() => {
                              setFocusedField('alternatingDaysOn');
                              scrollToField('alternatingDaysOn');
                            }}
                            onBlur={() => setFocusedField(null)}
                          />
                        </View>
                        <View className="flex-1">
                          <Text style={[formStyles.label, { fontSize: 15, marginBottom: 6 }]}>Skip for (days)</Text>
                          <TextInput
                            style={getInputStyle('alternatingDaysOff', { textAlign: 'center' })}
                            value={alternatingDaysOff}
                            onChangeText={setAlternatingDaysOff}
                            keyboardType="number-pad"
                            placeholder="1"
                            placeholderTextColor="#9CA3AF"
                            onFocus={() => {
                              setFocusedField('alternatingDaysOff');
                              scrollToField('alternatingDaysOff');
                            }}
                            onBlur={() => setFocusedField(null)}
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
            <View style={formStyles.fieldGroup}>
              <FormLabel required>Start Date</FormLabel>
              <TouchableOpacity
                style={formStyles.pickerButton}
                onPress={() => setShowStartDatePicker(true)}
              >
                <Text style={formStyles.pickerText}>{startDate.toLocaleDateString()}</Text>
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
            <View style={formStyles.fieldGroup}>
              <View className="flex-row justify-between items-center">
                <View className="flex-1">
                  <FormLabel>Continuous Medication</FormLabel>
                  <Text style={{ fontSize: 15, color: '#6B7280', marginTop: 4 }}>
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
                  <FormLabel>End Date</FormLabel>
                  <TouchableOpacity
                    style={formStyles.pickerButton}
                    onPress={() => setShowEndDatePicker(true)}
                  >
                    <Text style={formStyles.pickerText}>
                      {endDate ? endDate.toLocaleDateString() : 'Select end date'}
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

            <View
              style={formStyles.fieldGroup}
              onLayout={(event) => onFieldLayout('foodInstructions', event)}
            >
              <FormLabel>Food Instructions</FormLabel>
              <TextInput
                style={[...getInputStyle('foodInstructions'), formStyles.inputMultiline]}
                placeholder="e.g., Take with food, Take on empty stomach"
                placeholderTextColor="#9CA3AF"
                value={foodInstructions}
                onChangeText={setFoodInstructions}
                multiline
                numberOfLines={3}
                onFocus={() => {
                  setFocusedField('foodInstructions');
                  scrollToField('foodInstructions');
                }}
                onBlur={() => setFocusedField(null)}
              />
            </View>

            <View
              style={formStyles.fieldGroup}
              onLayout={(event) => onFieldLayout('reasonForTreatment', event)}
            >
              <FormLabel>Reason for Treatment</FormLabel>
              <TextInput
                style={[...getInputStyle('reasonForTreatment'), formStyles.inputMultiline]}
                placeholder="Why are you taking this medication? (e.g., High blood pressure)"
                placeholderTextColor="#9CA3AF"
                value={reasonForTreatment}
                onChangeText={setReasonForTreatment}
                multiline
                numberOfLines={2}
                onFocus={() => {
                  setFocusedField('reasonForTreatment');
                  scrollToField('reasonForTreatment');
                }}
                onBlur={() => setFocusedField(null)}
              />
            </View>

            <View
              style={formStyles.fieldGroup}
              onLayout={(event) => onFieldLayout('notes', event)}
            >
              <FormLabel>Notes</FormLabel>
              <TextInput
                style={[...getInputStyle('notes'), formStyles.inputMultiline]}
                placeholder="Additional notes about this medication"
                placeholderTextColor="#9CA3AF"
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
                onFocus={() => {
                  setFocusedField('notes');
                  scrollToField('notes');
                }}
                onBlur={() => setFocusedField(null)}
              />
            </View>

            <View
              style={formStyles.fieldGroup}
              onLayout={(event) => onFieldLayout('quantityRemaining', event)}
            >
              <FormLabel>Quantity Remaining</FormLabel>
              <TextInput
                style={getInputStyle('quantityRemaining')}
                placeholder="e.g., 30 tablets"
                placeholderTextColor="#9CA3AF"
                value={quantityRemaining}
                onChangeText={setQuantityRemaining}
                keyboardType="number-pad"
                onFocus={() => {
                  setFocusedField('quantityRemaining');
                  scrollToField('quantityRemaining');
                }}
                onBlur={() => setFocusedField(null)}
              />
            </View>

            <View
              style={formStyles.fieldGroup}
              onLayout={(event) => onFieldLayout('lowStockThreshold', event)}
            >
              <FormLabel>Low Stock Alert (days)</FormLabel>
              <TextInput
                style={getInputStyle('lowStockThreshold')}
                placeholder="7"
                placeholderTextColor="#9CA3AF"
                value={lowStockThreshold}
                onChangeText={setLowStockThreshold}
                keyboardType="number-pad"
                onFocus={() => {
                  setFocusedField('lowStockThreshold');
                  scrollToField('lowStockThreshold');
                }}
                onBlur={() => setFocusedField(null)}
              />
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.saveButton, !canContinue && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={!canContinue}
            activeOpacity={0.8}
          >
            <Text style={styles.saveButtonText}>
              {timesOfDay.length > 0 ? 'Save & Continue' : 'Add Time to Continue'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={showSuccessModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={modalStyles.overlay}>
          <View style={modalStyles.card}>
            <View style={modalStyles.iconWrap}>
              <MaterialIcons name="check" size={36} color="#FFFFFF" />
            </View>

            <Text style={modalStyles.title}>Medication added!</Text>
            {savedMedicationName ? (
              <Text style={modalStyles.medName}>{savedMedicationName}</Text>
            ) : null}
            <Text style={modalStyles.subtitle}>
              Your reminder is set. Create an account to sync across devices, invite caregivers, and unlock Premium.
            </Text>

            <TouchableOpacity
              style={modalStyles.primaryButton}
              onPress={goToCreateAccount}
              activeOpacity={0.85}
            >
              <Text style={modalStyles.primaryButtonText}>Create Account</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={modalStyles.secondaryButton}
              onPress={goToDashboard}
              activeOpacity={0.85}
            >
              <Text style={modalStyles.secondaryButtonText}>Continue to Dashboard</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
    alignItems: 'center',
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: SKY_BLUE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  medName: {
    fontSize: 16,
    fontWeight: '600',
    color: SKY_BLUE,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  primaryButton: {
    width: '100%',
    backgroundColor: SKY_BLUE,
    paddingVertical: 15,
    borderRadius: 28,
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    width: '100%',
    paddingVertical: 15,
    borderRadius: 28,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: SKY_BLUE,
  },
  secondaryButtonText: {
    color: SKY_BLUE,
    fontSize: 16,
    fontWeight: '600',
  },
});

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  skipButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  skipText: {
    fontSize: 17,
    fontWeight: '600',
    color: SKY_BLUE,
  },
  formContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  footer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  saveButton: {
    backgroundColor: SKY_BLUE,
    paddingVertical: 16,
    borderRadius: 28,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
});

export default AddFirstMedicationScreen;

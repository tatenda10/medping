import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { clerkAxios } from '../utils/clerkAxios';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import notificationService from '../services/notificationService';
import databaseService from '../services/databaseService';
import syncService from '../services/syncService';
import { MEDICATION_TYPES, getMedicationIcon } from '../utils/medicationIcons';
import { useAuth } from '../context/AuthContext';
import CreateAccountPrompt from '../components/CreateAccountPrompt';

const EditMedicineScreen = ({ route, navigation }) => {
  const { userId, isAuthenticated } = useAuth();
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
      const currentUserId = userId || 'guest';
      
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
        id: medicationId,
        user_id: currentUserId,
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

      // Update local database first
      if (Platform.OS !== 'web') {
        try {
          await databaseService.saveMedication(medicationData, false);
        } catch (dbError) {
          console.warn('⚠️ Failed to update local database:', dbError.message);
        }
      }

      // Reschedule notifications
      try {
        await notificationService.scheduleMedicationNotifications(medicationData);
      } catch (notifError) {
        console.error('⚠️ Error rescheduling notifications:', notifError);
      }

      // Try to sync to server (if online and authenticated)
      const online = await syncService.isOnline();
      if (online && isAuthenticated) {
        try {
          const response = await clerkAxios.put(`/medications/${medicationId}`, medicationData);
          if (response.data.success) {
            if (Platform.OS !== 'web') {
              await databaseService.saveMedication(response.data.medication, false);
              await databaseService.markMedicationSynced(medicationId);
            }
          }
        } catch (error) {
          console.log('📴 Offline or server error - saved locally, will sync later');
        }
      }

      Alert.alert('Success', 'Medication updated successfully', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
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
      <SafeAreaView className="flex-1 bg-white" edges={['top', 'bottom']}>
        <View className="flex-1 justify-center items-center p-5">
          <Text className="text-base text-gray-600 text-center mb-5">
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
      </SafeAreaView>
    );
  }

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
        <Text className="text-2xl font-bold text-gray-900 flex-1">Edit Medication</Text>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 120 }}
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
                placeholder="e.g., 10mg, 2 tablets, 5ml"
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
                      medicationType === type.value 
                        ? 'bg-light-blue' 
                        : 'bg-gray-50'
                    }`}
                    onPress={() => setMedicationType(type.value)}
                    activeOpacity={0.7}
                  >
                    <View className="flex-row items-center justify-start gap-2 w-full">
                      {getMedicationIcon(type.value, 20, medicationType === type.value ? '#fff' : '#666')}
                      <Text className={`text-xs font-medium ${
                        medicationType === type.value 
                          ? 'text-white' 
                          : 'text-gray-700'
                      }`}>
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
                >
                  <Text className="text-white text-xl font-bold">+</Text>
                </TouchableOpacity>
              </View>
              {timesOfDay.length === 0 ? (
                <Text className="text-sm text-gray-400 italic mt-2">
                  No times added. Tap + to add a time.
                </Text>
              ) : (
                timesOfDay.map((time, index) => (
                  <View key={index} className="flex-row items-center mb-3 gap-3">
                    <TouchableOpacity
                      className="flex-1 bg-gray-50 rounded-xl p-4"
                      onPress={() => openTimePicker(index)}
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
                      style={{ backgroundColor: '#F44336' }}
                    >
                      <Text className="text-white text-lg font-bold">✕</Text>
                    </TouchableOpacity>
                  </View>
                ))
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
              <View className="flex-row justify-between items-center mb-3">
                <Text className="text-sm font-semibold text-gray-600">Continuous Medication</Text>
                <TouchableOpacity
                  className={`w-14 h-8 rounded-full items-center justify-center ${
                    isContinuous ? 'bg-light-blue' : 'bg-gray-300'
                  }`}
                  onPress={() => setIsContinuous(!isContinuous)}
                  activeOpacity={0.8}
                >
                  <View
                    className={`w-6 h-6 rounded-full bg-white ${
                      isContinuous ? 'ml-6' : 'mr-6'
                    }`}
                  />
                </TouchableOpacity>
              </View>
              {!isContinuous && (
                <>
                  <Text className="text-sm font-semibold text-gray-600 mb-2 mt-3">End Date</Text>
                  <TouchableOpacity
                    className="bg-gray-50 rounded-xl p-4"
                    onPress={() => setShowEndDatePicker(true)}
                  >
                    <Text className="text-base text-gray-900 font-medium">
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
                </>
              )}
            </View>

            {/* Food Instructions */}
            <View className="mb-6">
              <Text className="text-sm font-semibold text-gray-600 mb-2">Food Instructions (Optional)</Text>
              <TextInput
                className="bg-gray-50 rounded-xl p-4 text-base"
                placeholder="e.g., Take with food, Take on an empty stomach"
                placeholderTextColor="#999"
                value={foodInstructions}
                onChangeText={setFoodInstructions}
                multiline
                style={{ minHeight: 80, textAlignVertical: 'top' }}
              />
            </View>

            {/* Notes */}
            <View className="mb-6">
              <Text className="text-sm font-semibold text-gray-600 mb-2">Notes (Optional)</Text>
              <TextInput
                className="bg-gray-50 rounded-xl p-4 text-base"
                placeholder="Any additional notes about this medication"
                placeholderTextColor="#999"
                value={notes}
                onChangeText={setNotes}
                multiline
                style={{ minHeight: 80, textAlignVertical: 'top' }}
              />
            </View>

            {/* Photo */}
            <View className="mb-6">
              <Text className="text-sm font-semibold text-gray-600 mb-2">Medication Photo (Optional)</Text>
              <TouchableOpacity 
                className="bg-gray-50 rounded-xl p-4 items-center justify-center"
                onPress={pickImage}
                style={{ minHeight: 120 }}
              >
                {photo ? (
                  <Image source={{ uri: photo }} className="w-full h-48 rounded-xl" resizeMode="cover" />
                ) : (
                  <View className="items-center">
                    <MaterialIcons name="add-photo-alternate" size={32} color="#999" />
                    <Text className="text-gray-500 mt-2">Upload Photo</Text>
                  </View>
                )}
              </TouchableOpacity>
              {photo && (
                <TouchableOpacity
                  onPress={() => setPhoto(null)}
                  className="mt-3 bg-red-100 rounded-xl p-3 items-center"
                >
                  <Text className="text-red-600 font-semibold">Remove Photo</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Quantity Remaining */}
            <View className="mb-6">
              <Text className="text-sm font-semibold text-gray-600 mb-2">Quantity Remaining (Optional)</Text>
              <TextInput
                className="bg-gray-50 rounded-xl p-4 text-base"
                placeholder="e.g., 30"
                placeholderTextColor="#999"
                value={quantityRemaining}
                onChangeText={setQuantityRemaining}
                keyboardType="number-pad"
              />
            </View>

            {/* Low Stock Threshold */}
            <View className="mb-6">
              <Text className="text-sm font-semibold text-gray-600 mb-2">Low Stock Alert (days)</Text>
              <TextInput
                className="bg-gray-50 rounded-xl p-4 text-base"
                placeholder="e.g., 7"
                placeholderTextColor="#999"
                value={lowStockThreshold}
                onChangeText={setLowStockThreshold}
                keyboardType="number-pad"
              />
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              className={`py-4 rounded-xl items-center justify-center mb-6 ${
                loading ? 'bg-gray-400' : 'bg-light-blue'
              }`}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white text-lg font-semibold">Update Medication</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// Styles removed - using NativeWind classes instead

export default EditMedicineScreen;


import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import axios from 'axios';
import BASE_URL from '../context/Api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TIMEZONES from '../utils/timezones';

const OnboardingScreen = ({ onComplete, userToken }) => {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: Age, 2: Gender, 3: Timezone
  const [age, setAge] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [gender, setGender] = useState('');
  const [timezone, setTimezone] = useState('UTC');

  const handleDateChange = (event, selectedDate) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      const today = new Date();
      const birthDate = new Date(selectedDate);
      const calculatedAge = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        setAge(calculatedAge - 1);
      } else {
        setAge(calculatedAge);
      }
    }
  };

  const handleNext = () => {
    if (step === 1) {
      if (!age) {
        Alert.alert('Required', 'Please select your age');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      // Gender is optional, can skip
      setStep(3);
    } else if (step === 3) {
      handleComplete();
    }
  };

  const handleSkip = () => {
    if (step === 1) {
      Alert.alert('Required', 'Age is required to continue');
      return;
    }
    if (step === 2) {
      setStep(3);
    } else if (step === 3) {
      handleComplete();
    }
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      const response = await axios.post(
        `${BASE_URL}/user/onboarding/complete`,
        {
          age: age || null,
          gender: gender || null,
          timezone: timezone,
        },
        {
          headers: {
            'Authorization': `Bearer ${userToken}`,
          },
        }
      );

      if (response.data.success) {
        // Update stored user data
        await AsyncStorage.setItem('userData', JSON.stringify(response.data.user));
        if (onComplete) {
          onComplete(response.data.user);
        }
      }
    } catch (error) {
      console.error('Onboarding error:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to complete onboarding');
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>What's your age?</Text>
      <Text style={styles.stepSubtitle}>This helps us personalize your experience</Text>

      <TouchableOpacity
        style={styles.dateButton}
        onPress={() => setShowDatePicker(true)}
      >
        <Text style={styles.dateButtonText}>
          {age ? `${age} years old` : 'Select your birth date'}
        </Text>
      </TouchableOpacity>

      {showDatePicker && (
        <DateTimePicker
          value={new Date(2000, 0, 1)}
          mode="date"
          display="default"
          maximumDate={new Date()}
          onChange={handleDateChange}
        />
      )}
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>What's your gender?</Text>
      <Text style={styles.stepSubtitle}>This information is optional</Text>

      <View style={styles.genderContainer}>
        <TouchableOpacity
          style={[styles.genderButton, gender === 'male' && styles.genderButtonSelected]}
          onPress={() => setGender('male')}
        >
          <Text style={[styles.genderButtonText, gender === 'male' && styles.genderButtonTextSelected]}>
            Male
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.genderButton, gender === 'female' && styles.genderButtonSelected]}
          onPress={() => setGender('female')}
        >
          <Text style={[styles.genderButtonText, gender === 'female' && styles.genderButtonTextSelected]}>
            Female
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.genderButton, gender === 'other' && styles.genderButtonSelected]}
          onPress={() => setGender('other')}
        >
          <Text style={[styles.genderButtonText, gender === 'other' && styles.genderButtonTextSelected]}>
            Other
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.genderButton, gender === 'prefer_not_to_say' && styles.genderButtonSelected]}
          onPress={() => setGender('prefer_not_to_say')}
        >
          <Text style={[styles.genderButtonText, gender === 'prefer_not_to_say' && styles.genderButtonTextSelected]}>
            Prefer not to say
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Select your timezone</Text>
      <Text style={styles.stepSubtitle}>This ensures reminders are sent at the right time</Text>

      <ScrollView 
        style={styles.timezoneScrollView}
        showsVerticalScrollIndicator={true}
        nestedScrollEnabled={true}
      >
        <View style={styles.timezoneContainer}>
          {TIMEZONES.map((tz) => (
            <TouchableOpacity
              key={tz.value}
              style={[styles.timezoneButton, timezone === tz.value && styles.timezoneButtonSelected]}
              onPress={() => setTimezone(tz.value)}
            >
              <Text style={[styles.timezoneButtonText, timezone === tz.value && styles.timezoneButtonTextSelected]}>
                {tz.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${(step / 3) * 100}%` }]} />
            </View>
            <Text style={styles.progressText}>Step {step} of 3</Text>
          </View>

          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}

          <View style={styles.buttonContainer}>
            {step > 1 && (
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => setStep(step - 1)}
                disabled={loading}
              >
                <Text style={styles.backButtonText}>Back</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.nextButton, loading && styles.nextButtonDisabled]}
              onPress={handleNext}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.nextButtonText}>
                  {step === 3 ? 'Complete' : 'Next'}
                </Text>
              )}
            </TouchableOpacity>

            {step !== 1 && (
              <TouchableOpacity
                style={styles.skipButton}
                onPress={handleSkip}
                disabled={loading}
              >
                <Text style={styles.skipButtonText}>Skip</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  progressContainer: {
    marginTop: 20,
    marginBottom: 40,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    marginBottom: 10,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4285F4',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  stepContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 20,
  },
  stepTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  stepSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 40,
  },
  dateButton: {
    width: '100%',
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginBottom: 20,
  },
  dateButtonText: {
    fontSize: 16,
    color: '#333',
  },
  genderContainer: {
    width: '100%',
    gap: 15,
  },
  genderButton: {
    width: '100%',
    padding: 18,
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  genderButtonSelected: {
    borderColor: '#4285F4',
    backgroundColor: '#E3F2FD',
  },
  genderButtonText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  genderButtonTextSelected: {
    color: '#4285F4',
    fontWeight: '600',
  },
  timezoneScrollView: {
    maxHeight: 400,
    width: '100%',
  },
  timezoneContainer: {
    width: '100%',
    gap: 10,
  },
  timezoneButton: {
    width: '100%',
    padding: 18,
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  timezoneButtonSelected: {
    borderColor: '#4285F4',
    backgroundColor: '#E3F2FD',
  },
  timezoneButtonText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  timezoneButtonTextSelected: {
    color: '#4285F4',
    fontWeight: '600',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 30,
    gap: 10,
  },
  backButton: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  backButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  nextButton: {
    flex: 2,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#4285F4',
    minHeight: 50,
  },
  nextButtonDisabled: {
    opacity: 0.6,
  },
  nextButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  skipButton: {
    padding: 15,
    alignItems: 'center',
  },
  skipButtonText: {
    fontSize: 16,
    color: '#4285F4',
    fontWeight: '600',
  },
});

export default OnboardingScreen;


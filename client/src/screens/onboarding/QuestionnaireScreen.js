import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import firebaseService from '../../services/firebaseService';
import databaseService from '../../services/databaseService';

const QuestionnaireScreen = ({ navigation }) => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [selectedOptions, setSelectedOptions] = useState([]);

  const questions = [
    {
      id: 'medication_count',
      category: 'Medication Profile',
      question: 'How many medications do you take regularly?',
      type: 'single',
      options: ['1-2', '3-5', '6-10', '10+'],
    },
    {
      id: 'medication_frequency',
      category: 'Medication Profile',
      question: 'How often do you take medications?',
      type: 'single',
      options: ['Daily', 'Multiple times per day', 'Weekly', 'As needed'],
    },
    {
      id: 'medication_types',
      category: 'Medication Profile',
      question: 'What types of medications?',
      type: 'multi',
      options: ['Pills/tablets', 'Injections', 'Liquid', 'Topical', 'Other'],
    },
    {
      id: 'remembering_doses',
      category: 'Medication Profile',
      question: 'Do you have trouble remembering doses?',
      type: 'single',
      options: ['Never', 'Sometimes', 'Often', 'Always'],
    },
    {
      id: 'wake_time',
      category: 'Lifestyle & Preferences',
      question: 'When do you typically wake up?',
      type: 'single',
      options: ['Early (before 7am)', 'Morning (7-9am)', 'Later (after 9am)'],
    },
    {
      id: 'medication_with_food',
      category: 'Lifestyle & Preferences',
      question: 'Do you take medications with food?',
      type: 'single',
      options: ['Always', 'Sometimes', 'Never', 'Depends on medication'],
    },
    {
      id: 'travel_frequency',
      category: 'Lifestyle & Preferences',
      question: 'Do you travel frequently?',
      type: 'single',
      options: ['Yes', 'No', 'Occasionally'],
    },
    {
      id: 'has_caregiver',
      category: 'Support & Sharing',
      question: 'Do you have a caregiver who helps with medications?',
      type: 'single',
      options: ['Yes', 'No', 'Sometimes'],
    },
    {
      id: 'share_schedule',
      category: 'Support & Sharing',
      question: 'Would you like to share your schedule with family/caregivers?',
      type: 'single',
      options: ['Yes', 'No', 'Maybe later'],
    },
    {
      id: 'goals',
      category: 'Goals & Motivation',
      question: "What's most important to you?",
      type: 'multi',
      options: [
        'Never miss a dose',
        'Track adherence',
        'Manage refills',
        'Share with doctor',
        'Track symptoms',
        'Other',
      ],
    },
  ];

  const currentQ = questions[currentQuestion];
  const totalQuestions = questions.length;
  const progress = ((currentQuestion + 1) / totalQuestions) * 100;

  useEffect(() => {
    // Load saved answers if user returns
    loadSavedAnswers();
    // Track screen view and questionnaire start
    firebaseService.trackScreenView('onboarding_questionnaire');
    firebaseService.onboardingQuestionnaireStarted();
  }, []);

  const loadSavedAnswers = async () => {
    try {
      const saved = await AsyncStorage.getItem('onboarding_questionnaire');
      if (saved) {
        setAnswers(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Error loading saved answers:', error);
    }
  };

  const saveAnswers = async (newAnswers) => {
    try {
      // Save to AsyncStorage (for backward compatibility)
      await AsyncStorage.setItem('onboarding_questionnaire', JSON.stringify(newAnswers));
      
      // Also save to database for analytics
      try {
        await databaseService.ensureInitialized();
        const userId = 'guest'; // Guest mode during onboarding
        await databaseService.saveQuestionnaireAnswers(userId, newAnswers);
      } catch (dbError) {
        console.warn('Error saving questionnaire to database:', dbError);
        // Don't block if database save fails
      }
    } catch (error) {
      console.error('Error saving answers:', error);
    }
  };

  const handleOptionSelect = (option) => {
    if (currentQ.type === 'single') {
      const newAnswers = { ...answers, [currentQ.id]: option };
      setAnswers(newAnswers);
      saveAnswers(newAnswers);
      setSelectedOptions([option]);
    } else {
      // Multi-select
      let newSelected = [...selectedOptions];
      if (newSelected.includes(option)) {
        newSelected = newSelected.filter((o) => o !== option);
      } else {
        newSelected.push(option);
      }
      setSelectedOptions(newSelected);
      const newAnswers = { ...answers, [currentQ.id]: newSelected };
      setAnswers(newAnswers);
      saveAnswers(newAnswers);
    }
  };

  const handleNext = () => {
    if (currentQ.type === 'multi' && selectedOptions.length === 0) {
      // Allow skipping multi-select questions
      const newAnswers = { ...answers, [currentQ.id]: [] };
      setAnswers(newAnswers);
      saveAnswers(newAnswers);
    }

    if (currentQuestion < totalQuestions - 1) {
      setCurrentQuestion(currentQuestion + 1);
      // Reset selected options for next question
      const nextQ = questions[currentQuestion + 1];
      if (nextQ.type === 'multi') {
        setSelectedOptions(answers[nextQ.id] || []);
      } else {
        setSelectedOptions(answers[nextQ.id] ? [answers[nextQ.id]] : []);
      }
    } else {
      // Finished questionnaire
      firebaseService.onboardingQuestionnaireCompleted(Object.keys(answers).length);
      navigation.navigate('AddFirstMedication');
    }
  };

  const handleBack = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
      const prevQ = questions[currentQuestion - 1];
      if (prevQ.type === 'multi') {
        setSelectedOptions(answers[prevQ.id] || []);
      } else {
        setSelectedOptions(answers[prevQ.id] ? [answers[prevQ.id]] : []);
      }
    } else {
      navigation.goBack();
    }
  };

  // Initialize selected options for current question
  useEffect(() => {
    if (currentQ.type === 'multi') {
      setSelectedOptions(answers[currentQ.id] || []);
    } else {
      setSelectedOptions(answers[currentQ.id] ? [answers[currentQ.id]] : []);
    }
  }, [currentQuestion]);

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top', 'bottom']}>
      {/* Header */}
      <View className="flex-row items-start justify-between px-5 pt-4 pb-4 border-b border-gray-200">
        <TouchableOpacity onPress={handleBack} className="w-10 h-10 justify-center items-center">
          <MaterialIcons name="arrow-back" size={24} style={{ color: '#90CDF4' }} />
        </TouchableOpacity>
        <View className="flex-1 mx-4">
          <View className="h-1 bg-gray-200 rounded-full overflow-hidden mb-1">
            <View 
              className="h-full rounded-full"
              style={{ 
                width: `${progress}%`,
                backgroundColor: '#90CDF4'
              }}
            />
          </View>
          <Text className="text-xs text-gray-600 text-center">
            {currentQuestion + 1} of {totalQuestions}
          </Text>
        </View>
        <View className="w-10" />
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="p-6">
          <Text className="text-sm font-semibold mb-2 uppercase" style={{ color: '#90CDF4' }}>
            {currentQ.category}
          </Text>
          <Text className="text-2xl font-bold text-gray-900 mb-8 leading-8">
            {currentQ.question}
          </Text>

          <View className="gap-3">
            {currentQ.options.map((option, index) => {
              const isSelected = selectedOptions.includes(option);
              return (
                <TouchableOpacity
                  key={index}
                  className={`flex-row items-center justify-between p-4 rounded-xl border-2 ${
                    isSelected ? 'bg-gray-50' : 'bg-white'
                  }`}
                  style={{
                    borderColor: isSelected ? '#90CDF4' : '#e5e7eb',
                    backgroundColor: isSelected ? '#F0F9FF' : '#ffffff',
                  }}
                  onPress={() => handleOptionSelect(option)}
                  activeOpacity={0.7}
                >
                  <Text
                    className={`text-base flex-1 ${
                      isSelected ? 'font-semibold' : 'font-normal'
                    }`}
                    style={{ color: isSelected ? '#90CDF4' : '#374151' }}
                  >
                    {option}
                  </Text>
                  {isSelected && (
                    <MaterialIcons name="check-circle" size={24} style={{ color: '#90CDF4' }} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* Footer */}
      <View className="p-5 border-t border-gray-200">
        <TouchableOpacity
          className={`py-4 rounded-xl items-center ${
            currentQ.type === 'single' && !answers[currentQ.id] ? 'bg-gray-300' : ''
          }`}
          style={{
            backgroundColor: currentQ.type === 'single' && !answers[currentQ.id] ? '#d1d5db' : '#90CDF4',
          }}
          onPress={handleNext}
          disabled={currentQ.type === 'single' && !answers[currentQ.id]}
          activeOpacity={0.8}
        >
          <Text className="text-white text-lg font-semibold">
            {currentQuestion === totalQuestions - 1 ? 'Continue' : 'Next'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default QuestionnaireScreen;

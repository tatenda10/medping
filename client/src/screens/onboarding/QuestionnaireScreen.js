import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
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
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="#4285F4" />
        </TouchableOpacity>
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
          <Text style={styles.progressText}>
            {currentQuestion + 1} of {totalQuestions}
          </Text>
        </View>
        <View style={styles.skipButtonPlaceholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.questionContainer}>
          <Text style={styles.category}>{currentQ.category}</Text>
          <Text style={styles.question}>{currentQ.question}</Text>

          <View style={styles.optionsContainer}>
            {currentQ.options.map((option, index) => {
              const isSelected = selectedOptions.includes(option);
              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.optionButton,
                    isSelected && styles.optionButtonSelected,
                  ]}
                  onPress={() => handleOptionSelect(option)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.optionText,
                      isSelected && styles.optionTextSelected,
                    ]}
                  >
                    {option}
                  </Text>
                  {isSelected && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.nextButton,
            currentQ.type === 'single' && !answers[currentQ.id] && styles.nextButtonDisabled,
          ]}
          onPress={handleNext}
          disabled={currentQ.type === 'single' && !answers[currentQ.id]}
          activeOpacity={0.8}
        >
          <Text style={styles.nextButtonText}>
            {currentQuestion === totalQuestions - 1 ? 'Continue' : 'Next'}
          </Text>
        </TouchableOpacity>
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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 0, // Align icon center with progress bar center (progress bar is 4px, icon is 24px)
  },
  progressContainer: {
    flex: 1,
    marginHorizontal: 16,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4285F4',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  skipButtonPlaceholder: {
    width: 40, // Same width as back button to maintain balance
  },
  content: {
    flex: 1,
  },
  questionContainer: {
    padding: 24,
  },
  category: {
    fontSize: 14,
    color: '#4285F4',
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  question: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 32,
    lineHeight: 32,
  },
  optionsContainer: {
    gap: 12,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    backgroundColor: '#f9f9f9',
  },
  optionButtonSelected: {
    borderColor: '#4285F4',
    backgroundColor: '#E3F2FD',
  },
  optionText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  optionTextSelected: {
    color: '#4285F4',
    fontWeight: '600',
  },
  checkmark: {
    fontSize: 20,
    color: '#4285F4',
    marginLeft: 8,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  nextButton: {
    backgroundColor: '#4285F4',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  nextButtonDisabled: {
    backgroundColor: '#ccc',
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});

export default QuestionnaireScreen;


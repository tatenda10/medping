import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import WelcomeScreen from '../screens/onboarding/WelcomeScreen';
import QuestionnaireScreen from '../screens/onboarding/QuestionnaireScreen';
import AddFirstMedicationScreen from '../screens/onboarding/AddFirstMedicationScreen';
import SignUpScreen from '../screens/SignUpScreen';
import LoginScreen from '../screens/LoginScreen';

const Stack = createNativeStackNavigator();

const OnboardingNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Questionnaire" component={QuestionnaireScreen} />
      <Stack.Screen name="AddFirstMedication" component={AddFirstMedicationScreen} />
      <Stack.Screen name="CreateAccount" component={SignUpScreen} />
      <Stack.Screen name="SignIn" component={LoginScreen} />
    </Stack.Navigator>
  );
};

export default OnboardingNavigator;


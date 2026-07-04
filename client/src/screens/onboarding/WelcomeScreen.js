import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import firebaseService from '../../services/firebaseService';

const WelcomeScreen = ({ navigation }) => {
  useEffect(() => {
    // Track screen view
    firebaseService.trackScreenView('onboarding_welcome');
    firebaseService.onboardingWelcomeViewed();
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top', 'bottom']}>
      <View className="flex-1 px-6 pt-10 pb-6 justify-between items-center">
        {/* Logo/Icon */}
        <View className="flex-1 justify-center items-center pb-10">
          <Image 
            source={require('../../../assets/logo.png')} 
            className="w-32 h-32 mb-6"
            resizeMode="contain"
          />
          <Text className="text-base text-gray-600 text-center px-5 leading-6">
            Track your medications, get reminders, and stay on top of your health
          </Text>
        </View>

        {/* Buttons */}
        <View className="w-full gap-4 items-center pb-5">
          <TouchableOpacity
            className="bg-light-blue w-full py-4 rounded-2xl items-center"
            style={{ backgroundColor: '#90CDF4' }}
            onPress={() => {
              firebaseService.onboardingStarted();
              navigation.navigate('Questionnaire');
            }}
            activeOpacity={0.8}
          >
            <Text className="text-white text-base font-semibold">Get Started</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="py-4 items-center w-full rounded-2xl border-2"
            style={{ borderColor: '#90CDF4' }}
            onPress={() => {
              const parentNav = navigation.getParent();
              if (parentNav?.navigate) {
                parentNav.navigate('Login');
              } else {
                navigation.navigate('SignIn');
              }
            }}
            activeOpacity={0.8}
          >
            <Text className="text-base font-semibold" style={{ color: '#90CDF4' }}>Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default WelcomeScreen;

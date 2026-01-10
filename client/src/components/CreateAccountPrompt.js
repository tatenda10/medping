import React from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CreateAccountPrompt = ({ visible, onClose, message = "Create an account to access this feature and sync your data across devices." }) => {
  const navigation = useNavigation();

  const handleCreateAccount = () => {
    onClose();
    navigation.navigate('SignUp');
  };

  const handleCancel = () => {
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
        <SafeAreaView className="bg-white rounded-t-[20px]">
          {/* Header - styled like AddFirstMedicationScreen */}
          <View className="bg-primary rounded-t-[20px] px-6 py-6 flex-row justify-between items-center">
            <Text className="text-lg font-bold text-white flex-1">Create Account</Text>
            <TouchableOpacity onPress={handleCancel} className="px-4 py-2">
              <Text className="text-base text-white font-semibold">✕</Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          <View className="p-6">
            <Text className="text-base text-gray-800 mb-6 leading-6">
              {message}
            </Text>

            <Text className="text-sm text-gray-600 mb-6">
              Benefits of creating an account:
            </Text>

            <View className="mb-6">
              {[
                'Sync your medications across all devices',
                'Backup your data securely in the cloud',
                'Access caregiver features',
                'Get notifications and reminders',
              ].map((benefit, index) => (
                <View key={index} className="flex-row items-start mb-3">
                  <Text className="text-primary mr-2 text-lg">✓</Text>
                  <Text className="text-sm text-gray-700 flex-1">{benefit}</Text>
                </View>
              ))}
            </View>

            {/* Buttons */}
            <View className="gap-3">
              <TouchableOpacity
                className="bg-primary py-4 rounded-xl items-center"
                onPress={handleCreateAccount}
                activeOpacity={0.8}
              >
                <Text className="text-white text-lg font-semibold">
                  Create Account
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="border-2 border-primary py-4 rounded-xl items-center bg-white"
                onPress={handleCancel}
                activeOpacity={0.8}
              >
                <Text className="text-primary text-lg font-semibold">
                  Maybe Later
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

export default CreateAccountPrompt;


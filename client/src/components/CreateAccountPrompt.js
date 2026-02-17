import React from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';

const CreateAccountPrompt = ({ visible, onClose, message = "Create an account to access this feature and sync your data across devices." }) => {
  const navigation = useNavigation();

  const handleCreateAccount = () => {
    onClose();
    navigation.navigate('SignUp');
  };

  const handleLogin = () => {
    onClose();
    navigation.navigate('Login');
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
        <SafeAreaView className="bg-white rounded-t-[20px]">
          {/* Header */}
          <View className="px-6 py-6 flex-row justify-between items-center border-b border-gray-200">
            <Text className="text-lg font-bold text-gray-900 flex-1">Create Account</Text>
            <TouchableOpacity onPress={onClose} className="w-10 h-10 justify-center items-center">
              <MaterialIcons name="close" size={24} style={{ color: '#666' }} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <View className="p-6">
            <Text className="text-base text-gray-800 mb-6 leading-6">
              {message}
            </Text>

            <Text className="text-sm font-semibold text-gray-700 mb-4">
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
                  <MaterialIcons name="check-circle" size={20} style={{ color: '#90CDF4', marginRight: 8, marginTop: 2 }} />
                  <Text className="text-sm text-gray-700 flex-1">{benefit}</Text>
                </View>
              ))}
            </View>

            {/* Buttons */}
            <View className="gap-3">
              <TouchableOpacity
                className="py-4 rounded-xl items-center"
                style={{ backgroundColor: '#90CDF4' }}
                onPress={handleCreateAccount}
                activeOpacity={0.8}
              >
                <Text className="text-white text-lg font-semibold">
                  Create Account
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="border-2 py-4 rounded-xl items-center bg-white"
                style={{ borderColor: '#90CDF4' }}
                onPress={handleLogin}
                activeOpacity={0.8}
              >
                <Text className="text-lg font-semibold" style={{ color: '#90CDF4' }}>
                  Login
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

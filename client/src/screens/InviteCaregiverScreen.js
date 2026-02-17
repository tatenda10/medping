import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import BASE_URL from '../context/Api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sharing from 'expo-sharing';

const InviteCaregiverScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleInvite = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter an email address');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      
      const response = await axios.post(
        `${BASE_URL}/caregivers/invite`,
        { email: email.trim().toLowerCase() },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (response.data.success) {
        Alert.alert(
          'Success',
          `Invitation sent to ${email.trim()}`,
          [
            {
              text: 'OK',
              onPress: () => {
                setEmail('');
                navigation.goBack();
              },
            },
          ]
        );
      }
    } catch (error) {
      console.error('Error sending invitation:', error);
      Alert.alert(
        'Error',
        error.response?.data?.message || 'Failed to send invitation'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleShareLink = async () => {
    try {
      const shareText = `Join me on MediPing to view my medication schedule! Download the app and sign up with your email.`;
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync({
          message: shareText,
        });
      } else {
        Alert.alert('Share', shareText);
      }
    } catch (error) {
      console.error('Error sharing link:', error);
      Alert.alert('Error', 'Failed to share link');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="flex-row items-center px-5 pt-4 pb-3">
          <TouchableOpacity 
            className="w-10 h-10 rounded-full bg-gray-100 justify-center items-center mr-3"
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text className="text-2xl font-bold text-gray-900 flex-1">Invite Caregiver</Text>
        </View>

        {/* Invite by Email Section */}
        <View className="px-5 mb-6">
          <Text className="text-lg font-bold text-gray-900 mb-2">Invite by Email</Text>
          <Text className="text-sm text-gray-600 mb-5">
            Enter the email address of the person you want to share your medication schedule with.
          </Text>

          <View className="mb-5">
            <TextInput
              className="bg-gray-50 rounded-xl p-4 text-base"
              placeholder="Enter email address"
              placeholderTextColor="#999"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />
          </View>

          <TouchableOpacity
            className="rounded-xl p-4 items-center justify-center"
            style={{ backgroundColor: loading ? '#B0BEC5' : '#90CDF4' }}
            onPress={handleInvite}
            disabled={loading}
            activeOpacity={0.7}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-base font-bold text-white">Send Invitation</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Divider */}
        <View className="h-px bg-gray-200 mx-5 my-6" />

        {/* Share Link Section */}
        <View className="px-5 mb-8">
          <Text className="text-lg font-bold text-gray-900 mb-2">Share Link</Text>
          <Text className="text-sm text-gray-600 mb-5">
            Share a link that allows others to join and view your schedule.
          </Text>

          <TouchableOpacity
            className="bg-white rounded-xl p-4 items-center justify-center border-2"
            style={{ borderColor: '#90CDF4' }}
            onPress={handleShareLink}
            activeOpacity={0.7}
          >
            <Text className="text-base font-bold" style={{ color: '#90CDF4' }}>Share Link</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default InviteCaregiverScreen;

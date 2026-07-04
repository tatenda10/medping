import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, ScrollView, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TIMEZONES from '../utils/timezones';
import { useAuthCheck } from '../hooks/useAuthCheck';
import CreateAccountPrompt from '../components/CreateAccountPrompt';
import syncService from '../services/syncService';
import { clerkAxios } from '../utils/clerkAxios';

const ProfileScreen = ({ navigation, userToken, onLogout }) => {
  const { isAuthenticated } = useAuthCheck();
  const [showCreateAccountPrompt, setShowCreateAccountPrompt] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState('');
  const [age, setAge] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [gender, setGender] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [email, setEmail] = useState('');

  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    setLoading(true);
    try {
      const userData = await AsyncStorage.getItem('userData');
      const user = userData ? JSON.parse(userData) : null;
      
      if (user) {
        setName(user.name || '');
        setEmail(user.email || '');
        setTimezone(user.timezone || 'UTC');
        setAge(user.profile?.age || null);
        setGender(user.profile?.gender || '');
        setLoading(false);
      } else {
        setLoading(false);
      }

      const online = await syncService.isOnline();
      if (online && isAuthenticated) {
        try {
          const response = await clerkAxios.get('/user/me');

          if (response.data.success) {
            const serverUser = response.data.user;
            await AsyncStorage.setItem('userData', JSON.stringify(serverUser));
            setName(serverUser.name || '');
            setEmail(serverUser.email || '');
            setTimezone(serverUser.timezone || 'UTC');
            setAge(serverUser.profile?.age || null);
            setGender(serverUser.profile?.gender || '');
          }
        } catch (error) {
          if (error.response?.status !== 401) {
            console.log('Using local data - offline or server error:', error.message);
          }
        }
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      setLoading(false);
    }
  };

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

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await clerkAxios.put('/user/profile', {
        name,
        age: age || null,
        gender: gender || null,
        timezone,
      });

      if (response.data.success) {
        await AsyncStorage.setItem('userData', JSON.stringify(response.data.user));
        setIsEditing(false);
        Alert.alert('Success', 'Profile updated successfully');
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    loadUserProfile();
    setIsEditing(false);
  };

  if (!isAuthenticated) {
    return (
      <SafeAreaView className="flex-1 bg-white" edges={['top']}>
        <View className="flex-1 justify-center items-center px-5">
          <Text className="text-lg text-gray-600 text-center mb-4">
            Create an account to view and edit your profile.
          </Text>
        </View>
        <CreateAccountPrompt
          visible={showCreateAccountPrompt}
          onClose={() => {
            setShowCreateAccountPrompt(false);
            navigation.goBack();
          }}
          message="Create an account to view and edit your profile."
        />
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white" edges={['top']}>
        <View className="flex-row items-center px-5 pt-4 pb-3">
          <TouchableOpacity 
            className="w-10 h-10 rounded-full bg-gray-100 justify-center items-center mr-3"
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text className="text-2xl font-bold text-gray-900 flex-1">Profile</Text>
        </View>
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#90CDF4" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 16 }}
        >
          {/* Header */}
          <View className="flex-row items-center px-5 pt-4 pb-3">
            <TouchableOpacity 
              className="w-10 h-10 rounded-full bg-gray-100 justify-center items-center mr-3"
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="chevron-back" size={24} color="#333" />
            </TouchableOpacity>
            <Text className="text-2xl font-bold text-gray-900 flex-1">Profile</Text>
            {!isEditing && (
              <TouchableOpacity
                className="px-4 py-2 rounded-lg"
                style={{ backgroundColor: '#90CDF4' }}
                onPress={() => setIsEditing(true)}
                activeOpacity={0.7}
              >
                <Text className="text-base font-semibold text-white">Edit</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Form */}
          <View className="px-5 pb-8">
            {/* Name */}
            <View className="mb-6">
              <Text className="text-sm font-semibold text-gray-600 mb-2">Name</Text>
              {isEditing ? (
                <TextInput
                  className="bg-gray-50 rounded-xl p-4 text-base"
                  placeholder="Enter your name"
                  placeholderTextColor="#999"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
              ) : (
                <View className="bg-gray-50 rounded-xl p-4">
                  <Text className="text-base text-gray-900">{name || 'Not set'}</Text>
                </View>
              )}
            </View>

            {/* Email */}
            <View className="mb-6">
              <Text className="text-sm font-semibold text-gray-600 mb-2">Email</Text>
              <View className="bg-gray-50 rounded-xl p-4">
                <Text className="text-base text-gray-900">{email || 'Not set'}</Text>
              </View>
              <Text className="text-xs text-gray-500 mt-2">Email cannot be changed</Text>
            </View>

            {/* Age */}
            <View className="mb-6">
              <Text className="text-sm font-semibold text-gray-600 mb-2">Age</Text>
              {isEditing ? (
                <>
                  <TouchableOpacity
                    className="bg-gray-50 rounded-xl p-4"
                    onPress={() => setShowDatePicker(true)}
                    activeOpacity={0.7}
                  >
                    <Text className="text-base text-gray-900">
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
                </>
              ) : (
                <View className="bg-gray-50 rounded-xl p-4">
                  <Text className="text-base text-gray-900">{age ? `${age} years old` : 'Not set'}</Text>
                </View>
              )}
            </View>

            {/* Gender */}
            <View className="mb-6">
              <Text className="text-sm font-semibold text-gray-600 mb-2">Gender</Text>
              {isEditing ? (
                <View className="flex-row flex-wrap gap-3">
                  {['male', 'female', 'other', 'prefer_not_to_say'].map((g) => (
                    <TouchableOpacity
                      key={g}
                      className={`flex-1 min-w-[45%] rounded-xl p-4 items-center border-2 ${
                        gender === g ? '' : ''
                      }`}
                      style={{
                        borderColor: gender === g ? '#90CDF4' : '#E0E0E0',
                        backgroundColor: gender === g ? '#E0F2FE' : 'white',
                      }}
                      onPress={() => setGender(g)}
                      activeOpacity={0.7}
                    >
                      <Text
                        className="text-sm font-medium"
                        style={{
                          color: gender === g ? '#90CDF4' : '#333',
                          fontWeight: gender === g ? '600' : '500',
                        }}
                      >
                        {g.charAt(0).toUpperCase() + g.slice(1).replace('_', ' ')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <View className="bg-gray-50 rounded-xl p-4">
                  <Text className="text-base text-gray-900">
                    {gender ? gender.charAt(0).toUpperCase() + gender.slice(1).replace('_', ' ') : 'Not set'}
                  </Text>
                </View>
              )}
            </View>

            {/* Timezone */}
            <View className="mb-6">
              <Text className="text-sm font-semibold text-gray-600 mb-2">Timezone</Text>
              {isEditing ? (
                <ScrollView 
                  className="max-h-72"
                  showsVerticalScrollIndicator={true}
                  nestedScrollEnabled={true}
                >
                  <View className="gap-3">
                    {TIMEZONES.map((tz) => (
                      <TouchableOpacity
                        key={tz.value}
                        className={`rounded-xl p-4 items-center border-2 ${
                          timezone === tz.value ? '' : ''
                        }`}
                        style={{
                          borderColor: timezone === tz.value ? '#90CDF4' : '#E0E0E0',
                          backgroundColor: timezone === tz.value ? '#E0F2FE' : 'white',
                        }}
                        onPress={() => setTimezone(tz.value)}
                        activeOpacity={0.7}
                      >
                        <Text
                          className="text-sm font-medium"
                          style={{
                            color: timezone === tz.value ? '#90CDF4' : '#333',
                            fontWeight: timezone === tz.value ? '600' : '500',
                          }}
                        >
                          {tz.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              ) : (
                <View className="bg-gray-50 rounded-xl p-4">
                  <Text className="text-base text-gray-900">
                    {TIMEZONES.find(tz => tz.value === timezone)?.label || timezone || 'Not set'}
                  </Text>
                </View>
              )}
            </View>

            {/* Save/Cancel Buttons */}
            {isEditing && (
              <View className="flex-row gap-3 mt-4">
                <TouchableOpacity
                  className="flex-1 rounded-xl p-4 items-center justify-center bg-white border-2"
                  style={{ borderColor: '#E0E0E0' }}
                  onPress={handleCancel}
                  disabled={saving}
                  activeOpacity={0.7}
                >
                  <Text className="text-base font-semibold text-gray-900">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 rounded-xl p-4 items-center justify-center"
                  style={{ backgroundColor: saving ? '#B0BEC5' : '#90CDF4' }}
                  onPress={handleSave}
                  disabled={saving}
                  activeOpacity={0.7}
                >
                  {saving ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text className="text-base font-semibold text-white">Save Changes</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <CreateAccountPrompt
        visible={showCreateAccountPrompt}
        onClose={() => {
          setShowCreateAccountPrompt(false);
          navigation.goBack();
        }}
        message="Create an account to view and edit your profile."
      />
    </SafeAreaView>
  );
};

export default ProfileScreen;

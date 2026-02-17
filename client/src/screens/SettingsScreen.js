import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import BASE_URL from '../context/Api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import databaseService from '../services/databaseService';
import exportService from '../services/exportService';
import CreateAccountPrompt from '../components/CreateAccountPrompt';
import clearAllData from '../utils/clearAllData';
import { useAuthCheck } from '../hooks/useAuthCheck';

const SettingsScreen = ({ navigation, onLogout }) => {
  const { isAuthenticated } = useAuthCheck();
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [showCreateAccountPrompt, setShowCreateAccountPrompt] = useState(false);
  const [promptMessage, setPromptMessage] = useState('');
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const stored = await AsyncStorage.getItem('userData');
      if (stored) {
        setUserData(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const requireAuth = (action, message) => {
    if (!isAuthenticated) {
      setPromptMessage(message);
      setShowCreateAccountPrompt(true);
    } else {
      action();
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone and will permanently delete all your data.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: confirmDeleteAccount,
        },
      ]
    );
  };

  const confirmDeleteAccount = async () => {
    setDeleting(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      
      if (!token) {
        Alert.alert('Error', 'Authentication token not found');
        setDeleting(false);
        return;
      }

      const response = await axios.delete(`${BASE_URL}/user/account`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.data.success) {
        const userData = await AsyncStorage.getItem('userData');
        const user = userData ? JSON.parse(userData) : null;
        const userId = user?.id || user?.user?.id;

        try {
          await databaseService.ensureInitialized();
          
          if (userId && databaseService.db) {
            await databaseService.db.runAsync('DELETE FROM medications WHERE user_id = ?', [userId]);
            await databaseService.db.runAsync('DELETE FROM dose_logs WHERE user_id = ?', [userId]);
            await databaseService.db.runAsync('DELETE FROM refills WHERE user_id = ?', [userId]);
            await databaseService.db.runAsync('DELETE FROM vitals_logs WHERE user_id = ?', [userId]);
            await databaseService.db.runAsync('DELETE FROM health_logs WHERE user_id = ?', [userId]);
            await databaseService.db.runAsync('DELETE FROM appointments WHERE user_id = ?', [userId]);
            await databaseService.db.runAsync('DELETE FROM questionnaire_answers WHERE user_id = ?', [userId]);
            await databaseService.db.runAsync('DELETE FROM sync_queue');
          }
        } catch (dbError) {
          console.warn('Could not clear local database:', dbError);
        }

        try {
          await AsyncStorage.multiRemove(['authToken', 'userData']);
        } catch (storageError) {
          console.warn('Could not clear AsyncStorage:', storageError);
        }

        Alert.alert(
          'Account Deleted',
          'Your account and all associated data have been permanently deleted.',
          [
            {
              text: 'OK',
              onPress: () => {
                if (onLogout) {
                  onLogout();
                } else {
                  navigation.reset({
                    index: 0,
                    routes: [{ name: 'Login' }],
                  });
                }
              },
            },
          ]
        );
      } else {
        throw new Error(response.data.message || 'Failed to delete account');
      }
    } catch (error) {
      console.error('Error deleting account:', error);
      Alert.alert(
        'Error',
        error.response?.data?.message || error.message || 'Failed to delete account. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setDeleting(false);
    }
  };

  const handleExportData = async () => {
    setExporting(true);
    try {
      await exportService.exportAllData();
      Alert.alert(
        'Export Complete',
        'Your data has been exported successfully.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error exporting data:', error);
      Alert.alert(
        'Export Failed',
        error.message || 'Failed to export data. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setExporting(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: () => {
            if (onLogout) {
              onLogout();
            }
          },
        },
      ]
    );
  };

  const getAppVersion = () => {
    // Version info - can be updated from app.json
    return 'VERSION 2.4.1 (BUILD 108)';
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top', 'bottom']}>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="flex-row items-center px-5 pt-4 pb-3">
          <TouchableOpacity 
            className="w-10 h-10 rounded-full bg-gray-100 justify-center items-center mr-3"
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text className="text-2xl font-bold text-gray-900 flex-1">Settings</Text>
        </View>

        {/* User Profile Card */}
        {userData && (
          <TouchableOpacity
            className="mx-5 mb-6 bg-white rounded-xl p-4 flex-row items-center"
            onPress={() => requireAuth(
              () => navigation.navigate('Profile'),
              'Create an account to view your profile.'
            )}
            activeOpacity={0.7}
          >
            <View className="w-16 h-16 rounded-full justify-center items-center mr-4" style={{ backgroundColor: '#90CDF4' }}>
              <MaterialIcons name="account-circle" size={40} color="white" />
            </View>
            <View className="flex-1">
              <Text className="text-lg font-bold text-gray-900">{userData.name || 'User'}</Text>
              <Text className="text-sm text-gray-600 mt-1">{userData.email || ''}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
        )}

        {/* ACCOUNT & SECURITY Section */}
        <View className="px-5 mb-6">
          <Text className="text-xs text-gray-600 mb-4 uppercase tracking-wide">Account & Security</Text>
          
          <TouchableOpacity
            className="bg-white rounded-xl p-4 mb-3 flex-row items-center"
            onPress={() => Alert.alert('Coming Soon', 'Notification preferences will be available soon.')}
            activeOpacity={0.7}
          >
            <View className="w-10 h-10 rounded-lg justify-center items-center mr-3" style={{ backgroundColor: '#E0F2FE' }}>
              <MaterialIcons name="notifications-none" size={20} color="#90CDF4" />
            </View>
            <Text className="text-base text-gray-900 flex-1">Notification Preferences</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity
            className="bg-white rounded-xl p-4 mb-3 flex-row items-center"
            onPress={() => Alert.alert('Coming Soon', 'Privacy & Security settings will be available soon.')}
            activeOpacity={0.7}
          >
            <View className="w-10 h-10 rounded-lg justify-center items-center mr-3" style={{ backgroundColor: '#E0F2FE' }}>
              <MaterialIcons name="lock" size={20} color="#90CDF4" />
            </View>
            <Text className="text-base text-gray-900 flex-1">Privacy & Security</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
        </View>

        {/* MEDICATION Section */}
        <View className="px-5 mb-6">
          <Text className="text-xs text-gray-600 mb-4 uppercase tracking-wide">Medication</Text>
          
          <TouchableOpacity
            className="bg-white rounded-xl p-4 mb-3 flex-row items-center"
            onPress={() => navigation.navigate('AddMedicine')}
            activeOpacity={0.7}
          >
            <View className="w-10 h-10 rounded-lg justify-center items-center mr-3" style={{ backgroundColor: '#E0F2FE' }}>
              <MaterialIcons name="medication" size={20} color="#90CDF4" />
            </View>
            <View className="flex-1">
              <Text className="text-base text-gray-900">Manage Medications</Text>
              <Text className="text-sm text-gray-600 mt-1">View and manage your medications</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
        </View>

        {/* CAREGIVER ACCESS Section */}
        <View className="px-5 mb-6">
          <Text className="text-xs text-gray-600 mb-4 uppercase tracking-wide">Caregiver Access</Text>
          
          <TouchableOpacity
            className="bg-white rounded-xl p-4 mb-3 flex-row items-center"
            onPress={() => requireAuth(
              () => navigation.navigate('InviteCaregiver'),
              'Create an account to invite caregivers and share your medication schedule.'
            )}
            activeOpacity={0.7}
          >
            <View className="w-10 h-10 rounded-lg justify-center items-center mr-3" style={{ backgroundColor: '#E0F2FE' }}>
              <MaterialIcons name="people" size={20} color="#90CDF4" />
            </View>
            <View className="flex-1">
              <Text className="text-base text-gray-900">Invite Caregiver</Text>
              <Text className="text-sm text-gray-600 mt-1">Share your schedule with others</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity
            className="bg-white rounded-xl p-4 mb-3 flex-row items-center"
            onPress={() => requireAuth(
              () => navigation.navigate('CaregiverInvitations'),
              'Create an account to manage caregiver invitations.'
            )}
            activeOpacity={0.7}
          >
            <View className="w-10 h-10 rounded-lg justify-center items-center mr-3" style={{ backgroundColor: '#E0F2FE' }}>
              <MaterialIcons name="list-alt" size={20} color="#90CDF4" />
            </View>
            <View className="flex-1">
              <Text className="text-base text-gray-900">Manage Invitations</Text>
              <Text className="text-sm text-gray-600 mt-1">View and manage invitations</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
        </View>

        {/* SUPPORT Section */}
        <View className="px-5 mb-6">
          <Text className="text-xs text-gray-600 mb-4 uppercase tracking-wide">Support</Text>
          
          <TouchableOpacity
            className="bg-white rounded-xl p-4 mb-3 flex-row items-center"
            onPress={() => Alert.alert('Help & Support', 'For support, please contact us at support@mediping.app')}
            activeOpacity={0.7}
          >
            <View className="w-10 h-10 rounded-lg justify-center items-center mr-3" style={{ backgroundColor: '#E0F2FE' }}>
              <MaterialIcons name="help-outline" size={20} color="#90CDF4" />
            </View>
            <Text className="text-base text-gray-900 flex-1">Help & Support</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity
            className="bg-white rounded-xl p-4 mb-3 flex-row items-center"
            onPress={() => Alert.alert('About MediPing', 'MediPing - Your Smart Medication Reminder & Health Tracker')}
            activeOpacity={0.7}
          >
            <View className="w-10 h-10 rounded-lg justify-center items-center mr-3" style={{ backgroundColor: '#E0F2FE' }}>
              <MaterialIcons name="info-outline" size={20} color="#90CDF4" />
            </View>
            <Text className="text-base text-gray-900 flex-1">About MediPing</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
        </View>

        {/* Delete Account Button */}
        {isAuthenticated && (
          <View className="px-5 mb-4">
            <TouchableOpacity
              className="bg-white rounded-xl p-4 flex-row items-center"
              onPress={handleDeleteAccount}
              disabled={deleting}
              activeOpacity={0.7}
            >
              <View className="w-10 h-10 rounded-lg justify-center items-center mr-3" style={{ backgroundColor: '#FFEBEE' }}>
                <MaterialIcons name="delete-forever" size={20} color="#E53935" />
              </View>
              <Text className="text-base text-red-600 flex-1 font-semibold">
                {deleting ? 'Deleting Account...' : 'Delete Account'}
              </Text>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </TouchableOpacity>
          </View>
        )}

        {/* Log Out Button */}
        {isAuthenticated && (
          <TouchableOpacity
            className="mx-5 mb-6 rounded-xl p-4 flex-row items-center justify-center"
            style={{ backgroundColor: '#FFEBEE' }}
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <MaterialIcons name="logout" size={20} color="#E53935" />
            <Text className="text-base font-bold text-red-600 ml-2">Log Out</Text>
          </TouchableOpacity>
        )}

        {/* Version */}
        <View className="px-5 pb-8 items-center">
          <Text className="text-xs text-gray-400">{getAppVersion()}</Text>
        </View>
      </ScrollView>

      <CreateAccountPrompt
        visible={showCreateAccountPrompt}
        onClose={() => setShowCreateAccountPrompt(false)}
        message={promptMessage}
      />
    </SafeAreaView>
  );
};

export default SettingsScreen;

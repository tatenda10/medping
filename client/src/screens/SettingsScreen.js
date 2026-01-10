import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import axios from 'axios';
import BASE_URL from '../context/Api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppHeader from '../components/AppHeader';
import databaseService from '../services/databaseService';
import exportService from '../services/exportService';
import CreateAccountPrompt from '../components/CreateAccountPrompt';

const SettingsScreen = ({ navigation, onLogout }) => {
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showCreateAccountPrompt, setShowCreateAccountPrompt] = useState(false);
  const [promptMessage, setPromptMessage] = useState('');

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      setIsAuthenticated(!!token);
    } catch (error) {
      console.error('Error checking auth status:', error);
      setIsAuthenticated(false);
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
      'Are you sure you want to delete your account? This action cannot be undone and will permanently delete:\n\n• All your medications\n• All your dose logs\n• All your health data\n• All caregiver relationships\n• All other associated data',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            // Second confirmation
            Alert.alert(
              'Final Confirmation',
              'This will permanently delete your account and all data. Type "DELETE" to confirm.',
              [
                {
                  text: 'Cancel',
                  style: 'cancel',
                },
                {
                  text: 'Confirm Delete',
                  style: 'destructive',
                  onPress: confirmDeleteAccount,
                },
              ]
            );
          },
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

      // Call backend to delete account
      const response = await axios.delete(`${BASE_URL}/user/account`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.data.success) {
        // Get user ID before clearing AsyncStorage
        const userData = await AsyncStorage.getItem('userData');
        const user = userData ? JSON.parse(userData) : null;
        const userId = user?.id || user?.user?.id;

        // Clear local database first (before clearing AsyncStorage)
        try {
          await databaseService.ensureInitialized();
          
          if (userId && databaseService.db) {
            // Delete all local data for this user
            await databaseService.db.runAsync('DELETE FROM medications WHERE user_id = ?', [userId]);
            await databaseService.db.runAsync('DELETE FROM dose_logs WHERE user_id = ?', [userId]);
            await databaseService.db.runAsync('DELETE FROM refills WHERE user_id = ?', [userId]);
            await databaseService.db.runAsync('DELETE FROM sync_queue');
            console.log('✅ Local database cleared');
          }
        } catch (dbError) {
          console.warn('⚠️ Could not clear local database:', dbError);
          // Continue anyway - database will be recreated
        }

        // Clear AsyncStorage
        try {
          await AsyncStorage.multiRemove([
            'authToken',
            'userData',
          ]);
          console.log('✅ AsyncStorage cleared');
        } catch (storageError) {
          console.warn('⚠️ Could not clear AsyncStorage:', storageError);
          // Continue anyway
        }

        Alert.alert(
          'Account Deleted',
          'Your account and all associated data have been permanently deleted.',
          [
            {
              text: 'OK',
              onPress: () => {
                // Navigate to login/logout
                if (onLogout) {
                  onLogout();
                } else {
                  // Fallback: navigate to login
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
        'Your data has been exported successfully. The file is ready to share.',
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

  return (
    <View style={styles.container}>
      <AppHeader navigation={navigation} />
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Settings</Text>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Caregiver Access</Text>
          <Text style={styles.sectionDescription}>
            Invite people to view your medication schedule or manage existing invitations.
          </Text>
          
          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => requireAuth(
              () => navigation.navigate('InviteCaregiver'),
              'Create an account to invite caregivers and share your medication schedule.'
            )}
          >
            <View style={styles.settingLeft}>
              <MaterialIcons name="people" size={24} color="#4285F4" style={styles.settingIconMaterial} />
              <View>
                <Text style={styles.settingTitle}>Invite Caregiver</Text>
                <Text style={styles.settingSubtitle}>Share your schedule with others</Text>
              </View>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#999" />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => requireAuth(
              () => navigation.navigate('CaregiverInvitations'),
              'Create an account to manage caregiver invitations.'
            )}
          >
            <View style={styles.settingLeft}>
              <MaterialIcons name="list-alt" size={24} color="#4285F4" style={styles.settingIconMaterial} />
              <View>
                <Text style={styles.settingTitle}>Manage Invitations</Text>
                <Text style={styles.settingSubtitle}>View and manage invitations</Text>
              </View>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#999" />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data & Export</Text>
          <Text style={styles.sectionDescription}>
            Export your medication data or manage your account.
          </Text>
          
          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => requireAuth(
              handleExportData,
              'Create an account to export your data and sync across devices.'
            )}
            disabled={exporting}
          >
            <View style={styles.settingLeft}>
              <MaterialIcons name="file-download" size={24} color="#4285F4" style={styles.settingIconMaterial} />
              <View>
                <Text style={styles.settingTitle}>
                  {exporting ? 'Exporting Data...' : 'Export Data'}
                </Text>
                <Text style={styles.settingSubtitle}>
                  Download all your data as CSV files
                </Text>
              </View>
            </View>
            {!exporting && <MaterialIcons name="chevron-right" size={24} color="#999" />}
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <Text style={styles.sectionDescription}>
            Manage your account settings and data.
          </Text>
          
          <TouchableOpacity
            style={[styles.settingItem, styles.dangerItem]}
            onPress={() => requireAuth(
              handleDeleteAccount,
              'You need an account to delete it. Create an account first.'
            )}
            disabled={deleting}
          >
            <View style={styles.settingLeft}>
              <MaterialIcons name="delete-forever" size={24} color="#E53935" style={styles.settingIconMaterial} />
              <View>
                <Text style={[styles.settingTitle, styles.dangerText]}>
                  {deleting ? 'Deleting Account...' : 'Delete Account'}
                </Text>
                <Text style={styles.settingSubtitle}>
                  Permanently delete your account and all data
                </Text>
              </View>
            </View>
            {!deleting && <MaterialIcons name="chevron-right" size={24} color="#999" />}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Create Account Prompt Modal */}
      <CreateAccountPrompt
        visible={showCreateAccountPrompt}
        onClose={() => setShowCreateAccountPrompt(false)}
        message={promptMessage}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
    color: '#333',
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    lineHeight: 20,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    fontSize: 24,
    marginRight: 15,
  },
  settingIconMaterial: {
    marginRight: 15,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  settingSubtitle: {
    fontSize: 12,
    color: '#666',
  },
  dangerItem: {
    borderColor: '#FFEBEE',
    backgroundColor: '#FFF5F5',
  },
  dangerText: {
    color: '#E53935',
  },
});

export default SettingsScreen;


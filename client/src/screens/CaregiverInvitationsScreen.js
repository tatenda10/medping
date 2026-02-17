import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import BASE_URL from '../context/Api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CaregiverInvitationsScreen = ({ navigation }) => {
  const [receivedInvitations, setReceivedInvitations] = useState([]);
  const [sentInvitations, setSentInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);

  useEffect(() => {
    loadInvitations();
  }, []);

  const loadInvitations = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        setLoading(false);
        return;
      }

      const response = await axios.get(`${BASE_URL}/caregivers/invitations`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.data.success) {
        setReceivedInvitations(response.data.receivedInvitations || []);
        setSentInvitations(response.data.sentInvitations || []);
      }
    } catch (error) {
      console.error('Error loading invitations:', error);
      if (error.response?.status !== 401) {
        Alert.alert('Error', 'Failed to load invitations');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (invitationId) => {
    setProcessing(invitationId);
    try {
      const token = await AsyncStorage.getItem('authToken');
      const response = await axios.post(
        `${BASE_URL}/caregivers/accept/${invitationId}`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (response.data.success) {
        Alert.alert('Success', 'Invitation accepted');
        loadInvitations();
      }
    } catch (error) {
      console.error('Error accepting invitation:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to accept invitation');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (invitationId) => {
    Alert.alert(
      'Reject Invitation',
      'Are you sure you want to reject this invitation?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            setProcessing(invitationId);
            try {
              const token = await AsyncStorage.getItem('authToken');
              const response = await axios.post(
                `${BASE_URL}/caregivers/reject/${invitationId}`,
                {},
                {
                  headers: {
                    'Authorization': `Bearer ${token}`,
                  },
                }
              );

              if (response.data.success) {
                Alert.alert('Success', 'Invitation rejected');
                loadInvitations();
              }
            } catch (error) {
              console.error('Error rejecting invitation:', error);
              Alert.alert('Error', error.response?.data?.message || 'Failed to reject invitation');
            } finally {
              setProcessing(null);
            }
          },
        },
      ]
    );
  };

  const handleRemove = async (relationshipId) => {
    Alert.alert(
      'Remove Access',
      'Are you sure you want to remove this person\'s access to your schedule?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setProcessing(relationshipId);
            try {
              const token = await AsyncStorage.getItem('authToken');
              const response = await axios.delete(
                `${BASE_URL}/caregivers/remove/${relationshipId}`,
                {
                  headers: {
                    'Authorization': `Bearer ${token}`,
                  },
                }
              );

              if (response.data.success) {
                Alert.alert('Success', 'Access removed');
                loadInvitations();
              }
            } catch (error) {
              console.error('Error removing caregiver:', error);
              Alert.alert('Error', error.response?.data?.message || 'Failed to remove access');
            } finally {
              setProcessing(null);
            }
          },
        },
      ]
    );
  };

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
          <Text className="text-2xl font-bold text-gray-900 flex-1">Invitations</Text>
        </View>
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#90CDF4" />
        </View>
      </SafeAreaView>
    );
  }

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
          <Text className="text-2xl font-bold text-gray-900 flex-1">Invitations</Text>
        </View>

        {/* Received Invitations (Pending) */}
        {receivedInvitations.length > 0 && (
          <View className="px-5 mb-6">
            <Text className="text-lg font-bold text-gray-900 mb-4">Pending Invitations</Text>
            {receivedInvitations.map((invitation) => (
              <View key={invitation.id} className="bg-white rounded-xl p-4 mb-3">
                <View className="mb-4">
                  <Text className="text-base font-bold text-gray-900 mb-1">
                    {invitation.caregiver?.name || invitation.caregiver?.email || 'Unknown'}
                  </Text>
                  <Text className="text-sm text-gray-600 mb-2">
                    {invitation.caregiver?.email}
                  </Text>
                  <Text className="text-xs text-gray-500">
                    Wants to view your medication schedule
                  </Text>
                </View>
                <View className="flex-row gap-3">
                  <TouchableOpacity
                    className="flex-1 rounded-xl p-3 items-center justify-center"
                    style={{ backgroundColor: '#43A047' }}
                    onPress={() => handleAccept(invitation.id)}
                    disabled={processing === invitation.id}
                    activeOpacity={0.7}
                  >
                    {processing === invitation.id ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <Text className="text-sm font-semibold text-white">Accept</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="flex-1 rounded-xl p-3 items-center justify-center bg-white border-2"
                    style={{ borderColor: '#E53935' }}
                    onPress={() => handleReject(invitation.id)}
                    disabled={processing === invitation.id}
                    activeOpacity={0.7}
                  >
                    <Text className="text-sm font-semibold" style={{ color: '#E53935' }}>Reject</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Sent Invitations (People with access) */}
        {sentInvitations.length > 0 && (
          <View className="px-5 mb-6">
            <Text className="text-lg font-bold text-gray-900 mb-4">
              {sentInvitations.some(inv => inv.status === 'accepted') 
                ? 'People with Access' 
                : 'Sent Invitations'}
            </Text>
            {sentInvitations.map((invitation) => (
              <View key={invitation.id} className="bg-white rounded-xl p-4 mb-3">
                <View className="mb-4">
                  <Text className="text-base font-bold text-gray-900 mb-1">
                    {invitation.care_recipient?.name || invitation.care_recipient?.email || 'Unknown'}
                  </Text>
                  <Text className="text-sm text-gray-600 mb-2">
                    {invitation.care_recipient?.email}
                  </Text>
                  <Text 
                    className="text-xs font-semibold"
                    style={{ 
                      color: invitation.status === 'accepted' ? '#43A047' : '#FF9800' 
                    }}
                  >
                    {invitation.status === 'accepted' ? 'Has access' : 'Pending acceptance'}
                  </Text>
                </View>
                {invitation.status === 'accepted' && (
                  <TouchableOpacity
                    className="rounded-xl p-3 items-center justify-center bg-white border-2"
                    style={{ borderColor: '#E53935' }}
                    onPress={() => handleRemove(invitation.id)}
                    disabled={processing === invitation.id}
                    activeOpacity={0.7}
                  >
                    {processing === invitation.id ? (
                      <ActivityIndicator size="small" color="#E53935" />
                    ) : (
                      <Text className="text-sm font-semibold" style={{ color: '#E53935' }}>Remove</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}

        {receivedInvitations.length === 0 && sentInvitations.length === 0 && (
          <View className="px-5 py-20 items-center">
            <MaterialIcons name="people-outline" size={64} color="#999" />
            <Text className="text-lg font-semibold text-gray-900 mt-4 mb-2">No invitations</Text>
            <Text className="text-sm text-gray-600 text-center">
              Invite people to view your medication schedule
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default CaregiverInvitationsScreen;

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppHeader from '../components/AppHeader';
import BottomTabBar from '../components/BottomTabBar';
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
      // Don't show alert for 401 errors (unauthorized) - user might not be logged in
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
      <View style={styles.container}>
        <AppHeader title="Invitations" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4285F4" />
        </View>
        <BottomTabBar />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader title="Invitations" />
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Received Invitations (Pending) */}
        {receivedInvitations.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pending Invitations</Text>
            {receivedInvitations.map((invitation) => (
              <View key={invitation.id} style={styles.invitationCard}>
                <View style={styles.invitationInfo}>
                  <Text style={styles.invitationName}>
                    {invitation.caregiver?.name || invitation.caregiver?.email || 'Unknown'}
                  </Text>
                  <Text style={styles.invitationEmail}>
                    {invitation.caregiver?.email}
                  </Text>
                  <Text style={styles.invitationStatus}>
                    Wants to view your medication schedule
                  </Text>
                </View>
                <View style={styles.invitationActions}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.acceptButton]}
                    onPress={() => handleAccept(invitation.id)}
                    disabled={processing === invitation.id}
                  >
                    {processing === invitation.id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.acceptButtonText}>Accept</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.rejectButton]}
                    onPress={() => handleReject(invitation.id)}
                    disabled={processing === invitation.id}
                  >
                    <Text style={styles.rejectButtonText}>Reject</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Sent Invitations (People with access) */}
        {sentInvitations.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {sentInvitations.some(inv => inv.status === 'accepted') 
                ? 'People with Access' 
                : 'Sent Invitations'}
            </Text>
            {sentInvitations.map((invitation) => (
              <View key={invitation.id} style={styles.invitationCard}>
                <View style={styles.invitationInfo}>
                  <Text style={styles.invitationName}>
                    {invitation.care_recipient?.name || invitation.care_recipient?.email || 'Unknown'}
                  </Text>
                  <Text style={styles.invitationEmail}>
                    {invitation.care_recipient?.email}
                  </Text>
                  <Text style={[
                    styles.invitationStatus,
                    invitation.status === 'accepted' && styles.statusAccepted,
                    invitation.status === 'pending' && styles.statusPending,
                  ]}>
                    {invitation.status === 'accepted' ? 'Has access' : 'Pending acceptance'}
                  </Text>
                </View>
                {invitation.status === 'accepted' && (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.removeButton]}
                    onPress={() => handleRemove(invitation.id)}
                    disabled={processing === invitation.id}
                  >
                    {processing === invitation.id ? (
                      <ActivityIndicator size="small" color="#d32f2f" />
                    ) : (
                      <Text style={styles.removeButtonText}>Remove</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}

        {receivedInvitations.length === 0 && sentInvitations.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No invitations</Text>
            <Text style={styles.emptySubtext}>
              Invite people to view your medication schedule
            </Text>
          </View>
        )}
      </ScrollView>
      <BottomTabBar />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  invitationCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  invitationInfo: {
    marginBottom: 12,
  },
  invitationName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  invitationEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  invitationStatus: {
    fontSize: 12,
    color: '#999',
  },
  statusAccepted: {
    color: '#4CAF50',
    fontWeight: '600',
  },
  statusPending: {
    color: '#FF9800',
    fontWeight: '600',
  },
  invitationActions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  rejectButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d32f2f',
  },
  rejectButtonText: {
    color: '#d32f2f',
    fontSize: 14,
    fontWeight: '600',
  },
  removeButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d32f2f',
  },
  removeButtonText: {
    color: '#d32f2f',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});

export default CaregiverInvitationsScreen;


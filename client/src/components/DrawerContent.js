import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import axios from 'axios';
import BASE_URL from '../context/Api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';

const DrawerContent = ({ navigation, onLogout }) => {
  const [pendingInvitations, setPendingInvitations] = useState([]);
  const [loadingInvitations, setLoadingInvitations] = useState(true);

  useEffect(() => {
    loadInvitations();
    // Refresh invitations when drawer opens
    const unsubscribe = navigation.addListener('focus', () => {
      loadInvitations();
    });
    return unsubscribe;
  }, [navigation]);

  const loadInvitations = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) return;

      const response = await axios.get(`${BASE_URL}/caregivers/invitations`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.data.success) {
        const received = response.data.receivedInvitations || [];
        setPendingInvitations(received.filter(inv => inv.status === 'pending'));
      }
    } catch (error) {
      console.error('Error loading invitations:', error);
    } finally {
      setLoadingInvitations(false);
    }
  };

  const handleLogout = async () => {
    if (onLogout) {
      await onLogout();
    }
    navigation.closeDrawer();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Image 
          source={require('../../assets/logo.png')} 
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      <View style={styles.menuContainer}>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => {
            navigation.navigate('Dashboard');
            navigation.closeDrawer();
          }}
        >
          <MaterialIcons name="dashboard" size={24} color="#555" style={styles.menuIcon} />
          <Text style={styles.menuItemText}>Dashboard</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => {
            navigation.navigate('Profile');
            navigation.closeDrawer();
          }}
        >
          <Ionicons name="person-circle-outline" size={24} color="#555" style={styles.menuIcon} />
          <Text style={styles.menuItemText}>Profile</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => {
            navigation.navigate('Settings');
            navigation.closeDrawer();
          }}
        >
          <Ionicons name="settings-outline" size={24} color="#555" style={styles.menuIcon} />
          <Text style={styles.menuItemText}>Settings</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => {
            navigation.navigate('Calendar');
            navigation.closeDrawer();
          }}
        >
          <Ionicons name="calendar-outline" size={24} color="#555" style={styles.menuIcon} />
          <Text style={styles.menuItemText}>Calendar</Text>
        </TouchableOpacity>

        <View style={styles.sectionDivider} />
        <Text style={styles.sectionTitle}>Health Tracking</Text>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => {
            navigation.navigate('VitalsTracking');
            navigation.closeDrawer();
          }}
        >
          <MaterialIcons name="favorite" size={24} color="#555" style={styles.menuIcon} />
          <Text style={styles.menuItemText}>Vitals Tracking</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => {
            navigation.navigate('ExerciseTracking');
            navigation.closeDrawer();
          }}
        >
          <MaterialIcons name="fitness-center" size={24} color="#555" style={styles.menuIcon} />
          <Text style={styles.menuItemText}>Exercise</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => {
            navigation.navigate('WaterIntake');
            navigation.closeDrawer();
          }}
        >
          <MaterialIcons name="water-drop" size={24} color="#555" style={styles.menuIcon} />
          <Text style={styles.menuItemText}>Water Intake</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => {
            navigation.navigate('Appointments');
            navigation.closeDrawer();
          }}
        >
          <MaterialIcons name="event" size={24} color="#555" style={styles.menuIcon} />
          <Text style={styles.menuItemText}>Appointments</Text>
        </TouchableOpacity>

        {/* Pending Invitations Section */}
        {pendingInvitations.length > 0 && (
          <>
            <View style={styles.sectionDivider} />
            <View style={styles.invitationsHeader}>
              <Text style={styles.invitationsTitle}>Pending Invitations</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{pendingInvitations.length}</Text>
              </View>
            </View>
            {pendingInvitations.slice(0, 3).map((invitation) => (
              <TouchableOpacity
                key={invitation.id}
                style={styles.invitationItem}
                onPress={() => {
                  navigation.navigate('CaregiverInvitations');
                  navigation.closeDrawer();
                }}
              >
                <MaterialIcons name="mail-outline" size={20} color="#FF9800" style={styles.invitationIcon} />
                <View style={styles.invitationInfo}>
                  <Text style={styles.invitationName} numberOfLines={1}>
                    {invitation.caregiver?.name || invitation.caregiver?.email || 'Unknown'}
                  </Text>
                  <Text style={styles.invitationSubtext} numberOfLines={1}>
                    Wants to view your schedule
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
            {pendingInvitations.length > 3 && (
              <TouchableOpacity
                style={styles.viewAllButton}
                onPress={() => {
                  navigation.navigate('CaregiverInvitations');
                  navigation.closeDrawer();
                }}
              >
                <Text style={styles.viewAllText}>
                  View all {pendingInvitations.length} invitations
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.logoutItem}
          onPress={handleLogout}
        >
          <MaterialIcons name="logout" size={24} color="#d32f2f" style={styles.logoutIcon} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    alignItems: 'flex-start', // Align logo to the start (left)
  },
  logo: {
    width: 140,
    height: 40,
  },
  menuContainer: {
    flex: 1,
    paddingTop: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    paddingLeft: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuIcon: {
    fontSize: 24,
    width: 30,
  },
  menuItemText: {
    fontSize: 16,
    color: '#555', // Softer gray
    marginLeft: 15,
    fontWeight: '500',
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    padding: 20,
  },
  logoutItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  logoutIcon: {
    fontSize: 24,
    width: 30,
  },
  logoutText: {
    fontSize: 16,
    color: '#d32f2f',
    marginLeft: 15,
    fontWeight: '600',
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 15,
    marginHorizontal: 20,
  },
  invitationsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    paddingHorizontal: 20,
    marginBottom: 10,
    marginTop: 5,
  },
  invitationsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
  },
  badge: {
    backgroundColor: '#d32f2f',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  invitationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#fff3e0',
    marginBottom: 8,
    marginHorizontal: 20,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#FF9800',
  },
  invitationIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  invitationInfo: {
    flex: 1,
  },
  invitationName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 2,
  },
  invitationSubtext: {
    fontSize: 12,
    color: '#666',
  },
  viewAllButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignItems: 'center',
  },
  viewAllText: {
    fontSize: 14,
    color: '#4285F4',
    fontWeight: '600',
  },
});

export default DrawerContent;


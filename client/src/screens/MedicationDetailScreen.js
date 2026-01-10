import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import axios from 'axios';
import BASE_URL from '../context/Api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format } from 'date-fns';
import AppHeader from '../components/AppHeader';
import BottomTabBar from '../components/BottomTabBar';
import databaseService from '../services/databaseService';
import syncService from '../services/syncService';
import BodyMap from '../components/BodyMap';
import { useAuthCheck } from '../hooks/useAuthCheck';
import CreateAccountPrompt from '../components/CreateAccountPrompt';

// Simple ID generator for React Native
const generateId = () => {
  return `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

const MedicationDetailScreen = ({ route, navigation }) => {
  const { isAuthenticated } = useAuthCheck();
  const [showCreateAccountPrompt, setShowCreateAccountPrompt] = useState(false);
  const { medicationId, isCareRecipient, careRecipientId } = route.params || {};
  const [medication, setMedication] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      setShowCreateAccountPrompt(true);
    } else {
      loadMedicationDetails();
    }
  }, [isAuthenticated, medicationId]);
  const [doseLogs, setDoseLogs] = useState([]);
  const [selectedTime, setSelectedTime] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showActionModal, setShowActionModal] = useState(false);
  const [isViewOnly, setIsViewOnly] = useState(false);
  const [doseNote, setDoseNote] = useState('');
  const [selectedTimes, setSelectedTimes] = useState([]); // For checkbox mode
  const [showBulkMarkModal, setShowBulkMarkModal] = useState(false);
  const [injectionSite, setInjectionSite] = useState(null);
  const [injectionSiteLabel, setInjectionSiteLabel] = useState(null);
  const [bodyMapView, setBodyMapView] = useState('front');

  useEffect(() => {
    loadMedicationDetails();
  }, [medicationId]);

  useEffect(() => {
    if (medication) {
      loadDoseLogs();
    }
  }, [medication]);

  const loadMedicationDetails = async () => {
    try {
      // Try to load from local database first
      const localMed = await databaseService.getMedicationById(medicationId);
      if (localMed) {
        setMedication(localMed);
        setLoading(false);
      }

      // Try to fetch from server (if online)
      const online = await syncService.isOnline();
      if (online) {
        try {
          const token = await AsyncStorage.getItem('authToken');
          const response = await axios.get(`${BASE_URL}/medications/${medicationId}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });

          if (response.data.success) {
            const serverMed = response.data.medication;
            setMedication(serverMed);
            // Update local database
            const userData = await AsyncStorage.getItem('userData');
            const user = userData ? JSON.parse(userData) : null;
            const userId = user?.id || user?.user?.id;
            if (userId) {
              await databaseService.saveMedication({ ...serverMed, user_id: userId }, false);
            }
          }
        } catch (error) {
          console.log('Using local data - offline or server error');
        }
      }
    } catch (error) {
      console.error('Error loading medication details:', error);
      Alert.alert('Error', 'Failed to load medication details');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const loadDoseLogs = async () => {
    try {
      const userData = await AsyncStorage.getItem('userData');
      const user = userData ? JSON.parse(userData) : null;
      const currentUserId = user?.id || user?.user?.id;
      
      if (!currentUserId || !medication) return;
      
      // If this is a care recipient medication, use their user_id for dose logs
      const targetUserId = (isCareRecipient && careRecipientId) ? careRecipientId : currentUserId;
      
      const logs = await databaseService.getDoseLogs(targetUserId, medication.id);
      setDoseLogs(logs);
    } catch (error) {
      console.error('Error loading dose logs:', error);
    }
  };

  const formatTime = (timeString) => {
    if (!timeString) return '';
    try {
      const [hours, minutes] = timeString.split(':');
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      return `${displayHour}:${minutes} ${ampm}`;
    } catch (e) {
      return timeString;
    }
  };

  const parseTimes = (times) => {
    if (!times) return [];
    if (Array.isArray(times)) return times;
    if (typeof times === 'string') {
      try {
        return JSON.parse(times);
      } catch (e) {
        return [];
      }
    }
    return [];
  };

  const getTimeStatus = (time, date) => {
    if (!doseLogs || doseLogs.length === 0) return 'pending';
    
    const dateStr = format(date, 'yyyy-MM-dd');
    const [hours, minutes] = time.split(':').map(Number);
    
    const matchingLog = doseLogs.find(log => {
      const logDate = new Date(log.scheduled_time);
      const logDateStr = format(logDate, 'yyyy-MM-dd');
      const logHours = logDate.getHours();
      const logMinutes = logDate.getMinutes();
      
      return logDateStr === dateStr && 
             logHours === hours && 
             logMinutes === minutes;
    });
    
    if (matchingLog) {
      return matchingLog.status; // 'taken', 'missed', or 'skipped'
    }
    
    // Check if time has passed today
    const now = new Date();
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const isToday = dateStr === todayStr;
    
    if (isToday) {
      const scheduledDateTime = new Date(date);
      scheduledDateTime.setHours(hours, minutes, 0, 0);
      if (scheduledDateTime < now) {
        return 'missed';
      }
    }
    
    return 'pending';
  };

  const handleTimePress = (time) => {
    setSelectedTime(time);
    setDoseNote(''); // Reset note when opening modal
    setShowActionModal(true);
  };

  const handleBulkMarkDose = async (status, times) => {
    try {
      const userData = await AsyncStorage.getItem('userData');
      const user = userData ? JSON.parse(userData) : null;
      const currentUserId = user?.id || user?.user?.id;
      
      if (!currentUserId) {
        Alert.alert('Error', 'User not found. Please login again.');
        return;
      }
      
      if (!medication || !times || times.length === 0) {
        return;
      }
      
      const targetUserId = (isCareRecipient && careRecipientId) ? careRecipientId : currentUserId;
      
      // Mark all selected times
      for (const time of times) {
        const [hours, minutes] = time.split(':').map(Number);
        if (isNaN(hours) || isNaN(minutes)) continue;
        
        const scheduledDateTime = new Date(selectedDate);
        scheduledDateTime.setHours(hours, minutes, 0, 0);
        
        // Check if dose log already exists
        const existingLogs = await databaseService.getDoseLogs(targetUserId, medication.id);
        const dateStr = format(scheduledDateTime, 'yyyy-MM-dd');
        const existingLog = existingLogs.find(log => {
          const logDate = new Date(log.scheduled_time);
          const logDateStr = format(logDate, 'yyyy-MM-dd');
          const logHours = logDate.getHours();
          const logMinutes = logDate.getMinutes();
          return logDateStr === dateStr && logHours === hours && logMinutes === minutes;
        });
        
        if (existingLog) {
          await databaseService.updateDoseLog(existingLog.id, {
            status: status,
            taken_time: status === 'taken' ? new Date().toISOString() : null,
            notes: doseNote || null,
          });
        } else {
          const doseLog = {
            id: generateId(),
            user_id: targetUserId,
            medication_id: medication.id,
            scheduled_time: scheduledDateTime.toISOString(),
            status: status,
            taken_time: status === 'taken' ? new Date().toISOString() : null,
            notes: doseNote || null,
          };
          await databaseService.saveDoseLog(doseLog);
        }
      }
      
      // Sync to server
      const online = await syncService.isOnline();
      if (online) {
        try {
          const token = await AsyncStorage.getItem('authToken');
          if (token) {
            for (const time of times) {
              const [hours, minutes] = time.split(':').map(Number);
              const scheduledDateTime = new Date(selectedDate);
              scheduledDateTime.setHours(hours, minutes, 0, 0);
              
              const endpoint = isCareRecipient && careRecipientId 
                ? `${BASE_URL}/caregivers/dose-logs`
                : `${BASE_URL}/dose-logs`;
              
              const payload = isCareRecipient && careRecipientId
                ? {
                    medication_id: medication.id,
                    care_recipient_id: careRecipientId,
                    scheduled_time: scheduledDateTime.toISOString(),
                    status: status,
                    notes: doseNote || null,
                  }
                : {
                    medication_id: medication.id,
                    scheduled_time: scheduledDateTime.toISOString(),
                    status: status,
                    notes: doseNote || null,
                  };
              
              await axios.post(endpoint, payload, {
                headers: { 'Authorization': `Bearer ${token}` },
              });
            }
          }
        } catch (error) {
          console.log('📴 Offline or server error - saved locally, will sync later');
        }
      }
      
      await loadDoseLogs();
      Alert.alert('Success', `Marked ${times.length} dose${times.length !== 1 ? 's' : ''} as ${status}`);
    } catch (error) {
      console.error('Error bulk marking doses:', error);
      Alert.alert('Error', `Failed to mark doses: ${error.message || 'Unknown error'}`);
    }
  };

  const handleMarkDose = async (status) => {
    try {
      const userData = await AsyncStorage.getItem('userData');
      const user = userData ? JSON.parse(userData) : null;
      const currentUserId = user?.id || user?.user?.id;
      
      if (!currentUserId) {
        Alert.alert('Error', 'User not found. Please login again.');
        return;
      }
      
      if (!medication || !selectedTime) {
        Alert.alert('Error', 'Missing medication or time information');
        return;
      }
      
      // If this is a care recipient medication, use their user_id for the dose log
      const targetUserId = (isCareRecipient && careRecipientId) ? careRecipientId : currentUserId;
      
      // Create scheduled time from selected date and time
      const [hours, minutes] = selectedTime.split(':').map(Number);
      if (isNaN(hours) || isNaN(minutes)) {
        Alert.alert('Error', 'Invalid time format');
        return;
      }
      
      const scheduledDateTime = new Date(selectedDate);
      scheduledDateTime.setHours(hours, minutes, 0, 0);
      
      // Check if a dose log already exists for this time/date
      const existingLogs = await databaseService.getDoseLogs(targetUserId, medication.id);
      const dateStr = format(scheduledDateTime, 'yyyy-MM-dd');
      const existingLog = existingLogs.find(log => {
        const logDate = new Date(log.scheduled_time);
        const logDateStr = format(logDate, 'yyyy-MM-dd');
        const logHours = logDate.getHours();
        const logMinutes = logDate.getMinutes();
        return logDateStr === dateStr && logHours === hours && logMinutes === minutes;
      });
      
      let doseLogId;
      
      if (existingLog) {
        // Update existing dose log
        console.log('📝 Updating existing dose log:', existingLog.id);
        await databaseService.updateDoseLog(existingLog.id, {
          status: status,
          taken_time: status === 'taken' ? new Date().toISOString() : null,
          notes: doseNote || null,
          injection_site: injectionSite || null,
        });
        doseLogId = existingLog.id;
      } else {
        // Create new dose log
        const doseLog = {
          id: generateId(),
          user_id: targetUserId, // Use care recipient's user_id if applicable
          medication_id: medication.id,
          scheduled_time: scheduledDateTime.toISOString(),
          status: status,
          taken_time: status === 'taken' ? new Date().toISOString() : null,
          notes: doseNote || null,
          injection_site: injectionSite || null,
        };

        console.log('💾 Saving new dose log:', doseLog.id);
        await databaseService.saveDoseLog(doseLog);
        doseLogId = doseLog.id;
      }

      // Try to sync to server (if online)
      const online = await syncService.isOnline();
      if (online) {
        try {
          const token = await AsyncStorage.getItem('authToken');
          if (token) {
            // If marking dose for care recipient, use special endpoint
            const endpoint = isCareRecipient && careRecipientId 
              ? `${BASE_URL}/caregivers/dose-logs`
              : `${BASE_URL}/dose-logs`;
            
            const payload = isCareRecipient && careRecipientId
              ? {
                  medication_id: medication.id,
                  care_recipient_id: careRecipientId,
                  scheduled_time: scheduledDateTime.toISOString(),
                  status: status,
                  notes: doseNote || null,
                  injection_site: injectionSite || null,
                }
              : {
                  medication_id: medication.id,
                  scheduled_time: scheduledDateTime.toISOString(),
                  status: status,
                  notes: doseNote || null,
                  injection_site: injectionSite || null,
                };
            
            await axios.post(
              endpoint,
              payload,
              {
                headers: { 'Authorization': `Bearer ${token}` },
              }
            );
            await databaseService.markDoseLogSynced(doseLogId);
            console.log('✅ Dose log synced to server');
          }
        } catch (error) {
          console.log('📴 Offline or server error - saved locally, will sync later:', error.message);
          // Don't show error to user - it's saved locally
        }
      }
      
      // Reload dose logs to update UI
      await loadDoseLogs();
      
      setShowActionModal(false);
      setSelectedTime(null);
      setDoseNote('');
      
      Alert.alert('Success', `Dose marked as ${status}`);
    } catch (error) {
      console.error('❌ Error marking dose:', error);
      Alert.alert('Error', `Failed to mark dose: ${error.message || 'Unknown error'}`);
    }
  };

  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <AppHeader navigation={navigation} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Text style={{ fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 20 }}>
            Create an account to view medication details and track your doses.
          </Text>
        </View>
        <CreateAccountPrompt
          visible={showCreateAccountPrompt}
          onClose={() => {
            setShowCreateAccountPrompt(false);
            navigation.goBack();
          }}
          message="Create an account to view medication details and track your doses."
        />
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <AppHeader navigation={navigation} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#d32f2f" />
        </View>
        <BottomTabBar />
      </View>
    );
  }

  if (!medication) {
    return (
      <View style={styles.container}>
        <AppHeader navigation={navigation} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Medication not found</Text>
        </View>
        <BottomTabBar />
      </View>
    );
  }

  const times = parseTimes(medication.times_of_day);

  return (
    <View style={styles.container}>
      <AppHeader navigation={navigation} />
      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          {/* Medication Photo */}
          {medication.photo_url && (
            <View style={styles.photoContainer}>
              <Image
                source={{ uri: medication.photo_url }}
                style={styles.photo}
                resizeMode="contain"
              />
            </View>
          )}

          {/* Medication Name and Edit Icon */}
          <View style={styles.headerSection}>
            <View style={styles.nameContainer}>
              <View style={styles.nameRow}>
                <Text style={styles.medicationName}>{medication.name}</Text>
                {isCareRecipient && (
                  <View style={styles.careRecipientBadge}>
                    <Text style={styles.careRecipientBadgeText}>View Only</Text>
                  </View>
                )}
              </View>
              <Text style={styles.dosage}>{medication.dosage}</Text>
            </View>
            {!isCareRecipient && (
              <TouchableOpacity
                style={styles.editIconButton}
                onPress={() => {
                  navigation.navigate('EditMedicine', { 
                    medicationId: medication.id, 
                    medication: medication 
                  });
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.editIcon}>✏️</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Basic Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Basic Information</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Frequency:</Text>
              <Text style={styles.infoValue}>
                {medication.frequency === 'daily' ? 'Daily' : 
                 medication.frequency === 'hourly' ? 'Hourly' : 
                 'Custom'} ({medication.times_per_day} {medication.times_per_day === 1 ? 'time' : 'times'} per day)
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Start Date:</Text>
              <Text style={styles.infoValue}>
                {format(new Date(medication.start_date), 'MMM d, yyyy')}
              </Text>
            </View>
            {medication.end_date && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>End Date:</Text>
                <Text style={styles.infoValue}>
                  {format(new Date(medication.end_date), 'MMM d, yyyy')}
                </Text>
              </View>
            )}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Status:</Text>
              <Text style={styles.infoValue}>
                {medication.is_continuous ? 'Continuous' : 'Scheduled'}
              </Text>
            </View>
          </View>

          {/* Times of Day */}
          {times.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <View>
                  <Text style={styles.sectionTitle}>Times of Day</Text>
                  <Text style={styles.sectionSubtitle}>
                    {format(selectedDate, 'MMM d, yyyy') === format(new Date(), 'MMM d, yyyy')
                      ? 'Select times taken today, then mark'
                      : 'Tap a time to mark dose as taken, skipped, or missed'}
                  </Text>
                </View>
                {format(selectedDate, 'MMM d, yyyy') === format(new Date(), 'MMM d, yyyy') && (
                  <TouchableOpacity
                    style={styles.bulkMarkButton}
                    onPress={() => {
                      setSelectedTimes([]);
                      setShowBulkMarkModal(true);
                    }}
                  >
                    <Text style={styles.bulkMarkButtonText}>Mark Selected</Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.timesContainer}>
                {times.map((time, index) => {
                  const status = getTimeStatus(time, selectedDate);
                  const isToday = format(selectedDate, 'MMM d, yyyy') === format(new Date(), 'MMM d, yyyy');
                  const isSelected = selectedTimes.includes(time);
                  
                  const getStatusStyle = () => {
                    if (isToday && showBulkMarkModal && isSelected) {
                      return { backgroundColor: '#E3F2FD', borderColor: '#4285F4', borderWidth: 2 };
                    }
                    switch (status) {
                      case 'taken':
                        return { backgroundColor: '#E8F5E9', borderColor: '#4CAF50' };
                      case 'missed':
                        return { backgroundColor: '#FFEBEE', borderColor: '#F44336' };
                      case 'skipped':
                        return { backgroundColor: '#FFF3E0', borderColor: '#FF9800' };
                      default:
                        return { backgroundColor: '#E0F7FA', borderColor: '#20B2AA' };
                    }
                  };
                  
                  const getStatusText = () => {
                    if (isToday && showBulkMarkModal && isSelected) {
                      return '☑';
                    }
                    switch (status) {
                      case 'taken':
                        return '✓';
                      case 'missed':
                        return '✗';
                      case 'skipped':
                        return '⊘';
                      default:
                        return isToday && showBulkMarkModal ? '☐' : '';
                    }
                  };
                  
                  return (
                    <TouchableOpacity
                      key={index}
                      style={[styles.timeChip, styles.timeChipClickable, getStatusStyle()]}
                      onPress={() => {
                        if (isToday && showBulkMarkModal) {
                          // Toggle selection in checkbox mode
                          if (isSelected) {
                            setSelectedTimes(selectedTimes.filter(t => t !== time));
                          } else {
                            setSelectedTimes([...selectedTimes, time]);
                          }
                        } else {
                          // Original behavior - open action modal
                          handleTimePress(time);
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.timeText, status !== 'pending' && styles.timeTextWithStatus]}>
                        {formatTime(time)} {getStatusText()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Food Instructions */}
          {medication.food_instructions && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Food Instructions</Text>
              <Text style={styles.infoValue}>{medication.food_instructions}</Text>
            </View>
          )}

          {/* Notes */}
          {medication.notes && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Notes</Text>
              <Text style={styles.infoValue}>{medication.notes}</Text>
            </View>
          )}

          {/* Stock Information */}
          {(medication.quantity_remaining !== null || medication.low_stock_threshold) && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Stock Information</Text>
                <TouchableOpacity
                  style={styles.addRefillButton}
                  onPress={() => navigation.navigate('AddRefill', { medicationId: medication.id })}
                >
                  <Text style={styles.addRefillButtonText}>+ Add Refill</Text>
                </TouchableOpacity>
              </View>
              {medication.quantity_remaining !== null && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Quantity Remaining:</Text>
                  <Text style={styles.infoValue}>{medication.quantity_remaining}</Text>
                </View>
              )}
              {medication.low_stock_threshold && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Low Stock Alert:</Text>
                  <Text style={styles.infoValue}>
                    {medication.low_stock_threshold} days before running out
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>
      
      {/* Bulk Mark Modal */}
      <Modal
        visible={showBulkMarkModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowBulkMarkModal(false);
          setSelectedTimes([]);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Mark Selected Doses</Text>
            <Text style={styles.modalSubtitle}>
              {selectedTimes.length} time{selectedTimes.length !== 1 ? 's' : ''} selected
            </Text>
            
            <TextInput
              style={styles.notesInput}
              placeholder="Add a note for all doses (optional)"
              placeholderTextColor="#999"
              value={doseNote}
              onChangeText={setDoseNote}
              multiline
              numberOfLines={3}
            />
            
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.actionButton, styles.takenButton]}
                onPress={async () => {
                  await handleBulkMarkDose('taken', selectedTimes);
                  setShowBulkMarkModal(false);
                  setSelectedTimes([]);
                  setDoseNote('');
                }}
              >
                <Text style={styles.actionButtonText}>Mark All as Taken</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.actionButton, styles.skippedButton]}
                onPress={async () => {
                  await handleBulkMarkDose('skipped', selectedTimes);
                  setShowBulkMarkModal(false);
                  setSelectedTimes([]);
                  setDoseNote('');
                }}
              >
                <Text style={styles.actionButtonText}>Mark All as Skipped</Text>
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setShowBulkMarkModal(false);
                setSelectedTimes([]);
                setDoseNote('');
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Action Modal */}
      <Modal
        visible={showActionModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowActionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Mark Dose</Text>
            <Text style={styles.modalSubtitle}>
              {medication?.name} - {formatTime(selectedTime)}
            </Text>
            <Text style={styles.modalDateText}>
              {format(selectedDate, 'MMM d, yyyy')}
            </Text>
            
            <TextInput
              style={styles.notesInput}
              placeholder="Add a note (optional)"
              placeholderTextColor="#999"
              value={doseNote}
              onChangeText={setDoseNote}
              multiline
              numberOfLines={3}
            />

            {/* Injection Site Selection - Only for injection medications */}
            {medication?.medication_type === 'injection' && (
              <View style={styles.injectionSiteSection}>
                <Text style={styles.injectionSiteLabel}>Injection Site</Text>
                <View style={styles.bodyMapToggle}>
                  <TouchableOpacity
                    style={[styles.viewToggle, bodyMapView === 'front' && styles.viewToggleActive]}
                    onPress={() => setBodyMapView('front')}
                  >
                    <Text style={[styles.viewToggleText, bodyMapView === 'front' && styles.viewToggleTextActive]}>
                      Front
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.viewToggle, bodyMapView === 'back' && styles.viewToggleActive]}
                    onPress={() => setBodyMapView('back')}
                  >
                    <Text style={[styles.viewToggleText, bodyMapView === 'back' && styles.viewToggleTextActive]}>
                      Back
                    </Text>
                  </TouchableOpacity>
                </View>
                <BodyMap
                  viewMode={bodyMapView}
                  onSiteSelect={handleInjectionSiteSelect}
                  selectedSites={injectionSite ? [{ region: injectionSite, label: injectionSiteLabel }] : []}
                />
                {injectionSiteLabel && (
                  <Text style={styles.selectedSiteText}>
                    Selected: {injectionSiteLabel}
                  </Text>
                )}
              </View>
            )}
            
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.actionButton, styles.takenButton]}
                onPress={() => handleMarkDose('taken')}
              >
                <Text style={styles.actionButtonText}>Taken</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.actionButton, styles.skippedButton]}
                onPress={() => handleMarkDose('skipped')}
              >
                <Text style={styles.actionButtonText}>Skipped</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.actionButton, styles.missedButton]}
                onPress={() => handleMarkDose('missed')}
              >
                <Text style={styles.actionButtonText}>Missed</Text>
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setShowActionModal(false);
                setInjectionSite(null);
                setInjectionSiteLabel(null);
                setDoseNote('');
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      
      <BottomTabBar />
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
  scrollContent: {
    paddingBottom: 20,
  },
  content: {
    padding: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
  },
  photoContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  photo: {
    width: 200,
    height: 200,
    backgroundColor: '#fff',
  },
  headerSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  nameContainer: {
    flex: 1,
    marginRight: 15,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  medicationName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginRight: 8,
  },
  careRecipientBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#4285F4',
  },
  careRecipientBadgeText: {
    fontSize: 11,
    color: '#4285F4',
    fontWeight: '600',
  },
  dosage: {
    fontSize: 18,
    color: '#666',
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  addRefillButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#4285F4',
    borderRadius: 6,
  },
  addRefillButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  bulkMarkButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#4285F4',
    borderRadius: 8,
  },
  bulkMarkButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  infoLabel: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
    width: 120,
  },
  infoValue: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  timesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  timeChip: {
    backgroundColor: '#E0F7FA',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#20B2AA',
  },
  timeChipClickable: {
    minWidth: 100,
  },
  timeText: {
    fontSize: 14,
    color: '#20B2AA',
    fontWeight: '600',
  },
  timeTextWithStatus: {
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '85%',
    maxWidth: 400,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 4,
    textAlign: 'center',
  },
  modalDateText: {
    fontSize: 14,
    color: '#999',
    marginBottom: 16,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#333',
    backgroundColor: '#f9f9f9',
    marginBottom: 20,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  actionButtons: {
    width: '100%',
    gap: 12,
    marginBottom: 16,
  },
  actionButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    width: '100%',
  },
  takenButton: {
    backgroundColor: '#4CAF50',
  },
  skippedButton: {
    backgroundColor: '#FF9800',
  },
  missedButton: {
    backgroundColor: '#F44336',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    width: '100%',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
  },
  editIconButton: {
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editIcon: {
    fontSize: 24,
  },
  injectionSiteSection: {
    marginTop: 16,
    marginBottom: 16,
  },
  injectionSiteLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  bodyMapToggle: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 8,
  },
  viewToggle: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#f9f9f9',
    alignItems: 'center',
  },
  viewToggleActive: {
    backgroundColor: '#4285F4',
    borderColor: '#4285F4',
  },
  viewToggleText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  viewToggleTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  selectedSiteText: {
    fontSize: 14,
    color: '#4285F4',
    fontWeight: '600',
    marginTop: 12,
    textAlign: 'center',
  },
});

export default MedicationDetailScreen;


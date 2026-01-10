import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import BASE_URL from '../context/Api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format, addDays, startOfWeek, eachDayOfInterval } from 'date-fns';
import databaseService from '../services/databaseService';
import syncService from '../services/syncService';
import { getMedicationIcon } from '../utils/medicationIcons';
import { 
  calculateLowStock, 
  filterMedicationsBySearch, 
  filterMedicationsByType, 
  filterMedicationsByStatus,
  sortMedications 
} from '../utils/medicationUtils';
import { useAuthCheck } from '../hooks/useAuthCheck';
import CreateAccountPrompt from '../components/CreateAccountPrompt';

const DashboardScreen = () => {
  const navigation = useNavigation();
  const { isAuthenticated } = useAuthCheck();
  const [showCreateAccountPrompt, setShowCreateAccountPrompt] = useState(false);
  const [promptMessage, setPromptMessage] = useState('');
  const [medications, setMedications] = useState([]);
  const [allMedications, setAllMedications] = useState([]); // Store all medications for filtering
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Helper to require auth for actions
  const requireAuth = (action, message) => {
    if (!isAuthenticated) {
      setPromptMessage(message);
      setShowCreateAccountPrompt(true);
    } else {
      action();
    }
  };
  
  // Caregiver view states
  const [activeTab, setActiveTab] = useState('mine'); // 'mine' or 'caring'
  const [careRecipients, setCareRecipients] = useState([]); // List of people user is caring for
  const [selectedCareRecipient, setSelectedCareRecipient] = useState(null); // Selected person in "Caring For" tab
  const [showPersonSelector, setShowPersonSelector] = useState(false);
  
  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all', 'tablet', 'pill', etc.
  const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'low_stock', 'active'
  const [sortBy, setSortBy] = useState('name'); // 'name', 'type', 'quantity', 'date'
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc', 'desc'
  const [showFilters, setShowFilters] = useState(false);
  const [lowStockMedications, setLowStockMedications] = useState([]);

  useEffect(() => {
    loadMedications();
    loadCareRecipients();
  }, []);

  // Load care recipients (people whose schedules the user can view)
  const loadCareRecipients = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) return;

      const response = await axios.get(`${BASE_URL}/caregivers/invitations`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.data.success) {
        // Get accepted relationships where user is the caregiver
        const acceptedRelationships = (response.data.sentInvitations || []).filter(
          inv => inv.status === 'accepted'
        );
        
        const recipients = acceptedRelationships.map(inv => ({
          id: inv.care_recipient.id,
          name: inv.care_recipient.name || inv.care_recipient.email,
          email: inv.care_recipient.email,
        }));
        
        setCareRecipients(recipients);
        
        // Auto-select first recipient if available
        if (recipients.length > 0 && !selectedCareRecipient) {
          setSelectedCareRecipient(recipients[0]);
        }
      }
    } catch (error) {
      console.error('Error loading care recipients:', error);
    }
  };


  // Force re-render when selectedDate changes
  const [refreshKey, setRefreshKey] = useState(0);
  
  useEffect(() => {
    // Trigger re-render when selectedDate changes
    setRefreshKey(prev => prev + 1);
  }, [selectedDate]);

  const loadMedications = async () => {
    try {
      const userData = await AsyncStorage.getItem('userData');
      const user = userData ? JSON.parse(userData) : null;
      // Use 'guest' as userId if no user data (guest mode)
      const userId = user?.id || user?.user?.id || 'guest';

      console.log('🔍 Dashboard - Loading medications...');
      console.log('🔍 Dashboard - User data:', user ? 'Found' : 'Not found');
      console.log('🔍 Dashboard - User ID:', userId);

      // Load from local database first (offline-first)
      console.log('🔍 Dashboard - Loading from local database...');
      const localMedications = await databaseService.getMedications(userId);
      console.log('🔍 Dashboard - Local medications found:', localMedications.length);
      setAllMedications(localMedications);
      setMedications(localMedications);
      setLoading(false);
      
      // Calculate low stock medications
      calculateLowStockMedications(localMedications);

      // Try to sync and fetch latest from server (if online)
      const online = await syncService.isOnline();
      console.log('🔍 Dashboard - Online status:', online);
      if (online) {
        try {
          const token = await AsyncStorage.getItem('authToken');
          console.log('🔍 Dashboard - Fetching from server...');
          const response = await axios.get(`${BASE_URL}/medications`, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });

          if (response.data.success) {
            const serverMedications = response.data.medications || [];
            console.log('🔍 Dashboard - Server medications found:', serverMedications.length);
            console.log('🔍 Dashboard - Sample server medication:', serverMedications[0]);
            
            // Store medications with care recipient info
            // Server returns medications with is_care_recipient flag and user info
            const medicationsWithOwner = serverMedications.map(med => ({
              ...med,
              ownerName: med.is_care_recipient && med.user ? (med.user.name || med.user.email) : null,
              ownerId: med.is_care_recipient && med.user ? med.user.id : null,
            }));
            
            // Update local database with server data
            for (const serverMed of serverMedications) {
              try {
                // For care recipient medications, we need to store them with the original user_id
                const medToSave = {
                  ...serverMed,
                  user_id: serverMed.is_care_recipient ? serverMed.user_id : userId,
                };
                console.log('🔍 Dashboard - Saving medication:', medToSave.id, medToSave.name);
                await databaseService.saveMedication(medToSave, false);
                await databaseService.markMedicationSynced(serverMed.id);
                console.log('✅ Dashboard - Medication saved successfully');
              } catch (saveError) {
                console.error('❌ Dashboard - Error saving medication:', saveError);
              }
            }
            
            // Reload from local database
            const updatedMedications = await databaseService.getMedications(userId);
            console.log('🔍 Dashboard - Updated medications after sync:', updatedMedications.length);
            
            // Add owner info to medications from server data
            const medicationsWithOwnerInfo = updatedMedications.map(localMed => {
              const serverMed = medicationsWithOwner.find(sm => sm.id === localMed.id);
              return {
                ...localMed,
                is_care_recipient: serverMed?.is_care_recipient || false,
                ownerName: serverMed?.ownerName || null,
                ownerId: serverMed?.ownerId || null,
              };
            });
            
            setAllMedications(medicationsWithOwnerInfo);
            setMedications(medicationsWithOwnerInfo);
            
            // Calculate low stock medications
            calculateLowStockMedications(medicationsWithOwnerInfo);
          }
        } catch (error) {
          console.log('📴 Using local data - offline or server error:', error.message);
        }
      }
    } catch (error) {
      console.error('❌ Error loading medications:', error);
      setLoading(false);
    }
  };

  // Calculate low stock medications
  const calculateLowStockMedications = async (meds) => {
    try {
      const userData = await AsyncStorage.getItem('userData');
      const user = userData ? JSON.parse(userData) : null;
      // Use 'guest' as userId if no user data (guest mode)
      const userId = user?.id || user?.user?.id || 'guest';
      
      const allDoseLogs = await databaseService.getDoseLogs(userId);
      const lowStock = [];
      
      meds.forEach(med => {
        const stockInfo = calculateLowStock(med, allDoseLogs);
        if (stockInfo.isLowStock) {
          lowStock.push({ medication: med, stockInfo });
        }
      });
      
      setLowStockMedications(lowStock);
    } catch (error) {
      console.error('Error calculating low stock:', error);
    }
  };

  // Apply filters, search, and tab filtering
  useEffect(() => {
    let filtered = [...allMedications];
    
    // Apply tab filter (My Medications vs Caring For)
    if (activeTab === 'mine') {
      // Show only own medications
      filtered = filtered.filter(med => !med.is_care_recipient);
    } else if (activeTab === 'caring') {
      // Show only care recipient medications
      filtered = filtered.filter(med => med.is_care_recipient);
      
      // If a specific person is selected, filter by that person
      if (selectedCareRecipient) {
        filtered = filtered.filter(med => med.ownerId === selectedCareRecipient.id);
      }
    }
    
    // Apply search
    filtered = filterMedicationsBySearch(filtered, searchTerm);
    
    // Apply type filter
    filtered = filterMedicationsByType(filtered, filterType);
    
    // Apply status filter
    filtered = filterMedicationsByStatus(filtered, filterStatus, (med) => {
      const stockInfo = calculateLowStock(med, []);
      return stockInfo;
    });
    
    // Apply sorting
    filtered = sortMedications(filtered, sortBy, sortOrder);
    
    setMedications(filtered);
  }, [allMedications, activeTab, selectedCareRecipient, searchTerm, filterType, filterStatus, sortBy, sortOrder]);

  // Quick action: Mark all taken for today
  const handleMarkAllTaken = async () => {
    try {
      const userData = await AsyncStorage.getItem('userData');
      const user = userData ? JSON.parse(userData) : null;
      // Use 'guest' as userId if no user data (guest mode)
      const userId = user?.id || user?.user?.id || 'guest';
      
      const today = new Date();
      const todayStr = format(today, 'yyyy-MM-dd');
      const medicationsForToday = getMedicationsForDate();
      
      let markedCount = 0;
      
      for (const entry of medicationsForToday) {
        const med = entry.medication;
        const time = entry.time;
        
        // Check if already logged
        const doseLogs = await databaseService.getDoseLogs(userId, med.id);
        const [hours, minutes] = time.split(':').map(Number);
        
        const existingLog = doseLogs.find(log => {
          const logDate = new Date(log.scheduled_time);
          const logDateStr = format(logDate, 'yyyy-MM-dd');
          return logDateStr === todayStr && 
                 logDate.getHours() === hours && 
                 logDate.getMinutes() === minutes;
        });
        
        if (!existingLog || existingLog.status !== 'taken') {
          const scheduledDateTime = new Date(today);
          scheduledDateTime.setHours(hours, minutes, 0, 0);
          
          const doseLog = {
            id: `dose_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            user_id: userId,
            medication_id: med.id,
            scheduled_time: scheduledDateTime.toISOString(),
            status: 'taken',
            taken_time: new Date().toISOString(),
          };
          
          await databaseService.saveDoseLog(doseLog);
          markedCount++;
        }
      }
      
      // Sync to server
      const online = await syncService.isOnline();
      if (online) {
        try {
          await syncService.syncDoseLogs(await AsyncStorage.getItem('authToken'));
        } catch (error) {
          console.error('Error syncing dose logs:', error);
        }
      }
      
      Alert.alert('Success', `Marked ${markedCount} medication${markedCount !== 1 ? 's' : ''} as taken`);
      refreshMedicationStatus();
    } catch (error) {
      console.error('Error marking all as taken:', error);
      Alert.alert('Error', 'Failed to mark medications as taken');
    }
  };

  const formatTime = (timeString) => {
    if (!timeString) return '';
    try {
      const [hours, minutes] = timeString.split(':');
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      return `${displayHour}.${minutes} ${ampm}`;
    } catch (e) {
      return timeString;
    }
  };

  const getMedicationStatus = async (med, time, selectedDate) => {
    try {
      const userData = await AsyncStorage.getItem('userData');
      const user = userData ? JSON.parse(userData) : null;
      // Use 'guest' as userId if no user data (guest mode)
      const currentUserId = user?.id || user?.user?.id || 'guest';
      
      // If this is a care recipient medication, use the care recipient's user_id
      const targetUserId = (med.is_care_recipient && med.ownerId) ? med.ownerId : currentUserId;
      
      // Check dose logs for this medication and time
      const doseLogs = await databaseService.getDoseLogs(targetUserId, med.id);
      
      // Find dose log for this specific time and date
      const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
      const [hours, minutes] = time.split(':').map(Number);
      const scheduledDateTime = new Date(selectedDate);
      scheduledDateTime.setHours(hours, minutes, 0, 0);
      
      const matchingLog = doseLogs.find(log => {
        const logDate = new Date(log.scheduled_time);
        const logDateStr = format(logDate, 'yyyy-MM-dd');
        const logHours = logDate.getHours();
        const logMinutes = logDate.getMinutes();
        
        return logDateStr === selectedDateStr && 
               logHours === hours && 
               logMinutes === minutes;
      });
      
      if (matchingLog) {
        return matchingLog.status; // 'taken', 'missed', or 'skipped'
      }
      
      // If no log found, check if time has passed
      const now = new Date();
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const isToday = selectedDateStr === todayStr;
      
      if (isToday && scheduledDateTime < now) {
        // Time has passed and no log - likely missed
        return 'missed';
      }
      
      return 'pending';
    } catch (error) {
      console.error('Error getting medication status:', error);
      return 'pending';
    }
  };

  const getMedicationsForDate = () => {
    if (!medications || medications.length === 0) {
      return [];
    }

    const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
    
    return medications
      .filter(med => {
        // Check if medication is active on the selected date
        if (!med.start_date) return false;
        
        const startDate = new Date(med.start_date);
        const startDateStr = format(startDate, 'yyyy-MM-dd');
        
        // Check if selected date is on or after start date
        if (selectedDateStr < startDateStr) {
          return false;
        }
        
        // Check end date if medication is not continuous
        if (!med.is_continuous && med.end_date) {
          const endDate = new Date(med.end_date);
          const endDateStr = format(endDate, 'yyyy-MM-dd');
          if (selectedDateStr > endDateStr) {
            return false;
          }
        }
        
        // Check if medication has times
        if (!med.times_of_day || (Array.isArray(med.times_of_day) && med.times_of_day.length === 0)) {
          return false;
        }
        
        return true;
      })
      .map(med => {
        // Parse times_of_day from JSON if it's a string
        let times = med.times_of_day;
        if (typeof times === 'string') {
          try {
            times = JSON.parse(times);
          } catch (e) {
            console.warn('Failed to parse times_of_day for medication:', med.id, e);
            times = [];
          }
        }
        
        // Ensure times is an array
        if (!Array.isArray(times)) {
          times = [];
        }
        
        // Create entries for each time (status will be updated asynchronously)
        const medicationEntries = times.map(time => ({
          medication: med,
          time: time,
          status: 'pending', // Will be updated by useEffect
        }));
        
        return medicationEntries;
      })
      .flat()
      .filter(entry => entry.time) // Remove entries without valid time
      .sort((a, b) => {
        // Sort by time
        const [aHours, aMinutes] = a.time.split(':').map(Number);
        const [bHours, bMinutes] = b.time.split(':').map(Number);
        if (aHours !== bHours) return aHours - bHours;
        return aMinutes - bMinutes;
      });
  };

  const getTakenMedications = () => {
    // For now, return empty or mock data
    // This will be populated when we implement dose logging
    return [];
  };

  // Generate week days for horizontal calendar
  const getWeekDays = () => {
    const weekStart = startOfWeek(selectedDate, { weekStartsOn: 0 });
    const days = eachDayOfInterval({
      start: weekStart,
      end: addDays(weekStart, 6),
    });
    return days;
  };

  // Memoize medicationsForDate to avoid recalculating on every render
  const [cachedMedicationsForDate, setCachedMedicationsForDate] = useState([]);
  
  // Helper function to refresh medication status
  const refreshMedicationStatus = React.useCallback(async () => {
    const filtered = getMedicationsForDate();
    
    // Update status for each medication entry by checking dose logs
    const updatedEntries = await Promise.all(
      filtered.map(async (entry) => {
        const status = await getMedicationStatus(entry.medication, entry.time, selectedDate);
        return { ...entry, status };
      })
    );
    
    setCachedMedicationsForDate(updatedEntries);
    
    // Debug: Log medications and filtered results
    console.log('📊 Dashboard - Total medications:', medications.length);
    console.log('📊 Dashboard - Selected date:', format(selectedDate, 'yyyy-MM-dd'));
    console.log('📊 Dashboard - Medications for date:', updatedEntries.length);
  }, [medications, selectedDate]);
  
  // Update cached medications when medications or selectedDate changes
  useEffect(() => {
    refreshMedicationStatus();
  }, [medications, selectedDate, refreshMedicationStatus]);
  
  // Refresh when screen comes into focus (e.g., returning from medication detail)
  useFocusEffect(
    React.useCallback(() => {
      // Refresh medication status when screen is focused
      refreshMedicationStatus();
    }, [refreshMedicationStatus])
  );

  const weekDays = getWeekDays();
  const takenMeds = getTakenMedications();
  const isToday = (date) => format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
  const isSelected = (date) => format(date, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');

  const isSelectedDateToday = isToday(selectedDate);
  const dateDisplayText = isSelectedDateToday 
    ? `Today, ${format(selectedDate, 'd MMM yyyy')}`
    : format(selectedDate, 'EEEE, d MMM yyyy');

  return (
    <SafeAreaView className="flex-1 bg-white">
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
      {/* Header with Selected Date */}
      <View className="px-5 pt-5 pb-2.5">
        <Text className="text-lg font-semibold text-gray-600">
          {dateDisplayText}
        </Text>
      </View>

      {/* Tabs: My Medications / Caring For */}
      <View className="flex-row border-b border-gray-200">
        <TouchableOpacity
          className={`flex-1 py-3 items-center border-b-2 ${
            activeTab === 'mine' ? 'border-primary' : 'border-transparent'
          }`}
          onPress={() => setActiveTab('mine')}
        >
          <Text className={`text-sm font-medium ${
            activeTab === 'mine' ? 'text-primary font-semibold' : 'text-gray-600'
          }`}>
            My Medications
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          className={`flex-1 py-3 items-center border-b-2 ${
            activeTab === 'caring' ? 'border-primary' : 'border-transparent'
          }`}
          onPress={() => {
            setActiveTab('caring');
            // Auto-select first recipient if none selected
            if (careRecipients.length > 0 && !selectedCareRecipient) {
              setSelectedCareRecipient(careRecipients[0]);
            }
          }}
        >
          <Text className={`text-sm font-medium ${
            activeTab === 'caring' ? 'text-primary font-semibold' : 'text-gray-600'
          }`}>
            Caring For {careRecipients.length > 0 && `(${careRecipients.length})`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Person Selector for "Caring For" tab */}
      {activeTab === 'caring' && careRecipients.length > 0 && (
        <View className="px-5 pt-2.5 pb-2.5 relative z-[100]">
          <TouchableOpacity
            className="flex-row items-center bg-gray-100 px-4 py-3 rounded-lg border border-gray-300"
            onPress={() => setShowPersonSelector(!showPersonSelector)}
            activeOpacity={0.7}
          >
            <MaterialIcons name="person" size={20} color="#666" />
            <Text className="flex-1 ml-2.5 text-sm text-gray-800 font-medium">
              {selectedCareRecipient ? selectedCareRecipient.name : 'Select person...'}
            </Text>
            <MaterialIcons 
              name={showPersonSelector ? "expand-less" : "expand-more"} 
              size={20} 
              color="#666" 
            />
          </TouchableOpacity>
          
          {showPersonSelector && (
            <View className="absolute top-full left-5 right-5 bg-white rounded-lg border border-gray-300 mt-1.5 shadow-lg z-[200]">
              <TouchableOpacity
                className={`px-4 py-3 border-b border-gray-100 ${
                  !selectedCareRecipient ? 'bg-blue-50' : ''
                }`}
                onPress={() => {
                  setSelectedCareRecipient(null);
                  setShowPersonSelector(false);
                }}
                activeOpacity={0.7}
              >
                <Text className={`text-sm ${
                  !selectedCareRecipient ? 'text-primary font-semibold' : 'text-gray-800'
                }`}>All People</Text>
              </TouchableOpacity>
              {careRecipients.map(person => (
                <TouchableOpacity
                  key={person.id}
                  className={`px-4 py-3 border-b border-gray-100 ${
                    selectedCareRecipient?.id === person.id ? 'bg-blue-50' : ''
                  }`}
                  onPress={() => {
                    setSelectedCareRecipient(person);
                    setShowPersonSelector(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text className={`text-sm ${
                    selectedCareRecipient?.id === person.id ? 'text-primary font-semibold' : 'text-gray-800'
                  }`}>
                    {person.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Low Stock Warning Banner */}
      {lowStockMedications.length > 0 && (
        <View className="flex-row items-center bg-orange-50 p-3 mx-5 mt-2.5 rounded-lg border-l-4 border-orange-500">
          <MaterialIcons name="warning" size={20} color="#FF6B00" />
          <Text className="ml-2 text-sm text-orange-500 font-semibold">
            {lowStockMedications.length} medication{lowStockMedications.length !== 1 ? 's' : ''} running low
          </Text>
        </View>
      )}

      {/* Search Bar */}
      <View className="flex-row items-center bg-gray-100 mx-5 mt-4 mb-2.5 px-4 rounded-lg border border-gray-300">
        <View className="mr-2.5">
          <MaterialIcons name="search" size={20} color="#999" />
        </View>
        <TextInput
          className="flex-1 text-sm text-gray-800 py-2"
          placeholder="Search medications..."
          value={searchTerm}
          onChangeText={setSearchTerm}
          placeholderTextColor="#999"
        />
        {searchTerm.length > 0 && (
          <TouchableOpacity onPress={() => setSearchTerm('')} className="ml-2.5" activeOpacity={0.7}>
            <MaterialIcons name="close" size={20} color="#999" />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter and Sort Bar */}
      <View className="flex-row justify-between items-center px-5 py-2.5 border-b border-gray-300">
        <TouchableOpacity 
          className="flex-row items-center px-3 py-1.5 rounded-lg bg-gray-100 border border-gray-300"
          onPress={() => setShowFilters(!showFilters)}
          activeOpacity={0.7}
        >
          <MaterialIcons name="filter-list" size={18} color="#666" />
          <Text className="ml-1.5 text-sm text-gray-600 font-medium">Filters</Text>
        </TouchableOpacity>
        
        {isSelectedDateToday && cachedMedicationsForDate.length > 0 && (
          <TouchableOpacity 
            className="flex-row items-center px-3 py-1.5 rounded-lg bg-green-50 border border-green-500"
            onPress={handleMarkAllTaken}
            activeOpacity={0.7}
          >
            <MaterialIcons name="check-circle" size={18} color="#43A047" />
            <Text className="ml-1.5 text-sm text-green-600 font-semibold">Mark All Taken</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Modal */}
      {showFilters && (
        <View className="absolute top-0 left-0 right-0 bottom-0 bg-black/50 z-[1000]">
          <View className="bg-white mt-24 mx-5 rounded-xl p-5 max-h-[70%]">
            <View className="flex-row justify-between items-center mb-5">
              <Text className="text-lg font-bold text-gray-800">Filters & Sort</Text>
              <TouchableOpacity onPress={() => setShowFilters(false)} activeOpacity={0.7}>
                <MaterialIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Type Filter */}
            <View className="mb-5">
              <Text className="text-sm font-semibold text-gray-600 mb-2.5">Medication Type</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                {['all', 'tablet', 'pill', 'syrup', 'injection', 'capsule'].map(type => (
                  <TouchableOpacity
                    key={type}
                    className={`px-4 py-2 rounded-lg border mr-2 ${
                      filterType === type
                        ? 'bg-primary border-primary'
                        : 'bg-gray-100 border-gray-300'
                    }`}
                    onPress={() => setFilterType(type)}
                    activeOpacity={0.7}
                  >
                    <Text className={`text-xs font-medium ${
                      filterType === type ? 'text-white' : 'text-gray-600'
                    }`}>
                      {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Status Filter */}
            <View className="mb-5">
              <Text className="text-sm font-semibold text-gray-600 mb-2.5">Status</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                {['all', 'low_stock', 'active'].map(status => (
                  <TouchableOpacity
                    key={status}
                    className={`px-4 py-2 rounded-lg border mr-2 ${
                      filterStatus === status
                        ? 'bg-primary border-primary'
                        : 'bg-gray-100 border-gray-300'
                    }`}
                    onPress={() => setFilterStatus(status)}
                    activeOpacity={0.7}
                  >
                    <Text className={`text-xs font-medium ${
                      filterStatus === status ? 'text-white' : 'text-gray-600'
                    }`}>
                      {status === 'all' ? 'All' : status === 'low_stock' ? 'Low Stock' : 'Active'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Sort Options */}
            <View className="mb-5">
              <Text className="text-sm font-semibold text-gray-600 mb-2.5">Sort By</Text>
              <View className="flex-row flex-wrap gap-2">
                {['name', 'type', 'quantity', 'date'].map(option => (
                  <TouchableOpacity
                    key={option}
                    className={`flex-row items-center px-3 py-2 rounded-lg border ${
                      sortBy === option
                        ? 'bg-blue-50 border-primary'
                        : 'bg-gray-100 border-gray-300'
                    }`}
                    onPress={() => {
                      if (sortBy === option) {
                        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortBy(option);
                        setSortOrder('asc');
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <Text className={`text-xs font-medium mr-1 ${
                      sortBy === option ? 'text-primary' : 'text-gray-600'
                    }`}>
                      {option.charAt(0).toUpperCase() + option.slice(1)}
                    </Text>
                    {sortBy === option && (
                      <MaterialIcons 
                        name={sortOrder === 'asc' ? 'arrow-upward' : 'arrow-downward'} 
                        size={16} 
                        color="#4285F4" 
                      />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Horizontal Calendar View */}
      <View className="py-4 bg-white border-b border-gray-300">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-5">
          {weekDays.map((day, index) => {
            const dayName = format(day, 'EEE');
            const dayNumber = format(day, 'd');
            const isDayToday = isToday(day);
            const isDaySelected = isSelected(day);

            return (
              <TouchableOpacity
                key={index}
                className="items-center mr-4 min-w-[50px]"
                onPress={() => setSelectedDate(day)}
                activeOpacity={0.7}
              >
                <Text className={`text-xs mb-2 font-medium ${
                  (isDayToday || isDaySelected) ? 'text-primary font-semibold' : 'text-gray-600'
                }`}>
                  {dayName}
                </Text>
                <View className={`w-10 h-10 rounded-full justify-center items-center ${
                  (isDayToday || isDaySelected) ? 'bg-primary' : 'bg-transparent'
                }`}>
                  <Text className={`text-base font-medium ${
                    (isDayToday || isDaySelected) ? 'text-white font-semibold' : 'text-gray-600'
                  }`}>
                    {dayNumber}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Medications for Selected Date */}
      <View className="px-5 py-5 border-b border-gray-300">
        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-xl font-bold text-gray-600">Medications</Text>
          {cachedMedicationsForDate.length > 0 && (
            <TouchableOpacity 
              onPress={() => requireAuth(
                () => navigation.navigate('Calendar'),
                'Create an account to access the full calendar view.'
              )}
              activeOpacity={0.7}
            >
              <Text className="text-sm text-primary font-semibold">View all</Text>
            </TouchableOpacity>
          )}
        </View>

        {cachedMedicationsForDate.length > 0 ? (
          <View className="mt-2.5">
            {cachedMedicationsForDate.map((entry, index) => {
              const med = entry.medication;
              const time = entry.time;
              const status = entry.status;

              // Get background color based on status
              const getStatusColor = () => {
                switch (status) {
                  case 'taken':
                    return 'bg-green-50'; // Light green
                  case 'missed':
                    return 'bg-red-50'; // Light red
                  case 'skipped':
                    return 'bg-orange-50'; // Light orange
                  case 'pending':
                  default:
                    return 'bg-orange-50'; // Light orange
                }
              };

              // Get status text
              const getStatusText = () => {
                switch (status) {
                  case 'taken':
                    return 'Taken';
                  case 'missed':
                    return 'Missed';
                  case 'skipped':
                    return 'Skipped';
                  case 'pending':
                  default:
                    return 'Pending';
                }
              };

              // Check if low stock
              const stockInfo = calculateLowStock(med, []);
              const isLowStock = stockInfo.isLowStock;

              return (
                <TouchableOpacity
                  key={`${med.id}-${time}-${index}`}
                  className={`bg-white p-4 mb-3 border rounded-xl relative ${
                    med.is_care_recipient ? 'border-l-4 border-l-blue-500' : 'border-gray-300'
                  } ${getStatusColor()}`}
                  onPress={() => requireAuth(
                    () => navigation.navigate('MedicationDetail', { 
                      medicationId: med.id,
                      isCareRecipient: med.is_care_recipient || false,
                      careRecipientId: med.ownerId || null
                    }),
                    'Create an account to view medication details and track doses.'
                  )}
                  activeOpacity={0.7}
                >
                  <View className="flex-1 relative">
                    {/* Top right corner icons for low stock and care recipient badge */}
                    <View className="absolute top-0 right-0 flex-row items-center gap-2 z-10">
                      {med.is_care_recipient && (
                        <View className="flex-row items-center bg-blue-50 px-1.5 py-0.5 rounded border border-primary">
                          <MaterialIcons name="person" size={14} color="#4285F4" />
                          <Text className="text-[11px] text-primary font-semibold ml-1">
                            {med.ownerName || 'Other'}
                          </Text>
                        </View>
                      )}
                      {isLowStock && (
                        <View>
                          <MaterialIcons name="warning" size={20} color="#FF6B00" />
                        </View>
                      )}
                    </View>
                    
                    <View className="flex-row items-center">
                      <View className="mr-3">
                        {getMedicationIcon(med.medication_type || 'tablet', 24)}
                      </View>
                      <View className="flex-1">
                        <View className="flex-row items-center">
                          <Text className="text-base font-semibold text-gray-600 mb-1">
                            {med.name}
                          </Text>
                          {med.is_care_recipient && (
                            <View className="ml-1.5">
                              <MaterialIcons name="visibility" size={16} color="#4285F4" />
                            </View>
                          )}
                        </View>
                        <Text className="text-sm text-gray-600 mb-1">
                          {med.dosage}
                        </Text>
                        <Text className="text-sm text-gray-600">
                          {formatTime(time)}
                        </Text>
                        {med.quantity_remaining !== null && med.quantity_remaining !== undefined && (
                          <Text className="text-xs text-gray-400 mt-0.5">
                            {med.quantity_remaining} remaining
                          </Text>
                        )}
                      </View>
                    </View>
                    
                    {/* Status in bottom right corner */}
                    <View className="absolute bottom-2 right-2 px-2 py-1 rounded">
                      <Text className="text-xs font-semibold text-gray-600">{getStatusText()}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View className="py-5 items-center">
            <Text className="text-sm text-gray-400">No medications scheduled for this date</Text>
          </View>
        )}
      </View>

    </ScrollView>

    {/* Create Account Prompt Modal */}
    <CreateAccountPrompt
      visible={showCreateAccountPrompt}
      onClose={() => setShowCreateAccountPrompt(false)}
      message={promptMessage}
    />
    </SafeAreaView>
  );
};

export default DashboardScreen;

import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import axios from 'axios';
import BASE_URL from '../context/Api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format, addDays, startOfWeek, eachDayOfInterval, parseISO, isPast, isToday } from 'date-fns';
import databaseService from '../services/databaseService';
import syncService from '../services/syncService';
import { getMedicationIcon } from '../utils/medicationIcons';
import { useAuthCheck } from '../hooks/useAuthCheck';
import CreateAccountPrompt from '../components/CreateAccountPrompt';
import { getAuthToken } from '../utils/authToken';

const CalendarScreen = ({ navigation }) => {
  const rootNavigation = navigation.getParent();
  const { isAuthenticated } = useAuthCheck();
  const [showCreateAccountPrompt, setShowCreateAccountPrompt] = useState(false);
  const [medications, setMedications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [medicationsForSelectedDate, setMedicationsForSelectedDate] = useState([]);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setShowCreateAccountPrompt(true);
    } else {
      loadMedications();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadMedications();
  }, []);

  useEffect(() => {
    if (medications.length > 0) {
      updateMedicationsForDate();
    }
  }, [selectedDate, medications]);

  useFocusEffect(
    React.useCallback(() => {
      loadMedications();
    }, [])
  );

  const loadMedications = async () => {
    setLoading(true);
    try {
      const userData = await AsyncStorage.getItem('userData');
      const user = userData ? JSON.parse(userData) : null;
      const currentUserId = user?.id || user?.user?.id;

      if (!currentUserId) {
        setLoading(false);
        return;
      }

      setUserId(currentUserId);

      // Load from local database first (offline-first) - skip on web
      if (Platform.OS !== 'web') {
        const localMedications = await databaseService.getMedications(currentUserId);
        setMedications(localMedications);
      } else {
        setMedications([]);
      }

      // Try to sync and fetch latest from server (if online)
      const online = await syncService.isOnline();
      if (online) {
        try {
          const token = await getAuthToken();
          const response = await axios.get(`${BASE_URL}/medications`, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });

          if (response.data.success) {
            const serverMedications = response.data.medications || [];
            
            // Update local database with server data (skip on web)
            if (Platform.OS !== 'web') {
              for (const serverMed of serverMedications) {
                try {
                  await databaseService.saveMedication(serverMed, false);
                  await databaseService.markMedicationSynced(serverMed.id);
                } catch (saveError) {
                  console.error('Error saving medication:', saveError);
                }
              }
              
              // Reload from local database
              const updatedMedications = await databaseService.getMedications(currentUserId);
              setMedications(updatedMedications);
            } else {
              setMedications(serverMedications);
            }
          }
        } catch (error) {
          console.log('Using local data - offline or server error:', error.message);
        }
      }
    } catch (error) {
      console.error('Error loading medications:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateMedicationsForDate = async () => {
    if (!userId) return;
    setUpdatingStatus(true);
    try {
      const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
      const doseLogs = await databaseService.getDoseLogs(userId);
      
      const filtered = medications
        .filter(med => {
          if (!med.start_date) return false;
          const startDate = new Date(med.start_date);
          const startDateStr = format(startDate, 'yyyy-MM-dd');
          if (selectedDateStr < startDateStr) return false;
          if (!med.is_continuous && med.end_date) {
            const endDate = new Date(med.end_date);
            const endDateStr = format(endDate, 'yyyy-MM-dd');
            if (selectedDateStr > endDateStr) return false;
          }
          return med.times_of_day && (Array.isArray(med.times_of_day) ? med.times_of_day.length > 0 : true);
        })
        .map(med => {
          let times = med.times_of_day;
          if (typeof times === 'string') {
            try {
              times = JSON.parse(times);
            } catch (e) {
              return [];
            }
          }
          if (!Array.isArray(times)) return [];

          return times.map(time => {
            const [hours, minutes] = time.split(':').map(Number);
            const scheduledDateTime = new Date(selectedDate);
            scheduledDateTime.setHours(hours, minutes, 0, 0);

            const matchingLog = doseLogs.find(log => {
              const logDate = new Date(log.scheduled_time);
              const logDateStr = format(logDate, 'yyyy-MM-dd');
              return logDateStr === selectedDateStr && 
                     logDate.getHours() === hours && 
                     logDate.getMinutes() === minutes;
            });

            const status = matchingLog ? matchingLog.status : 
                          (scheduledDateTime < new Date() && format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') ? 'missed' : 'pending');

            return {
              medication: med,
              time: time,
              status: status,
              scheduledDateTime: scheduledDateTime,
            };
          });
        })
        .flat()
        .sort((a, b) => a.scheduledDateTime - b.scheduledDateTime);

      setMedicationsForSelectedDate(filtered);
    } catch (error) {
      console.error('Error updating medications for date:', error);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const formatTime = (timeString) => {
    if (!timeString) return '';
    try {
      const [hours, minutes] = timeString.split(':');
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      return `${displayHour}:${minutes.padStart(2, '0')} ${ampm}`;
    } catch (e) {
      return timeString;
    }
  };

  const handleMarkTaken = async (medicationId, time) => {
    try {
      const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
      const [hours, minutes] = time.split(':').map(Number);
      const scheduledDateTime = new Date(selectedDate);
      scheduledDateTime.setHours(hours, minutes, 0, 0);

      const doseLog = {
        id: `dose_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        user_id: userId,
        medication_id: medicationId,
        scheduled_time: scheduledDateTime.toISOString(),
        status: 'taken',
        taken_time: new Date().toISOString(),
      };

      await databaseService.saveDoseLog(doseLog);

      // Sync to server if online
      const online = await syncService.isOnline();
      if (online && isAuthenticated) {
        try {
          await syncService.syncDoseLogs();
        } catch (error) {
          console.error('Error syncing dose log:', error);
        }
      }

      // Refresh medications
      updateMedicationsForDate();
    } catch (error) {
      console.error('Error marking dose as taken:', error);
    }
  };

  const getTimeOfDay = (time) => {
    const hour = parseInt(time.split(':')[0]);
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    return 'evening';
  };

  const groupMedicationsByTimeOfDay = () => {
    const groups = {
      morning: [],
      afternoon: [],
      evening: [],
    };

    medicationsForSelectedDate.forEach(entry => {
      const timeOfDay = getTimeOfDay(entry.time);
      groups[timeOfDay].push(entry);
    });

    return groups;
  };

  const getTakenCount = () => {
    return medicationsForSelectedDate.filter(entry => entry.status === 'taken').length;
  };

  const getTotalCount = () => {
    return medicationsForSelectedDate.length;
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

  const weekDays = getWeekDays();
  const isToday = (date) => format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
  const isSelected = (date) => format(date, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');

  if (!isAuthenticated) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-1 justify-center items-center px-5">
          <Text className="text-lg text-gray-600 text-center mb-4">
            Please create an account to access the calendar view
          </Text>
        </View>
        <CreateAccountPrompt
          visible={showCreateAccountPrompt}
          onClose={() => setShowCreateAccountPrompt(false)}
          message="Create an account to access the calendar view and track your medication schedule."
        />
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#90CDF4" />
          <Text className="mt-4 text-gray-600">Loading medications...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const medicationGroups = groupMedicationsByTimeOfDay();
  const takenCount = getTakenCount();
  const totalCount = getTotalCount();
  const progressPercentage = totalCount > 0 ? (takenCount / totalCount) * 100 : 0;

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="flex-row justify-between items-center px-5 pt-4 pb-3">
          <Text className="text-2xl font-bold text-gray-900">Schedule</Text>
          <TouchableOpacity 
            className="w-10 h-10 rounded-full justify-center items-center"
            style={{ backgroundColor: '#90CDF4' }}
            onPress={() => rootNavigation?.navigate('AddMedicine')}
          >
            <MaterialIcons name="add" size={24} color="white" />
          </TouchableOpacity>
        </View>

        {/* Date Selector */}
        <View className="px-5 pb-4">
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {weekDays.map((day, index) => {
              const dayName = format(day, 'EEE').toUpperCase();
              const dayNumber = format(day, 'd');
              const isDayToday = isToday(day);
              const isDaySelected = isSelected(day);
              const isSelectedDay = isDayToday || isDaySelected;

              return (
                <TouchableOpacity
                  key={index}
                  className="items-center mr-4 min-w-[60px]"
                  onPress={() => setSelectedDate(day)}
                  activeOpacity={0.7}
                >
                  <Text className="text-xs text-gray-600 mb-2">{dayName}</Text>
                  <View 
                    className={`rounded-lg justify-center items-center ${isSelectedDay ? '' : 'bg-transparent'}`}
                    style={{
                      backgroundColor: isSelectedDay ? '#90CDF4' : 'transparent',
                      width: isSelectedDay ? 50 : 40,
                      height: isSelectedDay ? 50 : 40,
                    }}
                  >
                    <Text 
                      className={`text-base font-medium ${isSelectedDay ? 'text-white font-semibold' : 'text-gray-600'}`}
                    >
                      {dayNumber}
                    </Text>
                  </View>
                  {isSelectedDay && (
                    <View className="w-1 h-1 rounded-full bg-white mt-1" />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Daily Progress Card */}
        <View className="mx-5 mb-5 bg-white rounded-xl p-4 border border-gray-200">
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-lg font-bold text-gray-900">Daily Progress</Text>
            <Text className="text-base font-semibold" style={{ color: '#90CDF4' }}>
              {takenCount} of {totalCount}
            </Text>
          </View>
          <Text className="text-sm text-gray-600 mb-3">You're doing great!</Text>
          <View className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <View 
              className="h-full rounded-full"
              style={{ 
                backgroundColor: '#90CDF4',
                width: `${progressPercentage}%`
              }}
            />
          </View>
        </View>

        {/* Medications by Time of Day */}
        {medicationGroups.morning.length > 0 && (
          <View className="px-5 mb-5">
            <View className="flex-row items-center mb-3">
              <MaterialIcons name="wb-sunny" size={20} color="#FF9800" />
              <Text className="text-lg font-bold text-gray-900 ml-2">Morning</Text>
            </View>
            {medicationGroups.morning.map((entry, index) => {
              const med = entry.medication;
              const status = entry.status;
              const isTaken = status === 'taken';
              const isUpcoming = entry.scheduledDateTime > new Date() && status === 'pending';

              return (
                <TouchableOpacity
                  key={`${med.id}-${entry.time}-${index}`}
                  className="bg-white rounded-xl p-4 mb-3 border border-gray-200 flex-row items-center"
                  onPress={() => rootNavigation?.navigate('MedicationDetail', { medicationId: med.id })}
                  activeOpacity={0.7}
                >
                  <View 
                    className="w-12 h-12 rounded-lg justify-center items-center mr-3"
                    style={{ backgroundColor: isTaken ? '#E8F5E9' : '#E0F2FE' }}
                  >
                    {isTaken ? (
                      <MaterialIcons name="check" size={24} color="#43A047" />
                    ) : (
                      getMedicationIcon(med.medication_type || 'tablet', 24)
                    )}
                  </View>
                  <View className="flex-1">
                    <Text className={`text-base font-semibold mb-1 ${isTaken ? 'text-gray-400' : 'text-gray-900'}`}>
                      {med.name}
                    </Text>
                    <Text className={`text-sm ${isTaken ? 'text-gray-400' : 'text-gray-600'}`}>
                      {med.dosage} • {formatTime(entry.time)}
                    </Text>
                  </View>
                  {isTaken ? (
                    <Text className="text-sm font-semibold" style={{ color: '#43A047' }}>TAKEN</Text>
                  ) : isUpcoming ? (
                    <Text className="text-sm font-semibold" style={{ color: '#90CDF4' }}>Upcoming</Text>
                  ) : (
                    <TouchableOpacity
                      className="px-4 py-2 rounded-lg"
                      style={{ backgroundColor: '#90CDF4' }}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleMarkTaken(med.id, entry.time);
                      }}
                    >
                      <Text className="text-sm font-semibold text-white">Mark Taken</Text>
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {medicationGroups.afternoon.length > 0 && (
          <View className="px-5 mb-5">
            <View className="flex-row items-center mb-3">
              <MaterialIcons name="wb-sunny" size={20} color="#FF9800" />
              <Text className="text-lg font-bold text-gray-900 ml-2">Afternoon</Text>
            </View>
            {medicationGroups.afternoon.map((entry, index) => {
              const med = entry.medication;
              const status = entry.status;
              const isTaken = status === 'taken';
              const isUpcoming = entry.scheduledDateTime > new Date() && status === 'pending';

              return (
                <TouchableOpacity
                  key={`${med.id}-${entry.time}-${index}`}
                  className="bg-white rounded-xl p-4 mb-3 border border-gray-200 flex-row items-center"
                  onPress={() => rootNavigation?.navigate('MedicationDetail', { medicationId: med.id })}
                  activeOpacity={0.7}
                >
                  <View 
                    className="w-12 h-12 rounded-lg justify-center items-center mr-3"
                    style={{ backgroundColor: isTaken ? '#E8F5E9' : '#E0F2FE' }}
                  >
                    {isTaken ? (
                      <MaterialIcons name="check" size={24} color="#43A047" />
                    ) : (
                      getMedicationIcon(med.medication_type || 'tablet', 24)
                    )}
                  </View>
                  <View className="flex-1">
                    <Text className={`text-base font-semibold mb-1 ${isTaken ? 'text-gray-400' : 'text-gray-900'}`}>
                      {med.name}
                    </Text>
                    <Text className={`text-sm ${isTaken ? 'text-gray-400' : 'text-gray-600'}`}>
                      {med.dosage} • {formatTime(entry.time)}
                    </Text>
                  </View>
                  {isTaken ? (
                    <Text className="text-sm font-semibold" style={{ color: '#43A047' }}>TAKEN</Text>
                  ) : isUpcoming ? (
                    <Text className="text-sm font-semibold" style={{ color: '#90CDF4' }}>Upcoming</Text>
                  ) : (
                    <TouchableOpacity
                      className="px-4 py-2 rounded-lg"
                      style={{ backgroundColor: '#90CDF4' }}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleMarkTaken(med.id, entry.time);
                      }}
                    >
                      <Text className="text-sm font-semibold text-white">Mark Taken</Text>
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {medicationGroups.evening.length > 0 && (
          <View className="px-5 mb-5">
            <View className="flex-row items-center mb-3">
              <MaterialIcons name="nightlight-round" size={20} color="#9C27B0" />
              <Text className="text-lg font-bold text-gray-900 ml-2">Evening</Text>
            </View>
            {medicationGroups.evening.map((entry, index) => {
              const med = entry.medication;
              const status = entry.status;
              const isTaken = status === 'taken';
              const isUpcoming = entry.scheduledDateTime > new Date() && status === 'pending';

              return (
                <TouchableOpacity
                  key={`${med.id}-${entry.time}-${index}`}
                  className="bg-white rounded-xl p-4 mb-3 border border-gray-200 flex-row items-center"
                  onPress={() => rootNavigation?.navigate('MedicationDetail', { medicationId: med.id })}
                  activeOpacity={0.7}
                >
                  <View 
                    className="w-12 h-12 rounded-lg justify-center items-center mr-3"
                    style={{ backgroundColor: isTaken ? '#E8F5E9' : '#E0F2FE' }}
                  >
                    {isTaken ? (
                      <MaterialIcons name="check" size={24} color="#43A047" />
                    ) : (
                      getMedicationIcon(med.medication_type || 'tablet', 24)
                    )}
                  </View>
                  <View className="flex-1">
                    <Text className={`text-base font-semibold mb-1 ${isTaken ? 'text-gray-400' : 'text-gray-900'}`}>
                      {med.name}
                    </Text>
                    <Text className={`text-sm ${isTaken ? 'text-gray-400' : 'text-gray-600'}`}>
                      {med.dosage} • {formatTime(entry.time)}
                    </Text>
                  </View>
                  {isTaken ? (
                    <Text className="text-sm font-semibold" style={{ color: '#43A047' }}>TAKEN</Text>
                  ) : isUpcoming ? (
                    <Text className="text-sm font-semibold" style={{ color: '#90CDF4' }}>Upcoming</Text>
                  ) : (
                    <TouchableOpacity
                      className="px-4 py-2 rounded-lg"
                      style={{ backgroundColor: '#90CDF4' }}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleMarkTaken(med.id, entry.time);
                      }}
                    >
                      <Text className="text-sm font-semibold text-white">Mark Taken</Text>
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {medicationsForSelectedDate.length === 0 && (
          <View className="px-5 py-10 items-center">
            <Text className="text-sm text-gray-400">No medications scheduled for this date</Text>
          </View>
        )}
      </ScrollView>

      <CreateAccountPrompt
        visible={showCreateAccountPrompt}
        onClose={() => setShowCreateAccountPrompt(false)}
        message="Create an account to access the calendar view and track your medication schedule."
      />
    </SafeAreaView>
  );
};

export default CalendarScreen;

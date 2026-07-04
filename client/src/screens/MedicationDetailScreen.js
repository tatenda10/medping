import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { clerkAxios } from '../utils/clerkAxios';
import { format, differenceInSeconds, addDays, startOfDay, isSameDay, parseISO, addHours } from 'date-fns';
import databaseService from '../services/databaseService';
import syncService from '../services/syncService';
import { useAuth } from '../context/AuthContext';
import { getMedicationIcon } from '../utils/medicationIcons';

const MedicationDetailScreen = ({ route, navigation }) => {
  const { userId, isAuthenticated } = useAuth();
  const { medicationId, isCareRecipient, careRecipientId } = route.params || {};
  const [medication, setMedication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [doseLogs, setDoseLogs] = useState([]);
  const [nextDose, setNextDose] = useState(null);
  const [countdown, setCountdown] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [upcomingDoses, setUpcomingDoses] = useState([]);
  const [recentHistory, setRecentHistory] = useState([]);
  const countdownIntervalRef = useRef(null);

  useEffect(() => {
    loadMedicationDetails();
  }, [medicationId]);

  useEffect(() => {
    if (medication) {
      loadDoseLogs();
      calculateNextDose();
      calculateUpcomingDoses();
      loadRecentHistory();
    }
  }, [medication, doseLogs]);

  useEffect(() => {
    if (nextDose) {
      updateCountdown();
      countdownIntervalRef.current = setInterval(updateCountdown, 1000);
    }
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [nextDose]);

  const loadMedicationDetails = async () => {
    try {
      setLoading(true);
      const currentUserId = userId || 'guest';
      
      // Load from local database first
      const localMed = await databaseService.getMedicationById(medicationId);
      if (localMed) {
        setMedication(localMed);
        setLoading(false);
      }

      // Try to fetch from server (if online and authenticated)
      const online = await syncService.isOnline();
      if (online && isAuthenticated) {
        try {
          const response = await clerkAxios.get(`/medications/${medicationId}`);
          if (response.data.success) {
            const serverMed = response.data.medication;
            setMedication(serverMed);
            // Update local database
            if (Platform.OS !== 'web') {
              await databaseService.saveMedication({ ...serverMed, user_id: currentUserId }, false);
            }
          }
        } catch (error) {
          console.log('Using local data - offline or server error');
        }
      }
    } catch (error) {
      console.error('Error loading medication details:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDoseLogs = async () => {
    try {
      const currentUserId = userId || 'guest';
      const targetUserId = (isCareRecipient && careRecipientId) ? careRecipientId : currentUserId;
      
      if (!medication) return;
      
      const logs = await databaseService.getDoseLogs(targetUserId, medication.id);
      setDoseLogs(logs);
    } catch (error) {
      console.error('Error loading dose logs:', error);
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

  const calculateNextDose = async () => {
    if (!medication) return;
    
    try {
    const now = new Date();
      const times = parseTimes(medication.times_of_day);
      if (!times || times.length === 0) return;

      const upcomingDoses = [];
      
      // Look ahead 7 days
      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const checkDate = new Date(now);
        checkDate.setDate(now.getDate() + dayOffset);
        checkDate.setHours(0, 0, 0, 0);
        
        const dateLogs = doseLogs.filter(log => {
          const logDate = new Date(log.scheduled_time);
          return isSameDay(logDate, checkDate);
        });

      for (const time of times) {
        const [hours, minutes] = time.split(':').map(Number);
          const scheduledDateTime = new Date(checkDate);
        scheduledDateTime.setHours(hours, minutes, 0, 0);
        
          // Check if already taken
          const isTaken = dateLogs.some(log => {
          const logDate = new Date(log.scheduled_time);
            return logDate.getHours() === hours && logDate.getMinutes() === minutes && log.status === 'taken';
          });

          if (!isTaken && scheduledDateTime > now) {
            upcomingDoses.push({
              scheduledTime: scheduledDateTime,
              time: time,
            });
          }
        }
      }

      // Sort and get the next one
      upcomingDoses.sort((a, b) => a.scheduledTime - b.scheduledTime);
      setNextDose(upcomingDoses.length > 0 ? { ...upcomingDoses[0], medication } : null);
        } catch (error) {
      console.error('Error calculating next dose:', error);
    }
  };

  const updateCountdown = () => {
    if (!nextDose) {
      setCountdown({ hours: 0, minutes: 0, seconds: 0 });
        return;
      }
      
    const now = new Date();
    const diff = differenceInSeconds(nextDose.scheduledTime, now);

    if (diff <= 0) {
      setCountdown({ hours: 0, minutes: 0, seconds: 0 });
      calculateNextDose();
        return;
      }
      
    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    const seconds = diff % 60;

    setCountdown({ hours, minutes, seconds });
  };

  const calculateUpcomingDoses = () => {
    if (!medication) return;
    
    try {
      const now = new Date();
      const times = parseTimes(medication.times_of_day);
      if (!times || times.length === 0) return;

      const upcoming = [];
      const next24Hours = addHours(now, 24);

      // Check today and tomorrow
      for (let dayOffset = 0; dayOffset < 2; dayOffset++) {
        const checkDate = new Date(now);
        checkDate.setDate(now.getDate() + dayOffset);
        checkDate.setHours(0, 0, 0, 0);

        for (const time of times) {
          const [hours, minutes] = time.split(':').map(Number);
          const scheduledDateTime = new Date(checkDate);
      scheduledDateTime.setHours(hours, minutes, 0, 0);
      
          if (scheduledDateTime > now && scheduledDateTime <= next24Hours) {
            const isTaken = doseLogs.some(log => {
        const logDate = new Date(log.scheduled_time);
              return isSameDay(logDate, checkDate) && 
                     logDate.getHours() === hours && 
                     logDate.getMinutes() === minutes && 
                     log.status === 'taken';
            });

            if (!isTaken) {
              upcoming.push({
                scheduledTime: scheduledDateTime,
                time: time,
                isToday: isSameDay(checkDate, now),
              });
            }
          }
        }
      }

      upcoming.sort((a, b) => a.scheduledTime - b.scheduledTime);
      setUpcomingDoses(upcoming.slice(0, 2)); // Get first 2
        } catch (error) {
      console.error('Error calculating upcoming doses:', error);
    }
  };

  const loadRecentHistory = () => {
    if (!medication) return;
    
    try {
      // Include both taken and missed doses
      const sortedLogs = [...doseLogs]
        .filter(log => log.medication_id === medication.id && (log.status === 'taken' || log.status === 'missed'))
        .sort((a, b) => new Date(b.scheduled_time) - new Date(a.scheduled_time))
        .slice(0, 5); // Get last 5

      setRecentHistory(sortedLogs);
    } catch (error) {
      console.error('Error loading recent history:', error);
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

  const handleLogDoseNow = () => {
    navigation.navigate('MedicationReminder', {
      medicationId: medication.id,
      medicationName: medication.name,
      dosage: medication.dosage,
      time: nextDose ? format(nextDose.scheduledTime, 'HH:mm') : format(new Date(), 'HH:mm'),
      date: nextDose ? format(nextDose.scheduledTime, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
    });
  };

  const handleEditMed = () => {
    navigation.navigate('EditMedicine', {
      medicationId: medication.id,
      medication: medication,
    });
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white justify-center items-center">
        <ActivityIndicator size="large" color="#90CDF4" />
        <Text className="mt-4 text-gray-600">Loading medication details...</Text>
      </SafeAreaView>
    );
  }

  if (!medication) {
    return (
      <SafeAreaView className="flex-1 bg-white justify-center items-center">
        <Text className="text-gray-600">Medication not found</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} className="mt-4 px-6 py-3 bg-light-blue rounded-lg">
          <Text className="text-white font-semibold">Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const isActive = !medication.end_date || new Date(medication.end_date) > new Date();
  const foodInstructions = medication.food_instructions || 'No specific instructions';
  const frequency = medication.frequency === 'daily' ? 'Once daily' : 
                    medication.times_per_day ? `${medication.times_per_day} times daily` : 'As needed';
  const stockText = medication.quantity_remaining !== null 
    ? `${medication.quantity_remaining} Tablets left`
    : 'Not tracked';

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 pt-4 pb-3 border-b border-gray-200">
        <TouchableOpacity onPress={() => navigation.goBack()} className="w-10 h-10 rounded-full justify-center items-center">
          <Ionicons name="chevron-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-gray-900">Medication Details</Text>
        <View className="w-10 h-10" />
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Medication Information Card */}
        <View className="bg-white rounded-xl mx-5 mt-5 p-5 border border-gray-200">
          <View className="flex-row items-start mb-4">
            <View className="w-12 h-12 rounded-full bg-blue-100 justify-center items-center mr-4">
              {getMedicationIcon(medication.medication_type || 'tablet', 24, '#90CDF4')}
            </View>
            <View className="flex-1">
              <View className="flex-row items-center mb-2">
                <Text className="text-2xl font-bold text-gray-900 mr-2">{medication.name}</Text>
                {isActive && (
                  <View className="bg-green-500 px-2 py-1 rounded">
                    <Text className="text-white text-xs font-semibold">ACTIVE</Text>
                  </View>
                )}
              </View>
              <Text className="text-base text-gray-600">{medication.dosage}</Text>
            </View>
          </View>
          <View className="flex-row gap-3 mt-4">
            <TouchableOpacity
              className="flex-1 bg-light-blue py-3 rounded-xl flex-row items-center justify-center"
              onPress={handleLogDoseNow}
            >
              <MaterialIcons name="add" size={20} color="white" />
              <Text className="text-white font-semibold ml-2">Log Dose Now</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              className="flex-1 border border-gray-300 py-3 rounded-xl flex-row items-center justify-center"
              onPress={handleEditMed}
            >
              <MaterialIcons name="edit" size={20} color="#666" />
              <Text className="text-gray-700 font-semibold ml-2">Edit Med</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Next Scheduled Dose Card */}
        <View className="bg-white rounded-xl mx-5 mt-4 p-5 border border-gray-200">
          <Text className="text-xs text-light-blue font-semibold uppercase mb-3">Next Scheduled Dose</Text>
          {nextDose ? (
            <>
              <View className="flex-row items-baseline mb-3">
                <Text className="text-3xl font-bold text-gray-900">
                  {countdown.hours.toString().padStart(2, '0')}
              </Text>
                <Text className="text-lg text-light-blue font-semibold ml-1">HRS</Text>
                <Text className="text-3xl font-bold text-gray-900 ml-3">
                  {countdown.minutes.toString().padStart(2, '0')}
              </Text>
                <Text className="text-lg text-light-blue font-semibold ml-1">MINS</Text>
            </View>
              <View className="flex-row items-center">
                <MaterialIcons name="access-time" size={16} color="#666" />
                <Text className="text-sm text-gray-600 ml-2">
                  {format(nextDose.scheduledTime, 'h:mm a')}, {isSameDay(nextDose.scheduledTime, new Date()) ? 'Today' : format(nextDose.scheduledTime, 'MMM d')}
                </Text>
              </View>
            </>
          ) : (
            <Text className="text-gray-600">No upcoming doses scheduled</Text>
          )}
          </View>

        {/* Quick Information Section */}
        <View className="px-5 mt-6 mb-4">
          <Text className="text-xs text-gray-500 uppercase tracking-wide mb-4">Quick Information</Text>
          <View className="flex-row flex-wrap justify-between">
            {/* Intake */}
            <View className="w-[48%] bg-white rounded-xl p-4 mb-4 border border-gray-200">
              <MaterialIcons name="restaurant" size={24} color="#FF9800" />
              <Text className="text-xs text-gray-500 uppercase mt-2 mb-1">Intake</Text>
              <Text className="text-base font-semibold text-gray-900">{foodInstructions}</Text>
            </View>
            {/* Frequency */}
            <View className="w-[48%] bg-white rounded-xl p-4 mb-4 border border-gray-200">
              <MaterialIcons name="update" size={24} color="#90CDF4" />
              <Text className="text-xs text-gray-500 uppercase mt-2 mb-1">Frequency</Text>
              <Text className="text-base font-semibold text-gray-900">{frequency}</Text>
            </View>
            {/* Stock */}
            <View className="w-[48%] bg-white rounded-xl p-4 border border-gray-200">
              <MaterialIcons name="medication" size={24} color="#4CAF50" />
              <Text className="text-xs text-gray-500 uppercase mt-2 mb-1">Stock</Text>
              <Text className="text-base font-semibold text-gray-900">{stockText}</Text>
            </View>
          </View>
        </View>

        {/* Upcoming Doses (24H) Section */}
        <View className="px-5 mt-4 mb-4">
          <Text className="text-xs text-gray-500 uppercase tracking-wide mb-4">Upcoming Doses (24H)</Text>
          <View className="flex-row gap-3">
            {upcomingDoses.length > 0 ? (
              upcomingDoses.map((dose, index) => (
                <View 
                  key={index}
                  className={`flex-1 bg-gray-100 p-4 rounded-xl ${index === 0 ? 'border border-light-blue' : 'border border-gray-200'}`}
                >
                  <Text className={`text-xs font-semibold mb-2 ${index === 0 ? 'text-light-blue' : 'text-gray-500'}`}>
                    {index === 0 ? 'COMING UP' : 'SCHEDULED'}
                  </Text>
                  <Text className="text-lg font-bold text-gray-900 mb-2">
                    {isSameDay(dose.scheduledTime, new Date()) ? 'Tonight' : 'Tomorrow'} {format(dose.scheduledTime, 'h:mm a')}
                  </Text>
                  {index === 0 ? (
                    <View className="flex-row items-center">
                      <MaterialIcons name="notifications" size={14} color="#90CDF4" />
                      <Text className="text-xs text-light-blue ml-1">Reminder set</Text>
                    </View>
                  ) : (
                    <View className="flex-row items-center">
                      <MaterialIcons name="calendar-today" size={14} color="#999" />
                      <Text className="text-xs text-gray-500 ml-1">
                        In {Math.floor(differenceInSeconds(dose.scheduledTime, new Date()) / 3600)} hours
                      </Text>
                    </View>
                  )}
                </View>
              ))
            ) : (
              <View className="flex-1 bg-gray-100 p-4 rounded-xl border border-gray-200">
                <Text className="text-gray-500">No upcoming doses in the next 24 hours</Text>
              </View>
            )}
          </View>
        </View>

        {/* Recent History Section */}
        <View className="px-5 mt-4 mb-6">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-xs text-gray-500 uppercase tracking-wide">Recent History</Text>
            <TouchableOpacity>
              <Text className="text-sm text-light-blue font-semibold">View All</Text>
                </TouchableOpacity>
              </View>
          {recentHistory.length > 0 ? (
            recentHistory.map((log, index) => {
              const logDate = new Date(log.scheduled_time);
              const isToday = isSameDay(logDate, new Date());
              const isYesterday = isSameDay(logDate, addDays(new Date(), -1));
              const dateLabel = isToday ? 'Today' : isYesterday ? 'Yesterday' : format(logDate, 'MMM d');
              
              const takenTime = log.taken_time ? new Date(log.taken_time) : null;
              const scheduledTime = logDate;
              const timeDiff = takenTime ? Math.abs(differenceInSeconds(takenTime, scheduledTime)) : null;
              const isOnTime = timeDiff && timeDiff < 900; // Within 15 minutes
              
              let statusText = '';
              if (log.status === 'taken' && takenTime) {
                statusText = isOnTime ? 'On time' : `Scheduled for ${format(scheduledTime, 'h:mm a')}`;
              } else if (log.status === 'missed') {
                statusText = 'No dose recorded';
              }

              return (
                <View key={log.id || index} className="bg-white rounded-xl p-4 mb-3 border border-gray-200 flex-row items-center">
                  <View className={`w-10 h-10 rounded-full justify-center items-center mr-4 ${
                    log.status === 'taken' ? 'bg-green-100' : 'bg-red-100'
                  }`}>
                    {log.status === 'taken' ? (
                      <MaterialIcons name="check" size={20} color="#4CAF50" />
                    ) : (
                      <MaterialIcons name="close" size={20} color="#F44336" />
                    )}
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-gray-900">
                      {log.status === 'taken' ? `Taken at ${takenTime ? format(takenTime, 'h:mm a') : format(scheduledTime, 'h:mm a')}` : `Missed at ${format(scheduledTime, 'h:mm a')}`}
                    </Text>
                    <Text className="text-sm text-gray-500 mt-1">{statusText}</Text>
                  </View>
                  <Text className="text-sm text-gray-500">{dateLabel}</Text>
                </View>
              );
            })
          ) : (
            <View className="bg-white rounded-xl p-4 border border-gray-200">
              <Text className="text-gray-500 text-center">No recent history</Text>
            </View>
          )}
        </View>
      </ScrollView>
      
      {/* Bottom Navigation */}
      <View className="bg-white border-t border-gray-200">
        <View className="flex-row pt-3 pb-5 items-center justify-around" style={{ minHeight: 70 }}>
          <TouchableOpacity 
            className="flex-1 items-center justify-center"
            onPress={() => navigation.navigate('MainTabs', { screen: 'Dashboard' })}
          >
            <MaterialIcons name="home" size={22} color="#999" />
            <Text className="text-[10px] font-semibold uppercase mt-1" style={{ color: '#999' }}>HOME</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            className="flex-1 items-center justify-center"
            onPress={() => navigation.navigate('MainTabs', { screen: 'Calendar' })}
          >
            <Ionicons name="calendar-outline" size={22} color="#999" />
            <Text className="text-[10px] font-semibold uppercase mt-1" style={{ color: '#999' }}>CALENDAR</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            className="w-15 h-15 items-center justify-center mb-4"
            onPress={() => navigation.navigate('AddMedicine')}
            activeOpacity={0.7}
          >
            <View 
              className="w-14 h-14 rounded-full items-center justify-center"
              style={{ 
                backgroundColor: '#90CDF4',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.25,
                shadowRadius: 3.84,
                elevation: 5,
              }}
            >
              <MaterialIcons name="add" size={32} color="white" />
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity 
            className="flex-1 items-center justify-center"
            onPress={() => navigation.navigate('MainTabs', { screen: 'Metrics' })}
          >
            <MaterialIcons name="favorite" size={22} color="#999" />
            <Text className="text-[10px] font-semibold uppercase mt-1" style={{ color: '#999' }}>VITALS</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            className="flex-1 items-center justify-center"
            onPress={() => navigation.navigate('MainTabs', { screen: 'Settings' })}
          >
            <Ionicons name="settings-outline" size={22} color="#999" />
            <Text className="text-[10px] font-semibold uppercase mt-1" style={{ color: '#999' }}>SETTINGS</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default MedicationDetailScreen;

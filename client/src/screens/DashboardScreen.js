import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clerkAxios } from '../utils/clerkAxios';
import { format, addDays, startOfWeek, eachDayOfInterval, differenceInSeconds } from 'date-fns';
import databaseService from '../services/databaseService';
import syncService from '../services/syncService';
import { useAuth } from '../context/ClerkAuthContext';
import CreateAccountPrompt from '../components/CreateAccountPrompt';

const DashboardScreen = () => {
  const navigation = useNavigation();
  const { isAuthenticated, userId, user } = useAuth();
  const [showCreateAccountPrompt, setShowCreateAccountPrompt] = useState(false);
  const [promptMessage, setPromptMessage] = useState('');
  const [medications, setMedications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [userName, setUserName] = useState('User');
  const [nextDose, setNextDose] = useState(null);
  const [countdown, setCountdown] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [latestVitals, setLatestVitals] = useState({
    heartRate: null,
    bloodPressure: null,
    weight: null,
  });
  const [medicationsForToday, setMedicationsForToday] = useState([]);
  const [takenCount, setTakenCount] = useState(0);
  const countdownIntervalRef = useRef(null);

  // Helper to require auth for actions
  const requireAuth = (action, message) => {
    if (!isAuthenticated) {
      setPromptMessage(message);
      setShowCreateAccountPrompt(true);
    } else {
      action();
    }
  };

  useEffect(() => {
    loadUserData();
    loadMedications();
    loadVitals();
  }, []);

  useEffect(() => {
    calculateNextDose();
    calculateMedicationsForToday();
  }, [medications, selectedDate]);

  useEffect(() => {
    // Start countdown timer
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

  const loadUserData = async () => {
    try {
      // Try to get user name from Clerk user object
      if (user) {
        setUserName(user.firstName || user.emailAddresses?.[0]?.emailAddress?.split('@')[0] || 'User');
      } else {
        // Fallback to AsyncStorage for guest mode
        const userData = await AsyncStorage.getItem('userData');
        if (userData) {
          const parsedUser = JSON.parse(userData);
          setUserName(parsedUser.name || parsedUser.email?.split('@')[0] || 'User');
        }
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const loadMedications = async () => {
    try {
      // Use Clerk userId if authenticated, otherwise use 'guest'
      const currentUserId = userId || 'guest';

      // Load from local database first
      const localMedications = await databaseService.getMedications(currentUserId);
      setMedications(localMedications);
      setLoading(false);

      // Try to sync and fetch latest from server (if online)
      const online = await syncService.isOnline();
      if (online && isAuthenticated) {
        try {
          const response = await clerkAxios.get('/medications');

          if (response.data.success) {
            const serverMedications = response.data.medications || [];
            
            // Update local database with server data
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
          }
        } catch (error) {
          console.log('Using local data - offline or server error:', error.message);
        }
      }
    } catch (error) {
      console.error('Error loading medications:', error);
      setLoading(false);
    }
  };

  const loadVitals = async () => {
    try {
      // Use Clerk userId if authenticated, otherwise use 'guest'
      const currentUserId = userId || 'guest';

      const vitalsLogs = await databaseService.getVitalsLogs(currentUserId);
      
      if (vitalsLogs && vitalsLogs.length > 0) {
        const latest = vitalsLogs[0]; // Most recent
        setLatestVitals({
          heartRate: latest.heart_rate,
          bloodPressure: latest.blood_pressure_systolic && latest.blood_pressure_diastolic 
            ? `${latest.blood_pressure_systolic}/${latest.blood_pressure_diastolic}`
            : null,
          weight: latest.weight,
        });
      }

      // Try to sync from server if online
      if (isAuthenticated) {
        const online = await syncService.isOnline();
        if (online) {
          try {
            const response = await clerkAxios.get('/vitals');

            if (response.data.success && response.data.vitals && response.data.vitals.length > 0) {
              const latest = response.data.vitals[0];
              setLatestVitals({
                heartRate: latest.heart_rate,
                bloodPressure: latest.blood_pressure_systolic && latest.blood_pressure_diastolic 
                  ? `${latest.blood_pressure_systolic}/${latest.blood_pressure_diastolic}`
                  : null,
                weight: latest.weight,
              });
            }
          } catch (error) {
            console.log('Using local vitals data');
          }
        }
      }
    } catch (error) {
      console.error('Error loading vitals:', error);
    }
  };

  const calculateNextDose = async () => {
    try {
      const userData = await AsyncStorage.getItem('userData');
      const user = userData ? JSON.parse(userData) : null;
      const userId = user?.id || user?.user?.id || 'guest';

      const now = new Date();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Look ahead 7 days to find the next dose
      const upcomingDoses = [];
      
      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const checkDate = new Date(today);
        checkDate.setDate(today.getDate() + dayOffset);
        const checkDateStr = format(checkDate, 'yyyy-MM-dd');
        
        // Get all medications scheduled for this date
        const dateMedications = medications.filter(med => {
          if (!med.start_date) return false;
          const startDate = new Date(med.start_date);
          const startDateStr = format(startDate, 'yyyy-MM-dd');
          if (checkDateStr < startDateStr) return false;
          if (!med.is_continuous && med.end_date) {
            const endDate = new Date(med.end_date);
            const endDateStr = format(endDate, 'yyyy-MM-dd');
            if (checkDateStr > endDateStr) return false;
          }
          return med.times_of_day && (Array.isArray(med.times_of_day) ? med.times_of_day.length > 0 : true);
        });

        for (const med of dateMedications) {
          let times = med.times_of_day;
          if (typeof times === 'string') {
            try {
              times = JSON.parse(times);
            } catch (e) {
              continue;
            }
          }
          if (!Array.isArray(times)) continue;

          // Get dose logs to check which doses are already taken
          const doseLogs = await databaseService.getDoseLogs(userId, med.id);
          const dateLogs = doseLogs.filter(log => {
            const logDate = new Date(log.scheduled_time);
            return format(logDate, 'yyyy-MM-dd') === checkDateStr;
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

            // Only add if it's in the future and not taken
            if (!isTaken && scheduledDateTime > now) {
              upcomingDoses.push({
                medication: med,
                scheduledTime: scheduledDateTime,
                time: time,
              });
            }
          }
        }
        
        // If we found doses for this day, we can stop looking ahead
        if (upcomingDoses.length > 0 && dayOffset > 0) {
          break;
        }
      }

      // Sort by scheduled time and get the next one
      upcomingDoses.sort((a, b) => a.scheduledTime - b.scheduledTime);
      setNextDose(upcomingDoses.length > 0 ? upcomingDoses[0] : null);
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
      calculateNextDose(); // Recalculate for next dose
      return;
    }

    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    const seconds = diff % 60;

    setCountdown({ hours, minutes, seconds });
  };

  const calculateMedicationsForToday = async () => {
    try {
      const userData = await AsyncStorage.getItem('userData');
      const user = userData ? JSON.parse(userData) : null;
      const userId = user?.id || user?.user?.id || 'guest';

      const today = new Date();
      const todayStr = format(today, 'yyyy-MM-dd');

      const todayMeds = [];
      let taken = 0;

      for (const med of medications) {
        if (!med.start_date) continue;
        const startDate = new Date(med.start_date);
        const startDateStr = format(startDate, 'yyyy-MM-dd');
        if (todayStr < startDateStr) continue;
        if (!med.is_continuous && med.end_date) {
          const endDate = new Date(med.end_date);
          const endDateStr = format(endDate, 'yyyy-MM-dd');
          if (todayStr > endDateStr) continue;
        }

        let times = med.times_of_day;
        if (typeof times === 'string') {
          try {
            times = JSON.parse(times);
          } catch (e) {
            continue;
          }
        }
        if (!Array.isArray(times) || times.length === 0) continue;

        const doseLogs = await databaseService.getDoseLogs(userId, med.id);
        const todayLogs = doseLogs.filter(log => {
          const logDate = new Date(log.scheduled_time);
          return format(logDate, 'yyyy-MM-dd') === todayStr;
        });

        for (const time of times) {
          const [hours, minutes] = time.split(':').map(Number);
          const scheduledDateTime = new Date(today);
          scheduledDateTime.setHours(hours, minutes, 0, 0);

          const matchingLog = todayLogs.find(log => {
            const logDate = new Date(log.scheduled_time);
            return logDate.getHours() === hours && logDate.getMinutes() === minutes;
          });

          const status = matchingLog ? matchingLog.status : (scheduledDateTime < new Date() ? 'missed' : 'pending');
          if (status === 'taken') taken++;

          todayMeds.push({
            medication: med,
            time: time,
            status: status,
            scheduledDateTime: scheduledDateTime,
          });
        }
      }

      // Sort by time
      todayMeds.sort((a, b) => a.scheduledDateTime - b.scheduledDateTime);
      setMedicationsForToday(todayMeds);
      setTakenCount(taken);
    } catch (error) {
      console.error('Error calculating medications for today:', error);
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

  const handleLogDose = () => {
    if (!nextDose) return;
    requireAuth(
      () => navigation.navigate('MedicationDetail', { medicationId: nextDose.medication.id }),
      'Create an account to log medication doses.'
    );
  };

  const handleLogVitals = () => {
    requireAuth(
      () => navigation.navigate('VitalsTracking'),
      'Create an account to track your vitals.'
    );
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

  // Refresh when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadMedications();
      loadVitals();
    }, [])
  );

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header with User Profile */}
        <View className="flex-row justify-between items-center px-5 pt-3 pb-4">
          <View className="flex-row items-center flex-1">
            <View className="mr-3">
              <MaterialIcons name="account-circle" size={48} color="#90CDF4" />
            </View>
            <View className="flex-1">
              <Text className="text-lg font-bold text-gray-800 mb-0.5">Hello, {userName}</Text>
              <Text className="text-sm text-gray-500">Stay on track today</Text>
            </View>
          </View>
          <TouchableOpacity 
            className="p-2"
            onPress={() => navigation.openDrawer()}
          >
            <MaterialIcons name="menu" size={32} color="#666" />
          </TouchableOpacity>
        </View>

        {/* Date Selector */}
        <View className="py-4 border-b border-gray-200">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-5">
            {weekDays.map((day, index) => {
              const dayName = format(day, 'EEE').toUpperCase();
              const dayNumber = format(day, 'd');
              const isDayToday = isToday(day);
              const isDaySelected = isSelected(day);
              const isSelectedDay = isDayToday || isDaySelected;

              return (
                <TouchableOpacity
                  key={index}
                  className="items-center mr-5 min-w-[50px]"
                  onPress={() => setSelectedDate(day)}
                  activeOpacity={0.7}
                >
                  <Text className={`text-xs font-medium mb-2 ${isSelectedDay ? 'font-semibold' : 'text-gray-600'}`} style={{ color: isSelectedDay ? '#90CDF4' : undefined }}>
                    {dayName}
                  </Text>
                  <View className={`w-10 h-10 rounded-full justify-center items-center ${isSelectedDay ? '' : 'bg-transparent'}`} style={{ backgroundColor: isSelectedDay ? '#90CDF4' : undefined }}>
                    <Text className={`text-base font-medium ${isSelectedDay ? 'text-white font-semibold' : 'text-gray-600'}`}>
                      {dayNumber}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* NEXT DOSE Card - Light Blue Background */}
        {nextDose && (
          <View 
            className="mx-5 mt-5 mb-5 rounded-2xl p-5 relative overflow-hidden"
            style={{ backgroundColor: '#90CDF4' }}
          >
            <View className="absolute top-3 right-3 opacity-30">
              <MaterialIcons name="medication" size={80} color="white" />
            </View>
            <Text className="text-xs text-white font-medium mb-2">NEXT DOSE</Text>
            <Text className="text-2xl font-bold text-white mb-5">
              {nextDose.medication.name} ({nextDose.medication.dosage})
            </Text>
            <View className="flex-row justify-between mb-5 gap-2.5">
              <View className="flex-1 bg-white/20 rounded-lg py-3 px-2 items-center">
                <Text className="text-xl font-bold text-white mb-1">{String(countdown.hours).padStart(2, '0')}</Text>
                <Text className="text-[10px] text-white/90 font-medium">HRS</Text>
              </View>
              <View className="flex-1 bg-white/20 rounded-lg py-3 px-2 items-center">
                <Text className="text-xl font-bold text-white mb-1">{String(countdown.minutes).padStart(2, '0')}</Text>
                <Text className="text-[10px] text-white/90 font-medium">MINS</Text>
              </View>
              <View className="flex-1 bg-white/20 rounded-lg py-3 px-2 items-center">
                <Text className="text-xl font-bold text-white mb-1">{String(countdown.seconds).padStart(2, '0')}</Text>
                <Text className="text-[10px] text-white/90 font-medium">SECS</Text>
              </View>
            </View>
            <TouchableOpacity 
              className="bg-white rounded-lg py-3 items-center"
              onPress={handleLogDose}
            >
              <Text className="text-base font-semibold" style={{ color: '#90CDF4' }}>Log Dose Now</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Track Vitals Section */}
        <View className="px-5 mb-6">
          <View className="flex-row items-center mb-4">
            <MaterialIcons name="bar-chart" size={20} color="#666" />
            <Text className="text-lg font-bold text-gray-800 ml-2">Track Vitals</Text>
          </View>
          <View className="flex-row flex-wrap justify-between">
            <TouchableOpacity 
              className="w-[48%] bg-white rounded-xl p-4 mb-3 items-center border border-gray-200"
              onPress={() => requireAuth(() => navigation.navigate('VitalsTracking'), 'Create an account to track vitals.')}
            >
              <MaterialIcons name="favorite" size={32} color="#E53935" />
              <Text className="text-xs text-gray-600 mt-2 mb-1">Heart Rate</Text>
              <Text className="text-xl font-bold text-gray-800">
                {latestVitals.heartRate ? `${latestVitals.heartRate} bpm` : '--'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              className="w-[48%] bg-white rounded-xl p-4 mb-3 items-center border border-gray-200"
              onPress={() => requireAuth(() => navigation.navigate('VitalsTracking'), 'Create an account to track vitals.')}
            >
              <MaterialIcons name="healing" size={32} color="#90CDF4" />
              <Text className="text-xs text-gray-600 mt-2 mb-1">Blood Pressure</Text>
              <Text className="text-xl font-bold text-gray-800">
                {latestVitals.bloodPressure || '--'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              className="w-[48%] bg-white rounded-xl p-4 mb-3 items-center border border-gray-200"
              onPress={() => requireAuth(() => navigation.navigate('VitalsTracking'), 'Create an account to track vitals.')}
            >
              <MaterialIcons name="scale" size={32} color="#FF9800" />
              <Text className="text-xs text-gray-600 mt-2 mb-1">Weight</Text>
              <Text className="text-xl font-bold text-gray-800">
                {latestVitals.weight ? `${latestVitals.weight} lbs` : '--'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              className="w-[48%] bg-gray-50 rounded-xl p-4 mb-3 items-center border-2 border-dashed"
              style={{ borderColor: '#90CDF4' }}
              onPress={handleLogVitals}
            >
              <MaterialIcons name="add-circle" size={40} color="#90CDF4" />
              <Text className="text-xs font-semibold mt-2" style={{ color: '#90CDF4' }}>LOG NEW</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Medications Section */}
        <View className="px-5 mb-6">
          <View className="flex-row items-center mb-4">
            <View className="flex-row items-center">
              <MaterialIcons name="check-circle" size={18} color="#666" />
              <MaterialIcons name="check-circle" size={18} color="#666" style={{ marginLeft: -8 }} />
            </View>
            <Text className="text-lg font-bold text-gray-800 ml-2">Medications</Text>
            {medicationsForToday.length > 0 && (
              <Text className="text-sm text-gray-600 ml-auto">
                {takenCount} of {medicationsForToday.length} Taken
              </Text>
            )}
          </View>
          {medicationsForToday.length > 0 ? (
            <View className="gap-3">
              {medicationsForToday.map((entry, index) => {
                const med = entry.medication;
                const status = entry.status;
                const isTaken = status === 'taken';
                const isPending = status === 'pending';
                const isMissed = status === 'missed';

                // Determine icon and color based on status and time
                let iconName = 'schedule';
                let iconColor = '#90CDF4';
                let bgColor = '#E0F2FE';
                if (isTaken) {
                  iconName = 'check-circle';
                  iconColor = '#43A047';
                  bgColor = '#E8F5E9';
                } else if (isMissed) {
                  iconName = 'error';
                  iconColor = '#E53935';
                  bgColor = '#FFEBEE';
                } else if (parseInt(entry.time.split(':')[0]) >= 20) {
                  iconName = 'nightlight';
                  iconColor = '#999';
                  bgColor = '#F5F5F5';
                }

                return (
                  <TouchableOpacity
                    key={`${med.id}-${entry.time}-${index}`}
                    className="flex-row items-center bg-white rounded-xl p-4 border border-gray-200"
                    onPress={() => requireAuth(
                      () => navigation.navigate('MedicationDetail', { medicationId: med.id }),
                      'Create an account to view medication details.'
                    )}
                    activeOpacity={0.7}
                  >
                    <View className="w-12 h-12 rounded-full justify-center items-center mr-3" style={{ backgroundColor: bgColor }}>
                      <MaterialIcons name={iconName} size={24} color={iconColor} />
                    </View>
                    <View className="flex-1">
                      <Text className={`text-base font-semibold mb-1 ${isTaken ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                        {med.name}
                      </Text>
                      <Text className={`text-sm mb-0.5 ${isTaken ? 'text-gray-400' : 'text-gray-600'}`}>
                        {med.dosage}
                      </Text>
                      <Text className={`text-xs ${isTaken ? 'text-gray-400' : 'text-gray-500'}`}>
                        {formatTime(entry.time)}
                      </Text>
                    </View>
                    {!isTaken && (
                      <TouchableOpacity 
                        className="p-1"
                        onPress={() => requireAuth(
                          () => navigation.navigate('MedicationDetail', { medicationId: med.id }),
                          'Create an account to log doses.'
                        )}
                      >
                        <MaterialIcons 
                          name={isPending ? "check-box-outline-blank" : "check-box"} 
                          size={24} 
                          color={isPending ? "#90CDF4" : "#999"} 
                        />
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View className="py-10 items-center">
              <Text className="text-sm text-gray-400">No medications scheduled for today</Text>
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

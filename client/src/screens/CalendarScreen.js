import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { useFocusEffect } from '@react-navigation/native';
import axios from 'axios';
import BASE_URL from '../context/Api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format, parseISO, isPast, isToday } from 'date-fns';
import AppHeader from '../components/AppHeader';
import databaseService from '../services/databaseService';
import syncService from '../services/syncService';
import { getMedicationIcon } from '../utils/medicationIcons';
import { useAuthCheck } from '../hooks/useAuthCheck';
import CreateAccountPrompt from '../components/CreateAccountPrompt';

const CalendarScreen = ({ navigation }) => {
  const { isAuthenticated } = useAuthCheck();
  const [showCreateAccountPrompt, setShowCreateAccountPrompt] = useState(false);
  const [medications, setMedications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [medicationsForSelectedDate, setMedicationsForSelectedDate] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [appointmentsForSelectedDate, setAppointmentsForSelectedDate] = useState([]);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [userId, setUserId] = useState(null);
  const [calendarView, setCalendarView] = useState('month'); // 'month' or 'week'

  useEffect(() => {
    if (!isAuthenticated) {
      setShowCreateAccountPrompt(true);
    } else {
      loadMedications();
      loadAppointments();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadMedications();
    loadAppointments();
  }, []);

  useEffect(() => {
    if (medications.length > 0) {
      updateMedicationsForDate();
    }
    if (appointments.length > 0) {
      updateAppointmentsForDate();
    }
  }, [selectedDate, medications, appointments]);

  // Refresh when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      // Reload medications and appointments when screen is focused
      loadMedications();
      loadAppointments();
    }, [])
  );

  const loadMedications = async () => {
    try {
      const userData = await AsyncStorage.getItem('userData');
      const user = userData ? JSON.parse(userData) : null;
      const currentUserId = user?.id || user?.user?.id;

      if (!currentUserId) {
        setLoading(false);
        return;
      }

      // Cache userId to avoid repeated AsyncStorage calls
      setUserId(currentUserId);

      // Load from local database first (offline-first)
      const localMedications = await databaseService.getMedications(currentUserId);
      setMedications(localMedications);
      setLoading(false);

      // Try to sync and fetch latest from server (if online)
      const online = await syncService.isOnline();
      if (online) {
        try {
          const token = await AsyncStorage.getItem('authToken');
          const response = await axios.get(`${BASE_URL}/medications`, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });

          if (response.data.success) {
            const serverMedications = response.data.medications || [];
            
            // Update local database with server data
            for (const serverMed of serverMedications) {
              try {
                const medToSave = {
                  ...serverMed,
                  user_id: currentUserId,
                };
                await databaseService.saveMedication(medToSave, false);
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
          console.log('Using local data - offline or server error');
        }
      }
    } catch (error) {
      console.error('Error loading medications:', error);
      setLoading(false);
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

  const getMedicationStatus = (med, time, selectedDate, allDoseLogs) => {
    try {
      if (!allDoseLogs || allDoseLogs.length === 0) {
        // If no logs, check if time has passed (for today only)
        const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
        const now = new Date();
        const todayStr = format(now, 'yyyy-MM-dd');
        const isToday = selectedDateStr === todayStr;
        
        if (isToday) {
          const [hours, minutes] = time.split(':').map(Number);
          const scheduledDateTime = new Date(selectedDate);
          scheduledDateTime.setHours(hours, minutes, 0, 0);
          
          if (scheduledDateTime < now) {
            return 'missed';
          }
        }
        
        return 'pending';
      }
      
      // Find dose log for this specific time and date
      const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
      const [hours, minutes] = time.split(':').map(Number);
      
      const matchingLog = allDoseLogs.find(log => {
        if (log.medication_id !== med.id) return false;
        
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
      
      // If no log found, check if time has passed (for today only)
      const now = new Date();
      const todayStr = format(now, 'yyyy-MM-dd');
      const isToday = selectedDateStr === todayStr;
      
      if (isToday) {
        const scheduledDateTime = new Date(selectedDate);
        scheduledDateTime.setHours(hours, minutes, 0, 0);
        
        if (scheduledDateTime < now) {
          // Time has passed and no log - likely missed
          return 'missed';
        }
      }
      
      return 'pending';
    } catch (error) {
      console.error('Error getting medication status:', error);
      return 'pending';
    }
  };

  const loadAppointments = async () => {
    try {
      const userData = await AsyncStorage.getItem('userData');
      const user = userData ? JSON.parse(userData) : null;
      const currentUserId = user?.id || user?.user?.id;

      if (!currentUserId) {
        return;
      }

      // Load from local database first (offline-first)
      const localAppointments = await databaseService.getAppointments(currentUserId);
      const sorted = localAppointments.sort((a, b) => 
        new Date(a.scheduled_time) - new Date(b.scheduled_time)
      );
      setAppointments(sorted);

      // Try to sync and fetch latest from server (if online)
      const online = await syncService.isOnline();
      if (online) {
        try {
          const token = await AsyncStorage.getItem('authToken');
          const response = await axios.get(`${BASE_URL}/appointments`, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });

          if (response.data.success && response.data.appointments) {
            const serverAppointments = response.data.appointments || [];
            
            // Update local database with server data
            for (const serverAppt of serverAppointments) {
              try {
                const apptToSave = {
                  ...serverAppt,
                  user_id: currentUserId,
                };
                await databaseService.saveAppointment(apptToSave);
              } catch (saveError) {
                console.error('Error saving appointment:', saveError);
              }
            }
            
            // Reload from local database
            const updatedAppointments = await databaseService.getAppointments(currentUserId);
            const sortedUpdated = updatedAppointments.sort((a, b) => 
              new Date(a.scheduled_time) - new Date(b.scheduled_time)
            );
            setAppointments(sortedUpdated);
          }
        } catch (error) {
          console.log('Using local appointments data - offline or server error');
        }
      }
    } catch (error) {
      console.error('Error loading appointments:', error);
    }
  };

  const updateAppointmentsForDate = () => {
    if (!appointments || appointments.length === 0) {
      setAppointmentsForSelectedDate([]);
      return;
    }

    const selectedDateStr = selectedDate;
    const filtered = appointments.filter(apt => {
      try {
        const aptDate = format(new Date(apt.scheduled_time), 'yyyy-MM-dd');
        return aptDate === selectedDateStr;
      } catch (e) {
        return false;
      }
    }).sort((a, b) => new Date(a.scheduled_time) - new Date(b.scheduled_time));

    setAppointmentsForSelectedDate(filtered);
  };

  // Get marked dates (days with medications and appointments)
  const getMarkedDates = () => {
    const marked = {};
    
    // Mark medication dates with red dots
    medications.forEach(med => {
      if (!med.times_of_day) return;
      
      // Parse times_of_day
      let times = med.times_of_day;
      if (typeof times === 'string') {
        try {
          times = JSON.parse(times);
        } catch (e) {
          return;
        }
      }
      
      if (!Array.isArray(times) || times.length === 0) return;
      
      // Get start and end dates
      const startDate = new Date(med.start_date);
      const endDate = med.is_continuous ? null : (med.end_date ? new Date(med.end_date) : null);
      
      // Mark dates from start to end (or 365 days ahead if continuous)
      const today = new Date();
      const maxDate = endDate || new Date(today.getTime() + 365 * 24 * 60 * 60 * 1000);
      
      let currentDate = new Date(startDate);
      
      while (currentDate <= maxDate) {
        const dateStr = format(currentDate, 'yyyy-MM-dd');
        
        if (!marked[dateStr]) {
          marked[dateStr] = {
            marked: true,
            dots: [],
          };
        }
        
        // Add medication dot (red)
        if (!marked[dateStr].dots) {
          marked[dateStr].dots = [];
        }
        marked[dateStr].dots.push({
          key: `med_${med.id}`,
          color: '#d32f2f', // Red for medications
          selectedDotColor: '#fff',
        });
        
        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
      }
    });

    // Mark appointment dates with colored dots (one dot per date)
    const appointmentDates = new Set();
    appointments.forEach(apt => {
      try {
        const aptDateStr = format(new Date(apt.scheduled_time), 'yyyy-MM-dd');
        appointmentDates.add(aptDateStr);
      } catch (e) {
        console.error('Error processing appointment date:', e);
      }
    });
    
    appointmentDates.forEach(aptDateStr => {
      try {
        const now = new Date();
        const aptDate = new Date(aptDateStr);
        const isPast = aptDate < now;
        const isToday = format(aptDate, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd');
        
        if (!marked[aptDateStr]) {
          marked[aptDateStr] = {
            marked: true,
            dots: [],
          };
        }
        
        if (!marked[aptDateStr].dots) {
          marked[aptDateStr].dots = [];
        }
        
        // Add appointment dot (blue for upcoming, orange for today, gray for past)
        let dotColor = '#1976d2'; // Blue for upcoming
        if (isToday) {
          dotColor = '#ff9800'; // Orange for today
        } else if (isPast) {
          dotColor = '#757575'; // Gray for past
        }
        
        // Check if appointment dot already exists (avoid duplicates)
        const hasAppointmentDot = marked[aptDateStr].dots.some(dot => dot.key && dot.key.startsWith('appt_'));
        if (!hasAppointmentDot) {
          marked[aptDateStr].dots.push({
            key: `appt_${aptDateStr}`,
            color: dotColor,
            selectedDotColor: '#fff',
          });
        }
      } catch (e) {
        console.error('Error marking appointment date:', e);
      }
    });
    
    // Mark selected date
    if (marked[selectedDate]) {
      marked[selectedDate] = {
        ...marked[selectedDate],
        selected: true,
        selectedColor: '#d32f2f',
      };
    } else {
      marked[selectedDate] = {
        selected: true,
        selectedColor: '#d32f2f',
      };
    }
    
    return marked;
  };

  const updateMedicationsForDate = async () => {
    if (!userId) return;
    
    setUpdatingStatus(true);
    
    try {
      const selectedDateStr = selectedDate;
      const selectedDateObj = new Date(selectedDateStr);
      
      // Fetch all dose logs once for the user (much faster than per-medication calls)
      const allDoseLogs = await databaseService.getDoseLogs(userId);
      
      // Filter medications for the selected date
      const filtered = medications
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
              times = [];
            }
          }
          
          // Ensure times is an array
          if (!Array.isArray(times)) {
            times = [];
          }
          
          // Create entries for each time with status calculated synchronously
          const medicationEntries = times.map(time => {
            const status = getMedicationStatus(med, time, selectedDateObj, allDoseLogs);
            return {
              medication: med,
              time: time,
              status: status,
            };
          });
          
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
      
      setMedicationsForSelectedDate(filtered);
    } catch (error) {
      console.error('Error updating medications for date:', error);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleDayPress = (day) => {
    setSelectedDate(day.dateString);
  };

  const markedDates = getMarkedDates();
  const isSelectedDateToday = selectedDate === format(new Date(), 'yyyy-MM-dd');
  const dateDisplayText = isSelectedDateToday 
    ? `Today, ${format(new Date(selectedDate), 'd MMM yyyy')}`
    : format(new Date(selectedDate), 'EEEE, d MMM yyyy');

  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <AppHeader navigation={navigation} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Text style={{ fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 20 }}>
            Create an account to access the calendar view and track your medication schedule.
          </Text>
        </View>
        <CreateAccountPrompt
          visible={showCreateAccountPrompt}
          onClose={() => {
            setShowCreateAccountPrompt(false);
            navigation.goBack();
          }}
          message="Create an account to access the calendar view and track your medication schedule."
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader navigation={navigation} />
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Calendar View Toggle */}
        <View style={styles.viewToggleContainer}>
          <TouchableOpacity
            style={[styles.viewToggleButton, calendarView === 'month' && styles.viewToggleActive]}
            onPress={() => setCalendarView('month')}
          >
            <Text style={[styles.viewToggleText, calendarView === 'month' && styles.viewToggleTextActive]}>
              Month
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewToggleButton, calendarView === 'week' && styles.viewToggleActive]}
            onPress={() => setCalendarView('week')}
          >
            <Text style={[styles.viewToggleText, calendarView === 'week' && styles.viewToggleTextActive]}>
              Week
            </Text>
          </TouchableOpacity>
        </View>

        {/* Calendar */}
        <View style={styles.calendarContainer}>
          <Calendar
            current={selectedDate}
            onDayPress={handleDayPress}
            markedDates={markedDates}
            theme={{
              todayTextColor: '#d32f2f',
              selectedDayBackgroundColor: '#d32f2f',
              selectedDayTextColor: '#fff',
              arrowColor: '#d32f2f',
              monthTextColor: '#333',
              textDayFontWeight: '500',
              textMonthFontWeight: 'bold',
              textDayHeaderFontWeight: '600',
            }}
            style={styles.calendar}
            hideExtraDays={calendarView === 'week'}
            firstDay={1}
            enableSwipeMonths={true}
          />
        </View>

        {/* Selected Date Header */}
        <View style={styles.header}>
          <Text style={styles.dateText}>{dateDisplayText}</Text>
        </View>

        {/* Medications for Selected Date */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Medications</Text>
          </View>

          {medicationsForSelectedDate.length > 0 ? (
            <View style={styles.medicationsList}>
              {medicationsForSelectedDate.map((entry, index) => {
                const med = entry.medication;
                const time = entry.time;
                const status = entry.status;

                // Get background color based on status
                const getStatusColor = () => {
                  switch (status) {
                    case 'taken':
                      return '#E8F5E9'; // Light green
                    case 'missed':
                      return '#FFEBEE'; // Light red
                    case 'skipped':
                      return '#FFF3E0'; // Light orange
                    case 'pending':
                    default:
                      return '#F5F5F5'; // Light gray
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

                return (
                  <TouchableOpacity
                    key={`${med.id}-${time}-${index}`}
                    style={[
                      styles.medicationCard,
                      { backgroundColor: getStatusColor() }
                    ]}
                    onPress={() => navigation.navigate('MedicationDetail', { medicationId: med.id })}
                    activeOpacity={0.7}
                  >
                    <View style={styles.medicationContent}>
                      <View style={styles.medicationRow}>
                        <View style={styles.medicationLeft}>
                          {getMedicationIcon(med.medication_type || 'tablet', 24)}
                        </View>
                        <View style={styles.medicationInfo}>
                          <Text style={styles.medicationName}>
                            {med.name} - {med.dosage}
                          </Text>
                          <Text style={styles.medicationTime}>
                            {formatTime(time)}
                          </Text>
                        </View>
                        <View style={styles.statusContainer}>
                          <Text style={styles.statusText}>{getStatusText()}</Text>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No medications scheduled for this date</Text>
            </View>
          )}
        </View>

        {/* Appointments for Selected Date */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Appointments</Text>
          </View>

          {appointmentsForSelectedDate.length > 0 ? (
            <View style={styles.medicationsList}>
              {appointmentsForSelectedDate.map((apt) => {
                const aptDate = new Date(apt.scheduled_time);
                const now = new Date();
                const isPast = aptDate < now;
                const isToday = format(aptDate, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd');
                
                // Get background color based on status
                const getAppointmentColor = () => {
                  if (isToday) {
                    return '#FFF3E0'; // Light orange for today
                  } else if (isPast) {
                    return '#F5F5F5'; // Light gray for past
                  } else {
                    return '#E3F2FD'; // Light blue for upcoming
                  }
                };

                return (
                  <TouchableOpacity
                    key={apt.id}
                    style={[
                      styles.medicationCard,
                      { backgroundColor: getAppointmentColor() }
                    ]}
                    activeOpacity={0.7}
                  >
                    <View style={styles.medicationContent}>
                      <View style={styles.medicationRow}>
                        <View style={styles.medicationLeft}>
                          <Text style={{ fontSize: 24 }}>📅</Text>
                        </View>
                        <View style={styles.medicationInfo}>
                          <Text style={styles.medicationName}>
                            {apt.title}
                          </Text>
                          {apt.doctor_name && (
                            <Text style={styles.medicationTime}>
                              Dr. {apt.doctor_name}
                            </Text>
                          )}
                          <Text style={styles.medicationTime}>
                            {formatTime(format(aptDate, 'HH:mm'))} {apt.location && `• ${apt.location}`}
                          </Text>
                          {isToday && (
                            <Text style={[styles.medicationTime, { color: '#ff9800', fontWeight: '600' }]}>
                              TODAY
                            </Text>
                          )}
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No appointments scheduled for this date</Text>
            </View>
          )}
        </View>
      </ScrollView>
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
  viewToggleContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
    gap: 10,
  },
  viewToggleButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  viewToggleActive: {
    backgroundColor: '#d32f2f',
    borderColor: '#d32f2f',
  },
  viewToggleText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  viewToggleTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  calendarContainer: {
    padding: 20,
    backgroundColor: '#fff',
  },
  calendar: {
    borderRadius: 10,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  dateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#555',
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  sectionHeader: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#555',
  },
  medicationsList: {
    marginTop: 10,
  },
  medicationCard: {
    backgroundColor: '#fff',
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
  },
  medicationContent: {
    flex: 1,
  },
  medicationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  medicationLeft: {
    marginRight: 12,
  },
  medicationInfo: {
    flex: 1,
  },
  medicationName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#555',
    marginBottom: 4,
  },
  medicationTime: {
    fontSize: 14,
    color: '#666',
  },
  statusContainer: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
  },
  emptyState: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
  },
});

export default CalendarScreen;

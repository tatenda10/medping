import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { format, isPast, isToday, isFuture, parseISO, differenceInDays, differenceInHours } from 'date-fns';
import DateTimePicker from '@react-native-community/datetimepicker';
import databaseService from '../services/databaseService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clerkAxios } from '../utils/clerkAxios';
import syncService from '../services/syncService';
import notificationService from '../services/notificationService';

const AppointmentsScreen = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState('upcoming'); // 'all', 'upcoming', 'today', 'past'
  const [title, setTitle] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [appointmentType, setAppointmentType] = useState('');
  const [scheduledTime, setScheduledTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [reminderMinutes, setReminderMinutes] = useState('60');
  const [enableReminder, setEnableReminder] = useState(true);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const scrollViewRef = useRef(null);

  const appointmentTypes = [
    'Checkup', 'Follow-up', 'Specialist', 'Lab Test', 'Surgery', 'Other'
  ];

  useEffect(() => {
    loadAppointments();
  }, []);

  useEffect(() => {
    if (activeTab !== 'form') {
      loadAppointments(); // Reload when switching tabs
    }
  }, [activeTab]);

  const loadAppointments = async () => {
    try {
      const userData = await AsyncStorage.getItem('userData');
      const user = userData ? JSON.parse(userData) : null;
      const userId = user?.id || user?.user?.id || 'guest';

      if (userId === 'guest') return;

      // Load from local database first (offline-first)
      const localAppointments = await databaseService.getAppointments(userId);
      
      // Sort by scheduled_time ascending (upcoming first)
      const sorted = localAppointments.sort((a, b) => 
        new Date(a.scheduled_time) - new Date(b.scheduled_time)
      );
      
      setAppointments(sorted);

      // Try to sync and fetch latest from server (if online)
      const online = await syncService.isOnline();
      if (online) {
        try {
          const response = await clerkAxios.get('/appointments');

          if (response.data.success && response.data.appointments) {
            const serverAppointments = response.data.appointments || [];
            
            // Update local database with server data
            for (const serverAppt of serverAppointments) {
              try {
                const apptToSave = {
                  ...serverAppt,
                  user_id: userId,
                };
                await databaseService.saveAppointment(apptToSave);
              } catch (saveError) {
                console.error('Error saving appointment:', saveError);
              }
            }
            
            // Reload from local database
            const updatedAppointments = await databaseService.getAppointments(userId);
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

  const handleSaveAppointment = async () => {
    if (!title || !scheduledTime) {
      Alert.alert('Error', 'Please enter title and scheduled time');
      return;
    }

    setLoading(true);
    try {
      const userData = await AsyncStorage.getItem('userData');
      const user = userData ? JSON.parse(userData) : null;
      const userId = user?.id || user?.user?.id || 'guest';

      if (userId === 'guest') {
        Alert.alert('Error', 'Please create an account to save appointments');
        return;
      }

      const appointmentData = {
        id: `appt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        user_id: userId,
        title: title.trim(),
        doctor_name: doctorName.trim() || null,
        appointment_type: appointmentType || null,
        scheduled_time: scheduledTime.toISOString(),
        location: location.trim() || null,
        notes: notes.trim() || null,
        reminder_minutes: reminderMinutes ? parseInt(reminderMinutes) : 60,
      };

      await databaseService.saveAppointment(appointmentData);

      // Schedule reminder if enabled
      if (enableReminder) {
        try {
          await notificationService.scheduleAppointmentReminder(appointmentData);
        } catch (error) {
          console.error('Error scheduling reminder:', error);
          // Don't block saving if reminder fails
        }
      }

      // Sync to server
      const online = await syncService.isOnline();
      if (online) {
        try {
          const response = await clerkAxios.post('/appointments', appointmentData);
          
          if (response.data.success && response.data.appointment) {
            // Update with server data
            const updatedAppointment = response.data.appointment;
            
            // Reschedule reminder with server data if needed
            if (enableReminder) {
              await notificationService.cancelAppointmentReminders(appointmentData.id);
              await notificationService.scheduleAppointmentReminder(updatedAppointment);
            }
          }
        } catch (error) {
          console.log('Saved locally, will sync later');
        }
      }

      // Clear form
      setTitle('');
      setDoctorName('');
      setAppointmentType('');
      setScheduledTime(new Date());
      setLocation('');
      setNotes('');
      setReminderMinutes('60');
      setEnableReminder(true);
      setShowForm(false);

      Alert.alert('Success', 'Appointment saved successfully');
      loadAppointments();
      setActiveTab('upcoming'); // Switch to upcoming tab
    } catch (error) {
      console.error('Error saving appointment:', error);
      Alert.alert('Error', 'Failed to save appointment');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAppointment = async (appointmentId) => {
    Alert.alert(
      'Delete Appointment',
      'Are you sure you want to delete this appointment?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Cancel reminders
              await notificationService.cancelAppointmentReminders(appointmentId);
              
              // Delete from local database
              await databaseService.deleteAppointment(appointmentId);
              
              // Delete from server if authenticated
              const online = await syncService.isOnline();
              if (online) {
                try {
                  await clerkAxios.delete(`/appointments/${appointmentId}`);
                } catch (error) {
                  console.log('Deleted locally, will sync later');
                }
              }

              loadAppointments();
              Alert.alert('Success', 'Appointment deleted');
            } catch (error) {
              console.error('Error deleting appointment:', error);
              Alert.alert('Error', 'Failed to delete appointment');
            }
          },
        },
      ]
    );
  };

  const getAppointmentStatus = (appointment) => {
    const apptDate = parseISO(appointment.scheduled_time);
    if (isPast(apptDate) && !isToday(apptDate)) return 'past';
    if (isToday(apptDate)) return 'today';
    if (isFuture(apptDate)) return 'upcoming';
    return 'upcoming';
  };

  const getFilteredAppointments = () => {
    if (activeTab === 'today') {
      return appointments.filter(apt => getAppointmentStatus(apt) === 'today');
    } else if (activeTab === 'upcoming') {
      return appointments.filter(apt => {
        const status = getAppointmentStatus(apt);
        return status === 'upcoming' || status === 'today';
      });
    } else if (activeTab === 'past') {
      return appointments.filter(apt => getAppointmentStatus(apt) === 'past');
    }
    return appointments;
  };

  const getTimeUntilAppointment = (appointment) => {
    const apptDate = parseISO(appointment.scheduled_time);
    const now = new Date();
    const diffHours = differenceInHours(apptDate, now);
    const diffDays = differenceInDays(apptDate, now);

    if (diffDays < 0) return null;
    if (diffDays === 0) {
      if (diffHours < 0) return null;
      if (diffHours === 0) return 'Happening now';
      return `In ${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
    }
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays < 7) return `In ${diffDays} days`;
    if (diffDays < 30) return `In ${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) !== 1 ? 's' : ''}`;
    return `In ${Math.floor(diffDays / 30)} month${Math.floor(diffDays / 30) !== 1 ? 's' : ''}`;
  };

  const filteredAppointments = getFilteredAppointments();
  const canContinue = title && scheduledTime;

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="bg-primary rounded-t-[20px] px-6 py-6 flex-row justify-between items-center">
        <Text className="text-lg font-bold text-white flex-1">Appointments</Text>
        <View className="flex-row gap-4 items-center">
          <TouchableOpacity
            onPress={() => {
              if (showForm) {
                setShowForm(false);
                setActiveTab('upcoming');
              } else {
                setShowForm(true);
              }
            }}
            className="p-2"
            activeOpacity={0.7}
          >
            {showForm ? (
              <MaterialIcons name="close" size={28} color="#fff" />
            ) : (
              <MaterialIcons name="add" size={28} color="#fff" />
            )}
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            className="p-2"
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs */}
      {!showForm && (
        <View className="flex-row border-b border-gray-200 bg-white">
          <TouchableOpacity
            className={`flex-1 py-3 items-center border-b-2 ${
              activeTab === 'upcoming' ? 'border-primary' : 'border-transparent'
            }`}
            onPress={() => setActiveTab('upcoming')}
          >
            <Text className={`text-sm font-semibold ${activeTab === 'upcoming' ? 'text-primary' : 'text-gray-500'}`}>
              Upcoming
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className={`flex-1 py-3 items-center border-b-2 ${
              activeTab === 'today' ? 'border-primary' : 'border-transparent'
            }`}
            onPress={() => setActiveTab('today')}
          >
            <Text className={`text-sm font-semibold ${activeTab === 'today' ? 'text-primary' : 'text-gray-500'}`}>
              Today
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className={`flex-1 py-3 items-center border-b-2 ${
              activeTab === 'past' ? 'border-primary' : 'border-transparent'
            }`}
            onPress={() => setActiveTab('past')}
          >
            <Text className={`text-sm font-semibold ${activeTab === 'past' ? 'text-primary' : 'text-gray-500'}`}>
              Past
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView 
          ref={scrollViewRef}
          className="flex-1" 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 120 }}
          nestedScrollEnabled={true}
        >
          <View className="p-6">
            {/* Form */}
            {showForm && (
              <>
                {/* Title */}
                <View className="mb-6">
                  <Text className="text-base font-semibold text-gray-800 mb-2">
                    Title <Text className="text-danger">*</Text>
                  </Text>
                  <TextInput
                    className="border border-gray-300 rounded-lg p-3 text-base bg-white"
                    placeholder="e.g., Annual Checkup"
                    value={title}
                    onChangeText={setTitle}
                  />
                </View>

                {/* Doctor Name */}
                <View className="mb-6">
                  <Text className="text-base font-semibold text-gray-800 mb-2">Doctor Name</Text>
                  <TextInput
                    className="border border-gray-300 rounded-lg p-3 text-base bg-white"
                    placeholder="Dr. Smith"
                    value={doctorName}
                    onChangeText={setDoctorName}
                  />
                </View>

                {/* Appointment Type */}
                <View className="mb-6">
                  <Text className="text-base font-semibold text-gray-800 mb-2">Type</Text>
                  <View className="flex-row flex-wrap gap-2.5">
                    {appointmentTypes.map((type) => (
                      <TouchableOpacity
                        key={type}
                        className={`py-2.5 px-4 rounded-lg border ${
                          appointmentType === type
                            ? 'bg-primary border-primary'
                            : 'bg-gray-50 border-gray-300'
                        }`}
                        onPress={() => setAppointmentType(type)}
                        activeOpacity={0.7}
                      >
                        <Text
                          className={`text-sm font-medium ${
                            appointmentType === type
                              ? 'text-white font-semibold'
                              : 'text-gray-600'
                          }`}
                        >
                          {type}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Scheduled Time */}
                <View className="mb-6">
                  <Text className="text-base font-semibold text-gray-800 mb-2">
                    Date & Time <Text className="text-danger">*</Text>
                  </Text>
                  <View className="flex-row gap-3">
                    <TouchableOpacity
                      className="flex-1 border border-gray-300 rounded-lg p-3 bg-gray-50"
                      onPress={() => setShowDatePicker(true)}
                    >
                      <Text className="text-base text-gray-800">
                        {format(scheduledTime, 'MMM d, yyyy')}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      className="flex-1 border border-gray-300 rounded-lg p-3 bg-gray-50"
                      onPress={() => setShowTimePicker(true)}
                    >
                      <Text className="text-base text-gray-800">
                        {format(scheduledTime, 'HH:mm')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {showDatePicker && (
                    <DateTimePicker
                      value={scheduledTime}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={(event, date) => {
                        setShowDatePicker(Platform.OS === 'ios');
                        if (date) {
                          const newDate = new Date(date);
                          newDate.setHours(scheduledTime.getHours());
                          newDate.setMinutes(scheduledTime.getMinutes());
                          setScheduledTime(newDate);
                        }
                      }}
                    />
                  )}
                  {showTimePicker && (
                    <DateTimePicker
                      value={scheduledTime}
                      mode="time"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={(event, time) => {
                        setShowTimePicker(Platform.OS === 'ios');
                        if (time) {
                          const newTime = new Date(scheduledTime);
                          newTime.setHours(time.getHours());
                          newTime.setMinutes(time.getMinutes());
                          setScheduledTime(newTime);
                        }
                      }}
                    />
                  )}
                </View>

                {/* Location */}
                <View className="mb-6">
                  <Text className="text-base font-semibold text-gray-800 mb-2">Location</Text>
                  <TextInput
                    className="border border-gray-300 rounded-lg p-3 text-base bg-white"
                    placeholder="Clinic address"
                    value={location}
                    onChangeText={setLocation}
                  />
                </View>

                {/* Reminder Settings */}
                <View className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <View className="flex-row justify-between items-center mb-3">
                    <View className="flex-1">
                      <Text className="text-base font-semibold text-gray-800">Enable Reminder</Text>
                      <Text className="text-xs text-gray-600 mt-1">
                        Get notified before your appointment
                      </Text>
                    </View>
                    <Switch
                      value={enableReminder}
                      onValueChange={setEnableReminder}
                      trackColor={{ false: '#767577', true: '#4285F4' }}
                      thumbColor={enableReminder ? '#fff' : '#f4f3f4'}
                    />
                  </View>
                  {enableReminder && (
                    <View className="mt-3">
                      <Text className="text-sm font-semibold text-gray-800 mb-2">
                        Remind me (minutes before)
                      </Text>
                      <View className="flex-row gap-2">
                        {[15, 30, 60, 120].map((mins) => (
                          <TouchableOpacity
                            key={mins}
                            className={`flex-1 py-2 px-3 rounded-lg border items-center ${
                              parseInt(reminderMinutes) === mins
                                ? 'bg-primary border-primary'
                                : 'bg-white border-gray-300'
                            }`}
                            onPress={() => setReminderMinutes(mins.toString())}
                          >
                            <Text className={`text-xs font-medium ${
                              parseInt(reminderMinutes) === mins ? 'text-white' : 'text-gray-600'
                            }`}>
                              {mins}m
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}
                </View>

                {/* Notes */}
                <View className="mb-6">
                  <Text className="text-base font-semibold text-gray-800 mb-2">Notes</Text>
                  <TextInput
                    className="border border-gray-300 rounded-lg p-3 text-base bg-white h-20"
                    style={{ textAlignVertical: 'top' }}
                    placeholder="Additional notes"
                    value={notes}
                    onChangeText={setNotes}
                    multiline
                    numberOfLines={3}
                  />
                </View>

                {/* Save Button */}
                <View className="mb-6">
                  <TouchableOpacity
                    className={`py-4 rounded-xl items-center ${
                      canContinue && !loading ? 'bg-primary' : 'bg-gray-400'
                    }`}
                    onPress={handleSaveAppointment}
                    disabled={!canContinue || loading}
                    activeOpacity={0.8}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text className="text-white text-lg font-semibold">Save Appointment</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* Appointments List */}
            {!showForm && (
              <>
                {filteredAppointments.length === 0 ? (
                  <View className="p-6 items-center">
                    <Text className="text-base text-gray-500 text-center mb-4">
                      {activeTab === 'today' && 'No appointments scheduled for today'}
                      {activeTab === 'upcoming' && 'No upcoming appointments'}
                      {activeTab === 'past' && 'No past appointments'}
                    </Text>
                    <TouchableOpacity
                      className="px-6 py-3 bg-primary rounded-lg"
                      onPress={() => {
                        setShowForm(true);
                        setActiveTab('upcoming');
                      }}
                    >
                      <Text className="text-white font-semibold">Add Appointment</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                    {/* Upcoming Appointments - Grouped by time */}
                    {activeTab === 'upcoming' && filteredAppointments.length > 0 && (
                      <View className="mb-6">
                        <View className="flex-row justify-between items-center mb-4">
                          <Text className="text-lg font-semibold text-gray-800">
                            Upcoming ({filteredAppointments.length})
                          </Text>
                          <TouchableOpacity
                            className="px-4 py-2 bg-primary rounded-lg"
                            onPress={() => {
                              setShowForm(true);
                            }}
                          >
                            <Text className="text-white text-sm font-semibold">+ Add</Text>
                          </TouchableOpacity>
                        </View>
                        {filteredAppointments.map((apt) => {
                          const status = getAppointmentStatus(apt);
                          const timeUntil = getTimeUntilAppointment(apt);
                          const apptDate = parseISO(apt.scheduled_time);
                          const isToday = status === 'today';

                          return (
                            <View
                              key={apt.id}
                              className={`p-4 rounded-lg mb-3 border-l-4 ${
                                isToday
                                  ? 'bg-yellow-50 border-l-yellow-500 border border-yellow-200'
                                  : 'bg-gray-50 border-l-primary border border-gray-200'
                              }`}
                            >
                              <View className="flex-row justify-between items-start mb-2">
                                <View className="flex-1">
                                  <View className="flex-row items-center gap-2 mb-1">
                                    <Text className="text-base font-bold text-gray-800">{apt.title}</Text>
                                    {isToday && (
                                      <View className="bg-yellow-500 px-2 py-1 rounded">
                                        <Text className="text-white text-xs font-semibold">TODAY</Text>
                                      </View>
                                    )}
                                  </View>
                                  {apt.doctor_name && (
                                    <Text className="text-sm text-gray-600 mb-1">
                                      Dr. {apt.doctor_name}
                                    </Text>
                                  )}
                                  {apt.appointment_type && (
                                    <Text className="text-xs text-gray-500 mb-1">
                                      {apt.appointment_type}
                                    </Text>
                                  )}
                                  <Text className="text-sm font-semibold text-gray-700 mb-1">
                                    📅 {format(apptDate, 'EEEE, MMM d, yyyy')}
                                  </Text>
                                  <Text className="text-sm font-semibold text-gray-700 mb-1">
                                    ⏰ {format(apptDate, 'h:mm a')}
                                  </Text>
                                  {timeUntil && (
                                    <Text className="text-xs text-blue-600 font-medium mt-1">
                                      {timeUntil}
                                    </Text>
                                  )}
                                  {apt.location && (
                                    <Text className="text-xs text-gray-600 mt-2">
                                      📍 {apt.location}
                                    </Text>
                                  )}
                                  {apt.reminder_minutes && (
                                    <Text className="text-xs text-gray-500 mt-1">
                                      🔔 Reminder: {apt.reminder_minutes} min before
                                    </Text>
                                  )}
                                </View>
                                <TouchableOpacity
                                  onPress={() => handleDeleteAppointment(apt.id)}
                                  className="ml-2 p-2"
                                  activeOpacity={0.7}
                                >
                                  <MaterialIcons name="delete" size={24} color="#E53935" />
                                </TouchableOpacity>
                              </View>
                              {apt.notes && (
                                <Text className="text-xs text-gray-600 mt-2 italic p-2 bg-white rounded">
                                  {apt.notes}
                                </Text>
                              )}
                            </View>
                          );
                        })}
                      </View>
                    )}

                    {/* Today's Appointments */}
                    {activeTab === 'today' && filteredAppointments.length > 0 && (
                      <View className="mb-6">
                        <View className="flex-row justify-between items-center mb-4">
                          <Text className="text-lg font-semibold text-gray-800">
                            Today ({filteredAppointments.length})
                          </Text>
                          <TouchableOpacity
                            className="px-4 py-2 bg-primary rounded-lg"
                            onPress={() => {
                              setShowForm(true);
                            }}
                          >
                            <Text className="text-white text-sm font-semibold">+ Add</Text>
                          </TouchableOpacity>
                        </View>
                        {filteredAppointments.map((apt) => {
                          const apptDate = parseISO(apt.scheduled_time);
                          const timeUntil = getTimeUntilAppointment(apt);

                          return (
                            <View
                              key={apt.id}
                              className="p-4 bg-yellow-50 rounded-lg mb-3 border-l-4 border-l-yellow-500 border border-yellow-200"
                            >
                              <View className="flex-row justify-between items-start mb-2">
                                <View className="flex-1">
                                  <View className="flex-row items-center gap-2 mb-1">
                                    <Text className="text-base font-bold text-gray-800">{apt.title}</Text>
                                    <View className="bg-yellow-500 px-2 py-1 rounded">
                                      <Text className="text-white text-xs font-semibold">TODAY</Text>
                                    </View>
                                  </View>
                                  {apt.doctor_name && (
                                    <Text className="text-sm text-gray-600 mb-1">
                                      Dr. {apt.doctor_name}
                                    </Text>
                                  )}
                                  <Text className="text-sm font-semibold text-gray-700 mb-1">
                                    ⏰ {format(apptDate, 'h:mm a')}
                                  </Text>
                                  {timeUntil && (
                                    <Text className="text-xs text-blue-600 font-medium mt-1">
                                      {timeUntil}
                                    </Text>
                                  )}
                                  {apt.location && (
                                    <Text className="text-xs text-gray-600 mt-2">
                                      📍 {apt.location}
                                    </Text>
                                  )}
                                </View>
                                <TouchableOpacity
                                  onPress={() => handleDeleteAppointment(apt.id)}
                                  className="ml-2 p-2"
                                  activeOpacity={0.7}
                                >
                                  <MaterialIcons name="delete" size={24} color="#E53935" />
                                </TouchableOpacity>
                              </View>
                              {apt.notes && (
                                <Text className="text-xs text-gray-600 mt-2 italic p-2 bg-white rounded">
                                  {apt.notes}
                                </Text>
                              )}
                            </View>
                          );
                        })}
                      </View>
                    )}

                    {/* Past Appointments */}
                    {activeTab === 'past' && filteredAppointments.length > 0 && (
                      <View className="mb-6">
                        <View className="flex-row justify-between items-center mb-4">
                          <Text className="text-lg font-semibold text-gray-800">
                            Past ({filteredAppointments.length})
                          </Text>
                          <TouchableOpacity
                            className="px-4 py-2 bg-primary rounded-lg"
                            onPress={() => {
                              setShowForm(true);
                            }}
                          >
                            <Text className="text-white text-sm font-semibold">+ Add</Text>
                          </TouchableOpacity>
                        </View>
                        {filteredAppointments.slice(0, 20).map((apt) => {
                          const apptDate = parseISO(apt.scheduled_time);
                          const daysAgo = differenceInDays(new Date(), apptDate);

                          return (
                            <View
                              key={apt.id}
                              className="p-4 bg-gray-50 rounded-lg mb-3 border-l-4 border-l-gray-400 opacity-70"
                            >
                              <View className="flex-row justify-between items-start mb-2">
                                <View className="flex-1">
                                  <Text className="text-base font-semibold text-gray-800 mb-1">
                                    {apt.title}
                                  </Text>
                                  {apt.doctor_name && (
                                    <Text className="text-sm text-gray-600 mb-1">
                                      Dr. {apt.doctor_name}
                                    </Text>
                                  )}
                                  <Text className="text-sm text-gray-600 mb-1">
                                    {format(apptDate, 'MMM d, yyyy • h:mm a')}
                                  </Text>
                                  <Text className="text-xs text-gray-500 mt-1">
                                    {daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : `${Math.abs(daysAgo)} days ago`}
                                  </Text>
                                  {apt.location && (
                                    <Text className="text-xs text-gray-500 mt-1">
                                      📍 {apt.location}
                                    </Text>
                                  )}
                                </View>
                                <TouchableOpacity
                                  onPress={() => handleDeleteAppointment(apt.id)}
                                  className="ml-2 p-2"
                                  activeOpacity={0.7}
                                >
                                  <MaterialIcons name="delete" size={24} color="#E53935" />
                                </TouchableOpacity>
                              </View>
                              {apt.notes && (
                                <Text className="text-xs text-gray-600 mt-2 italic p-2 bg-white rounded">
                                  {apt.notes}
                                </Text>
                              )}
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </>
                )}
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default AppointmentsScreen;

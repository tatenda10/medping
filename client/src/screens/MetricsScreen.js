import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, Dimensions, TouchableOpacity, Modal, Platform, ActivityIndicator, TextInput, Alert, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { startOfMonth, startOfYear, subDays, format, parseISO } from 'date-fns';
import { LineChart } from 'react-native-chart-kit';
import databaseService from '../services/databaseService';
import { useAuthCheck } from '../hooks/useAuthCheck';
import CreateAccountPrompt from '../components/CreateAccountPrompt';
import axios from 'axios';
import BASE_URL from '../context/Api';
import syncService from '../services/syncService';

const { width } = Dimensions.get('window');
const screenWidth = width;

const VITALS_OPTIONS = [
  { key: 'weight', label: 'Weight', unit: 'kg', color: '#4285F4' },
  { key: 'blood_pressure_systolic', label: 'Blood Pressure (Systolic)', unit: 'mmHg', color: '#EA4335' },
  { key: 'blood_pressure_diastolic', label: 'Blood Pressure (Diastolic)', unit: 'mmHg', color: '#EA4335' },
  { key: 'blood_glucose', label: 'Blood Glucose', unit: 'mg/dL', color: '#34A853' },
  { key: 'heart_rate', label: 'Heart Rate', unit: 'bpm', color: '#FBBC05' },
  { key: 'temperature', label: 'Temperature', unit: '°C', color: '#FF6D00' },
];

const MetricsScreen = ({ navigation }) => {
  const nav = navigation || useNavigation();
  const { isAuthenticated } = useAuthCheck();
  const [showCreateAccountPrompt, setShowCreateAccountPrompt] = useState(false);
  const [dateRange, setDateRange] = useState('7days'); // 'today', '7days', 'month', 'year', 'custom'
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customStartDate, setCustomStartDate] = useState(new Date());
  const [customEndDate, setCustomEndDate] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [stats, setStats] = useState({
    totalMedications: 0,
    takenToday: 0,
    missedToday: 0,
    skippedToday: 0,
    adherenceRate: 0,
    totalDoses: 0,
    completedDoses: 0,
  });
  const [vitalsLogs, setVitalsLogs] = useState([]);
  const [vitalsHistory, setVitalsHistory] = useState([]);
  const [vitalsTab, setVitalsTab] = useState('charts'); // 'log' or 'charts'
  const [weight, setWeight] = useState('');
  const [bloodPressureSystolic, setBloodPressureSystolic] = useState('');
  const [bloodPressureDiastolic, setBloodPressureDiastolic] = useState('');
  const [bloodGlucose, setBloodGlucose] = useState('');
  const [heartRate, setHeartRate] = useState('');
  const [temperature, setTemperature] = useState('');
  const [vitalsNotes, setVitalsNotes] = useState('');
  const [chartPeriod, setChartPeriod] = useState(7); // days for chart
  const [savingVitals, setSavingVitals] = useState(false);
  const scrollViewRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setShowCreateAccountPrompt(true);
    } else {
      loadMetrics();
    }
  }, [dateRange, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      loadVitalsHistory();
    }
  }, [vitalsTab, chartPeriod, isAuthenticated]);

  const getDateRange = () => {
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    let startDate = new Date();
    let endDate = now;

    switch (dateRange) {
      case 'today':
        startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        endDate = now;
        break;
      case '7days':
        startDate = subDays(now, 7);
        startDate.setHours(0, 0, 0, 0);
        endDate = now;
        break;
      case 'month':
        startDate = startOfMonth(now);
        endDate = now;
        break;
      case 'year':
        startDate = startOfYear(now);
        endDate = now;
        break;
      case 'custom':
        startDate = new Date(customStartDate);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(customEndDate);
        endDate.setHours(23, 59, 59, 999);
        break;
      default:
        startDate = subDays(now, 7);
        startDate.setHours(0, 0, 0, 0);
        endDate = now;
    }

    return { startDate, endDate };
  };

  const getDateRangeLabel = () => {
    switch (dateRange) {
      case 'today':
        return 'Today';
      case '7days':
        return 'Last 7 Days';
      case 'month':
        return 'This Month';
      case 'year':
        return 'This Year';
      case 'custom':
        return `${format(customStartDate, 'MMM d')} - ${format(customEndDate, 'MMM d')}`;
      default:
        return 'Last 7 Days';
    }
  };

  const handleCustomRangeSelect = () => {
    setDateRange('custom');
    setShowCustomModal(false);
  };

  const loadMetrics = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Ensure database is initialized with timeout
      const initPromise = databaseService.ensureInitialized();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database initialization timeout')), 5000)
      );
      
      try {
        await Promise.race([initPromise, timeoutPromise]);
      } catch (initError) {
        console.warn('Database initialization warning, continuing with local data:', initError.message);
      }
      
      // Get user ID
      const userData = await AsyncStorage.getItem('userData');
      const user = userData ? JSON.parse(userData) : null;
      const userId = user?.id || user?.user?.id;
      
      if (!userId) {
        setError('User not found. Please login again.');
        setLoading(false);
        return;
      }
      
      // Get all medications with error handling
      let medications = [];
      try {
        medications = await databaseService.getMedications(userId);
      } catch (medError) {
        console.error('Error loading medications:', medError);
      }
      
      const totalMedications = medications.length;

      // Get today's date
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];

      // Get all dose logs with error handling
      let allDoseLogs = [];
      try {
        allDoseLogs = await databaseService.getDoseLogs(userId);
      } catch (logError) {
        console.error('Error loading dose logs:', logError);
      }
      
      // Filter today's doses
      const todayDoses = allDoseLogs.filter(log => {
        try {
          const logDate = new Date(log.scheduled_time);
          logDate.setHours(0, 0, 0, 0);
          return logDate.toISOString().split('T')[0] === todayStr;
        } catch (e) {
          return false;
        }
      });

      const takenToday = todayDoses.filter(log => log.status === 'taken').length;
      const missedToday = todayDoses.filter(log => log.status === 'missed').length;
      const skippedToday = todayDoses.filter(log => log.status === 'skipped').length;
      
      // Calculate adherence rate based on selected date range
      const { startDate, endDate } = getDateRange();
      const recentDoses = allDoseLogs.filter(log => {
        try {
          const logDate = new Date(log.scheduled_time);
          return logDate >= startDate && logDate <= endDate;
        } catch (e) {
          return false;
        }
      });
      
      const totalDoses = recentDoses.length;
      const completedDoses = recentDoses.filter(log => log.status === 'taken').length;
      const adherenceRate = totalDoses > 0 ? Math.round((completedDoses / totalDoses) * 100) : 0;

      // Load vitals logs
      let vitals = [];
      try {
        vitals = await databaseService.getVitalsLogs(userId);
        // Sort by date descending for history
        const sorted = vitals.sort((a, b) => 
          new Date(b.recorded_at) - new Date(a.recorded_at)
        );
        setVitalsHistory(sorted);
        
        // Filter vitals by date range for charts
        const filteredVitals = vitals.filter(v => {
          try {
            const vDate = parseISO(v.recorded_at);
            return vDate >= startDate && vDate <= endDate;
          } catch (e) {
            return false;
          }
        });
        setVitalsLogs(filteredVitals);
      } catch (vitalsError) {
        console.error('Error loading vitals logs:', vitalsError);
      }

      setStats({
        totalMedications,
        takenToday,
        missedToday,
        skippedToday,
        adherenceRate,
        totalDoses,
        completedDoses,
      });
      
      setError(null);
    } catch (error) {
      console.error('Error loading metrics:', error);
      setError('Failed to load metrics. Showing cached data.');
    } finally {
      setLoading(false);
    }
  };

  const loadVitalsHistory = async () => {
    try {
      const userData = await AsyncStorage.getItem('userData');
      const user = userData ? JSON.parse(userData) : null;
      const userId = user?.id || user?.user?.id || 'guest';

      // Load from local database
      const localVitals = await databaseService.getVitalsLogs(userId);
      // Sort by date descending
      const sorted = localVitals.sort((a, b) => 
        new Date(b.recorded_at) - new Date(a.recorded_at)
      );
      setVitalsHistory(sorted);

      // Update chart data
      const { startDate, endDate } = getDateRange();
      const filteredVitals = sorted.filter(v => {
        try {
          const vDate = parseISO(v.recorded_at);
          return vDate >= startDate && vDate <= endDate;
        } catch (e) {
          return false;
        }
      });
      setVitalsLogs(filteredVitals);

      // Try to sync and fetch latest from server (if online and authenticated)
      if (userId !== 'guest') {
        const online = await syncService.isOnline();
        if (online) {
          try {
            const token = await AsyncStorage.getItem('authToken');
            if (token) {
              const response = await axios.get(`${BASE_URL}/vitals`, {
                headers: { 'Authorization': `Bearer ${token}` },
              });

              if (response.data.success && response.data.vitals) {
                const serverVitals = response.data.vitals || [];
                
                // Update local database with server data
                for (const serverVital of serverVitals) {
                  try {
                    const vitalToSave = {
                      ...serverVital,
                      user_id: userId,
                    };
                    await databaseService.saveVitalsLog(vitalToSave);
                  } catch (saveError) {
                    console.error('Error saving vitals log:', saveError);
                  }
                }
                
                // Reload from local database
                const updatedVitals = await databaseService.getVitalsLogs(userId);
                const sortedUpdated = updatedVitals.sort((a, b) => 
                  new Date(b.recorded_at) - new Date(a.recorded_at)
                );
                setVitalsHistory(sortedUpdated);
                
                // Update chart data with updated data
                const filteredUpdated = sortedUpdated.filter(v => {
                  try {
                    const vDate = parseISO(v.recorded_at);
                    return vDate >= startDate && vDate <= endDate;
                  } catch (e) {
                    return false;
                  }
                });
                setVitalsLogs(filteredUpdated);
              }
            }
          } catch (error) {
            console.log('Using local vitals data - offline or server error');
          }
        }
      }
    } catch (error) {
      console.error('Error loading vitals history:', error);
    }
  };

  const handleSaveVitals = async () => {
    if (!weight && !bloodPressureSystolic && !bloodGlucose && !heartRate && !temperature) {
      Alert.alert('Error', 'Please enter at least one vital sign');
      return;
    }

    setSavingVitals(true);
    try {
      const userData = await AsyncStorage.getItem('userData');
      const user = userData ? JSON.parse(userData) : null;
      const userId = user?.id || user?.user?.id || 'guest';

      const vitalsData = {
        id: `vitals_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        user_id: userId,
        weight: weight ? parseFloat(weight) : null,
        blood_pressure_systolic: bloodPressureSystolic ? parseInt(bloodPressureSystolic) : null,
        blood_pressure_diastolic: bloodPressureDiastolic ? parseInt(bloodPressureDiastolic) : null,
        blood_glucose: bloodGlucose ? parseFloat(bloodGlucose) : null,
        heart_rate: heartRate ? parseInt(heartRate) : null,
        temperature: temperature ? parseFloat(temperature) : null,
        notes: vitalsNotes.trim() || null,
        recorded_at: new Date().toISOString(),
      };

      // Save to local database
      await databaseService.saveVitalsLog(vitalsData);

      // Sync to server if authenticated
      if (userId !== 'guest') {
        const online = await syncService.isOnline();
        if (online) {
          try {
            const token = await AsyncStorage.getItem('authToken');
            if (token) {
              await axios.post(`${BASE_URL}/vitals`, vitalsData, {
                headers: { 'Authorization': `Bearer ${token}` },
              });
            }
          } catch (error) {
            console.log('Saved locally, will sync later');
          }
        }
      }

      // Clear form
      setWeight('');
      setBloodPressureSystolic('');
      setBloodPressureDiastolic('');
      setBloodGlucose('');
      setHeartRate('');
      setTemperature('');
      setVitalsNotes('');

      Alert.alert('Success', 'Vitals recorded successfully');
      await loadVitalsHistory();
      setVitalsTab('charts'); // Switch to charts to see the new data
    } catch (error) {
      console.error('Error saving vitals:', error);
      Alert.alert('Error', 'Failed to save vitals');
    } finally {
      setSavingVitals(false);
    }
  };

  const prepareChartData = (vitalKey) => {
    const cutoffDate = subDays(new Date(), chartPeriod);
    const filtered = vitalsHistory.filter(v => {
      const date = parseISO(v.recorded_at);
      return date >= cutoffDate && v[vitalKey] !== null && v[vitalKey] !== undefined;
    }).sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at));

    if (filtered.length === 0) return null;

    const labels = filtered.map(v => format(parseISO(v.recorded_at), 'MMM d'));
    const data = filtered.map(v => {
      if (vitalKey === 'blood_pressure_systolic' || vitalKey === 'blood_pressure_diastolic') {
        return v[vitalKey] || 0;
      }
      return parseFloat(v[vitalKey]) || 0;
    });

    return { labels, datasets: [{ data }] };
  };

  const renderVitalsChart = (vitalKey, label, unit, color) => {
    const chartData = prepareChartData(vitalKey);
    if (!chartData || chartData.labels.length === 0) {
      return null;
    }

    return (
      <View key={vitalKey} className="mb-6">
        <Text className="text-base font-semibold text-gray-800 mb-3 px-1">
          {label} ({unit})
        </Text>
        <LineChart
          data={{
            labels: chartData.labels,
            datasets: chartData.datasets,
          }}
          width={screenWidth - 48}
          height={220}
          chartConfig={{
            backgroundColor: '#ffffff',
            backgroundGradientFrom: '#ffffff',
            backgroundGradientTo: '#ffffff',
            decimalPlaces: vitalKey === 'weight' || vitalKey === 'temperature' || vitalKey === 'blood_glucose' ? 1 : 0,
            color: (opacity = 1) => color || `rgba(66, 133, 244, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
            style: {
              borderRadius: 16,
            },
            propsForDots: {
              r: '4',
              strokeWidth: '2',
              stroke: color || '#4285F4',
            },
          }}
          bezier
          style={{
            marginVertical: 8,
            borderRadius: 16,
          }}
        />
      </View>
    );
  };

  if (!isAuthenticated) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="bg-primary rounded-t-[20px] px-6 py-6 flex-row justify-between items-center">
          <Text className="text-lg font-bold text-white flex-1">Metrics</Text>
          <TouchableOpacity onPress={() => nav.goBack()} className="p-2" activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
        <View className="flex-1 justify-center items-center p-5">
          <Text className="text-base text-gray-600 text-center mb-5">
            Create an account to view your medication analytics and adherence metrics.
          </Text>
        </View>
        <CreateAccountPrompt
          visible={showCreateAccountPrompt}
          onClose={() => {
            setShowCreateAccountPrompt(false);
            nav.goBack();
          }}
          message="Create an account to view your medication analytics and adherence metrics."
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="bg-primary rounded-t-[20px] px-6 py-6 flex-row justify-between items-center">
        <Text className="text-lg font-bold text-white flex-1">Metrics</Text>
        <TouchableOpacity onPress={() => nav.goBack()} className="p-2" activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="p-4">
          {/* Date Range Selector */}
          <View className="mb-5">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2">
              <View className="flex-row gap-2">
                {['today', '7days', 'month', 'year'].map((range) => (
                  <TouchableOpacity
                    key={range}
                    className={`px-4 py-2 rounded-lg border ${
                      dateRange === range
                        ? 'bg-primary border-primary'
                        : 'bg-white border-gray-300'
                    }`}
                    onPress={() => setDateRange(range)}
                    activeOpacity={0.7}
                  >
                    <Text className={`text-sm font-medium ${
                      dateRange === range ? 'text-white' : 'text-gray-600'
                    }`}>
                      {range === 'today' ? 'Today' : 
                       range === '7days' ? '7 Days' :
                       range === 'month' ? 'Month' : 'Year'}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  className={`px-4 py-2 rounded-lg border ${
                    dateRange === 'custom'
                      ? 'bg-primary border-primary'
                      : 'bg-white border-gray-300'
                  }`}
                  onPress={() => setShowCustomModal(true)}
                  activeOpacity={0.7}
                >
                  <Text className={`text-sm font-medium ${
                    dateRange === 'custom' ? 'text-white' : 'text-gray-600'
                  }`}>
                    Custom
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>

          {/* Custom Date Range Modal */}
          <Modal
            visible={showCustomModal}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setShowCustomModal(false)}
          >
            <View className="flex-1 bg-black/50 justify-center items-center p-5">
              <View className="bg-white rounded-xl p-5 w-full max-w-md">
                <View className="flex-row justify-between items-center mb-5">
                  <Text className="text-lg font-bold text-gray-800">Select Date Range</Text>
                  <TouchableOpacity onPress={() => setShowCustomModal(false)} activeOpacity={0.7}>
                    <MaterialIcons name="close" size={24} color="#666" />
                  </TouchableOpacity>
                </View>

                <View className="mb-5">
                  <View className="mb-4">
                    <Text className="text-sm font-medium text-gray-600 mb-2">Start Date</Text>
                    <TouchableOpacity
                      className="flex-row items-center justify-between p-3 border border-gray-300 rounded-lg bg-gray-50"
                      onPress={() => setShowStartPicker(true)}
                      activeOpacity={0.7}
                    >
                      <Text className="text-sm text-gray-800">
                        {format(customStartDate, 'MMM d, yyyy')}
                      </Text>
                      <MaterialIcons name="calendar-today" size={20} color="#4285F4" />
                    </TouchableOpacity>
                    {showStartPicker && (
                      <DateTimePicker
                        value={customStartDate}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={(event, selectedDate) => {
                          setShowStartPicker(Platform.OS === 'ios');
                          if (selectedDate) {
                            setCustomStartDate(selectedDate);
                          }
                          if (Platform.OS === 'android' && event.type !== 'dismissed') {
                            setShowStartPicker(false);
                          }
                        }}
                      />
                    )}
                  </View>

                  <View className="mb-4">
                    <Text className="text-sm font-medium text-gray-600 mb-2">End Date</Text>
                    <TouchableOpacity
                      className="flex-row items-center justify-between p-3 border border-gray-300 rounded-lg bg-gray-50"
                      onPress={() => setShowEndPicker(true)}
                      activeOpacity={0.7}
                    >
                      <Text className="text-sm text-gray-800">
                        {format(customEndDate, 'MMM d, yyyy')}
                      </Text>
                      <MaterialIcons name="calendar-today" size={20} color="#4285F4" />
                    </TouchableOpacity>
                    {showEndPicker && (
                      <DateTimePicker
                        value={customEndDate}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={(event, selectedDate) => {
                          setShowEndPicker(Platform.OS === 'ios');
                          if (selectedDate) {
                            setCustomEndDate(selectedDate);
                          }
                          if (Platform.OS === 'android' && event.type !== 'dismissed') {
                            setShowEndPicker(false);
                          }
                        }}
                      />
                    )}
                  </View>
                </View>

                <View className="flex-row justify-end gap-3">
                  <TouchableOpacity
                    className="px-5 py-2.5 rounded-lg border border-gray-300"
                    onPress={() => setShowCustomModal(false)}
                    activeOpacity={0.7}
                  >
                    <Text className="text-sm text-gray-600 font-medium">Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="px-5 py-2.5 rounded-lg bg-primary"
                    onPress={handleCustomRangeSelect}
                    activeOpacity={0.7}
                  >
                    <Text className="text-sm text-white font-medium">Apply</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          {/* Loading State */}
          {loading && (
            <View className="py-10 items-center">
              <ActivityIndicator size="large" color="#4285F4" />
              <Text className="text-sm text-gray-600 mt-3">Loading metrics...</Text>
            </View>
          )}

          {/* Error State */}
          {error && !loading && (
            <View className="py-10 items-center">
              <MaterialIcons name="error-outline" size={32} color="#E53935" />
              <Text className="text-sm text-gray-600 mt-3 text-center">{error}</Text>
              <TouchableOpacity
                className="mt-4 px-6 py-2.5 bg-primary rounded-lg"
                onPress={loadMetrics}
                activeOpacity={0.7}
              >
                <Text className="text-white font-medium">Retry</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Stats Grid */}
          {!loading && (
            <>
              <View className="flex-row flex-wrap justify-between mb-5">
                <View className="w-[48%] bg-white rounded-lg p-4 mb-3 border-l-4 border-l-blue-500 border border-gray-200">
                  <View className="flex-row items-center mb-2">
                    <MaterialIcons name="medication" size={20} color="#4285F4" />
                    <Text className="text-xs text-gray-600 ml-2 font-medium">Total Medications</Text>
                  </View>
                  <Text className="text-2xl font-bold text-blue-500 mb-1">{stats.totalMedications}</Text>
                </View>

                <View className="w-[48%] bg-white rounded-lg p-4 mb-3 border-l-4 border-l-green-500 border border-gray-200">
                  <View className="flex-row items-center mb-2">
                    <MaterialIcons name="check-circle" size={20} color="#43A047" />
                    <Text className="text-xs text-gray-600 ml-2 font-medium">Taken Today</Text>
                  </View>
                  <Text className="text-2xl font-bold text-green-500 mb-1">{stats.takenToday}</Text>
                </View>

                <View className="w-[48%] bg-white rounded-lg p-4 mb-3 border-l-4 border-l-red-500 border border-gray-200">
                  <View className="flex-row items-center mb-2">
                    <MaterialIcons name="cancel" size={20} color="#E53935" />
                    <Text className="text-xs text-gray-600 ml-2 font-medium">Missed Today</Text>
                  </View>
                  <Text className="text-2xl font-bold text-red-500 mb-1">{stats.missedToday}</Text>
                </View>

                <View className="w-[48%] bg-white rounded-lg p-4 mb-3 border-l-4 border-l-yellow-500 border border-gray-200">
                  <View className="flex-row items-center mb-2">
                    <MaterialIcons name="pause-circle" size={20} color="#FFB300" />
                    <Text className="text-xs text-gray-600 ml-2 font-medium">Skipped Today</Text>
                  </View>
                  <Text className="text-2xl font-bold text-yellow-500 mb-1">{stats.skippedToday}</Text>
                </View>
              </View>

              {/* Adherence Section */}
              <View className="mb-5">
                <Text className="text-base font-bold text-gray-800 mb-3">Adherence Rate</Text>
                <View className="bg-white rounded-lg p-4 border border-gray-200">
                  <View className="flex-row items-center mb-3">
                    <MaterialIcons name="trending-up" size={28} color="#43A047" />
                    <Text className="text-3xl font-bold text-green-500 ml-3">{stats.adherenceRate}%</Text>
                  </View>
                  <Text className="text-sm text-gray-600 mb-4">
                    {getDateRangeLabel()}: {stats.completedDoses} of {stats.totalDoses} doses taken
                  </Text>
                  <View className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <View 
                      className="h-full bg-green-500 rounded-full"
                      style={{ width: `${stats.adherenceRate}%` }}
                    />
                  </View>
                </View>
              </View>

              {/* Vitals Tracking Section */}
              <View className="mb-5">
                <Text className="text-base font-bold text-gray-800 mb-3">Vitals Tracking</Text>
                
                {/* Vitals Tabs */}
                <View className="flex-row border-b border-gray-200 bg-white rounded-t-lg">
                  <TouchableOpacity
                    className={`flex-1 py-3 items-center border-b-2 ${
                      vitalsTab === 'log' ? 'border-primary' : 'border-transparent'
                    }`}
                    onPress={() => setVitalsTab('log')}
                    activeOpacity={0.7}
                  >
                    <Text className={`text-sm font-semibold ${
                      vitalsTab === 'log' ? 'text-primary' : 'text-gray-500'
                    }`}>
                      Log
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className={`flex-1 py-3 items-center border-b-2 ${
                      vitalsTab === 'charts' ? 'border-primary' : 'border-transparent'
                    }`}
                    onPress={() => setVitalsTab('charts')}
                    activeOpacity={0.7}
                  >
                    <Text className={`text-sm font-semibold ${
                      vitalsTab === 'charts' ? 'text-primary' : 'text-gray-500'
                    }`}>
                      Charts
                    </Text>
                  </TouchableOpacity>
                </View>

                <View className="bg-white rounded-b-lg border-x border-b border-gray-200 p-4">
                  {vitalsTab === 'log' && (
                    <KeyboardAvoidingView 
                      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
                    >
                      <ScrollView 
                        ref={scrollViewRef}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                      >
                        {/* Weight */}
                        <View className="mb-4">
                          <Text className="text-base font-semibold text-gray-800 mb-2">Weight (kg)</Text>
                          <TextInput
                            className="border border-gray-300 rounded-lg p-3 text-base bg-white"
                            placeholder="Enter weight"
                            value={weight}
                            onChangeText={setWeight}
                            keyboardType="decimal-pad"
                          />
                        </View>

                        {/* Blood Pressure */}
                        <View className="mb-4">
                          <Text className="text-base font-semibold text-gray-800 mb-2">Blood Pressure (mmHg)</Text>
                          <View className="flex-row items-center gap-3">
                            <TextInput
                              className="flex-1 border border-gray-300 rounded-lg p-3 text-base bg-white"
                              placeholder="Systolic"
                              value={bloodPressureSystolic}
                              onChangeText={setBloodPressureSystolic}
                              keyboardType="number-pad"
                            />
                            <Text className="text-xl text-gray-600">/</Text>
                            <TextInput
                              className="flex-1 border border-gray-300 rounded-lg p-3 text-base bg-white"
                              placeholder="Diastolic"
                              value={bloodPressureDiastolic}
                              onChangeText={setBloodPressureDiastolic}
                              keyboardType="number-pad"
                            />
                          </View>
                        </View>

                        {/* Blood Glucose */}
                        <View className="mb-4">
                          <Text className="text-base font-semibold text-gray-800 mb-2">Blood Glucose (mg/dL)</Text>
                          <TextInput
                            className="border border-gray-300 rounded-lg p-3 text-base bg-white"
                            placeholder="Enter blood glucose"
                            value={bloodGlucose}
                            onChangeText={setBloodGlucose}
                            keyboardType="decimal-pad"
                          />
                        </View>

                        {/* Heart Rate */}
                        <View className="mb-4">
                          <Text className="text-base font-semibold text-gray-800 mb-2">Heart Rate (bpm)</Text>
                          <TextInput
                            className="border border-gray-300 rounded-lg p-3 text-base bg-white"
                            placeholder="Enter heart rate"
                            value={heartRate}
                            onChangeText={setHeartRate}
                            keyboardType="number-pad"
                          />
                        </View>

                        {/* Temperature */}
                        <View className="mb-4">
                          <Text className="text-base font-semibold text-gray-800 mb-2">Temperature (°C)</Text>
                          <TextInput
                            className="border border-gray-300 rounded-lg p-3 text-base bg-white"
                            placeholder="Enter temperature"
                            value={temperature}
                            onChangeText={setTemperature}
                            keyboardType="decimal-pad"
                          />
                        </View>

                        {/* Notes */}
                        <View className="mb-4">
                          <Text className="text-base font-semibold text-gray-800 mb-2">Notes</Text>
                          <TextInput
                            className="border border-gray-300 rounded-lg p-3 text-base bg-white h-20"
                            style={{ textAlignVertical: 'top' }}
                            placeholder="Additional notes"
                            value={vitalsNotes}
                            onChangeText={setVitalsNotes}
                            multiline
                            numberOfLines={3}
                          />
                        </View>

                        {/* Save Button */}
                        <TouchableOpacity
                          className={`py-4 rounded-xl items-center mb-4 ${
                            (weight || bloodPressureSystolic || bloodGlucose || heartRate || temperature) && !savingVitals
                              ? 'bg-primary'
                              : 'bg-gray-400'
                          }`}
                          onPress={handleSaveVitals}
                          disabled={!weight && !bloodPressureSystolic && !bloodGlucose && !heartRate && !temperature || savingVitals}
                          activeOpacity={0.8}
                        >
                          {savingVitals ? (
                            <ActivityIndicator color="#fff" />
                          ) : (
                            <Text className="text-white text-lg font-semibold">Save Vitals</Text>
                          )}
                        </TouchableOpacity>

                        {/* Recent Records */}
                        {vitalsHistory.length > 0 && (
                          <View className="mt-4">
                            <Text className="text-base font-semibold text-gray-800 mb-3">Recent Records</Text>
                            {vitalsHistory.slice(0, 5).map((vital) => (
                              <View key={vital.id} className="mb-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                                <View className="flex-row justify-between items-start mb-2">
                                  <Text className="text-sm font-semibold text-gray-800">
                                    {format(parseISO(vital.recorded_at), 'MMM d, yyyy h:mm a')}
                                  </Text>
                                </View>
                                <View className="flex-row flex-wrap gap-3">
                                  {vital.weight && (
                                    <Text className="text-sm text-gray-600">Weight: {vital.weight} kg</Text>
                                  )}
                                  {vital.blood_pressure_systolic && (
                                    <Text className="text-sm text-gray-600">
                                      BP: {vital.blood_pressure_systolic}/{vital.blood_pressure_diastolic} mmHg
                                    </Text>
                                  )}
                                  {vital.blood_glucose && (
                                    <Text className="text-sm text-gray-600">Glucose: {vital.blood_glucose} mg/dL</Text>
                                  )}
                                  {vital.heart_rate && (
                                    <Text className="text-sm text-gray-600">HR: {vital.heart_rate} bpm</Text>
                                  )}
                                  {vital.temperature && (
                                    <Text className="text-sm text-gray-600">Temp: {vital.temperature} °C</Text>
                                  )}
                                </View>
                                {vital.notes && (
                                  <Text className="text-sm text-gray-500 mt-2 italic">{vital.notes}</Text>
                                )}
                              </View>
                            ))}
                          </View>
                        )}
                      </ScrollView>
                    </KeyboardAvoidingView>
                  )}

                  {vitalsTab === 'charts' && (
                    <View>
                      {/* Chart Period Selector */}
                      <View className="mb-4">
                        <Text className="text-sm font-medium text-gray-600 mb-2">Chart Period</Text>
                        <View className="flex-row gap-2">
                          {[7, 14, 30, 90].map((days) => (
                            <TouchableOpacity
                              key={days}
                              className={`flex-1 py-2 px-3 rounded-lg border items-center ${
                                chartPeriod === days
                                  ? 'bg-primary border-primary'
                                  : 'bg-white border-gray-300'
                              }`}
                              onPress={() => setChartPeriod(days)}
                              activeOpacity={0.7}
                            >
                              <Text className={`text-xs font-medium ${
                                chartPeriod === days ? 'text-white' : 'text-gray-600'
                              }`}>
                                {days}d
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>

                      {/* Charts */}
                      {VITALS_OPTIONS.map(vital => {
                        const chart = renderVitalsChart(vital.key, vital.label, vital.unit, vital.color);
                        return chart;
                      })}
                      {VITALS_OPTIONS.every(vital => !prepareChartData(vital.key)) && (
                        <View className="py-6 items-center">
                          <Text className="text-sm text-gray-500 text-center">
                            No vitals data available for the selected period
                          </Text>
                          <TouchableOpacity
                            className="mt-4 px-6 py-2.5 bg-primary rounded-lg"
                            onPress={() => setVitalsTab('log')}
                            activeOpacity={0.7}
                          >
                            <Text className="text-white font-medium">Log Vitals</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default MetricsScreen;

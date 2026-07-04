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
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { format, subDays, parseISO, eachDayOfInterval, startOfDay } from 'date-fns';
import { LineChart, BarChart } from 'react-native-chart-kit';
import databaseService from '../services/databaseService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clerkAxios } from '../utils/clerkAxios';
import syncService from '../services/syncService';
import BASE_URL from '../context/Api';
import axios from 'axios';
import { getAuthToken } from '../utils/authToken';

const screenWidth = Dimensions.get('window').width;

const ExerciseTrackingScreen = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState('log'); // 'log', 'charts'
  const [exerciseType, setExerciseType] = useState('');
  const [duration, setDuration] = useState('');
  const [intensity, setIntensity] = useState('moderate');
  const [notes, setNotes] = useState('');
  const [exerciseHistory, setExerciseHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [chartPeriod, setChartPeriod] = useState(7); // days
  const scrollViewRef = useRef(null);

  const exerciseTypes = [
    'Walking', 'Running', 'Cycling', 'Swimming', 'Yoga', 'Strength Training',
    'Cardio', 'Dancing', 'Hiking', 'Other'
  ];

  useEffect(() => {
    loadExerciseHistory();
  }, []);

  useEffect(() => {
    if (activeTab === 'charts') {
      loadExerciseHistory(); // Reload for charts
    }
  }, [activeTab, chartPeriod]);

  const loadExerciseHistory = async () => {
    try {
      const userData = await AsyncStorage.getItem('userData');
      const user = userData ? JSON.parse(userData) : null;
      const userId = user?.id || user?.user?.id || 'guest';

      if (userId !== 'guest' && Platform.OS !== 'web') {
        const healthLogs = await databaseService.getHealthLogs(userId);
        const exerciseLogs = healthLogs
          .filter(log => log.log_type === 'exercise')
          .sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at));
        setExerciseHistory(exerciseLogs);
      } else {
        setExerciseHistory([]);
      }

      // Try to sync from server
      if (userId !== 'guest') {
        const online = await syncService.isOnline();
        if (online) {
          try {
            const token = await getAuthToken();
            if (token) {
              const response = await axios.get(`${BASE_URL}/health-logs?type=exercise`, {
                headers: { 'Authorization': `Bearer ${token}` },
              });

              if (response.data.success && response.data.healthLogs) {
                const serverLogs = response.data.healthLogs || [];
                
                if (Platform.OS !== 'web') {
                  for (const log of serverLogs) {
                    try {
                      await databaseService.saveHealthLog({
                        ...log,
                        user_id: userId,
                      });
                    } catch (saveError) {
                      console.error('Error saving health log:', saveError);
                    }
                  }
                  
                  const updatedLogs = await databaseService.getHealthLogs(userId);
                  const exerciseLogs = updatedLogs
                    .filter(log => log.log_type === 'exercise')
                    .sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at));
                  setExerciseHistory(exerciseLogs);
                } else {
                  setExerciseHistory(serverLogs.sort((a, b) => 
                    new Date(b.recorded_at) - new Date(a.recorded_at)
                  ));
                }
              }
            }
          } catch (error) {
            console.log('Using local exercise data - offline or server error');
          }
        }
      }
    } catch (error) {
      console.error('Error loading exercise history:', error);
    }
  };

  const handleSaveExercise = async () => {
    if (!exerciseType || !duration) {
      Alert.alert('Error', 'Please enter exercise type and duration');
      return;
    }

    setLoading(true);
    try {
      const userData = await AsyncStorage.getItem('userData');
      const user = userData ? JSON.parse(userData) : null;
      const userId = user?.id || user?.user?.id || 'guest';

      const exerciseLog = {
        id: `exercise_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        user_id: userId,
        log_type: 'exercise',
        data: {
          type: exerciseType,
          duration: parseInt(duration),
          intensity: intensity,
          notes: notes.trim() || null,
        },
        recorded_at: new Date().toISOString(),
      };

      if (Platform.OS !== 'web') {
        await databaseService.saveHealthLog(exerciseLog);
      }

      // Sync to server if authenticated
      if (userId !== 'guest') {
        const online = await syncService.isOnline();
        if (online) {
          try {
            await clerkAxios.post('/health-logs', exerciseLog);
          } catch (error) {
            console.log('Saved locally, will sync later');
          }
        }
      }

      // Clear form
      setExerciseType('');
      setDuration('');
      setIntensity('moderate');
      setNotes('');

      Alert.alert('Success', 'Exercise recorded successfully');
      loadExerciseHistory();
      setActiveTab('charts'); // Switch to charts to see new data
    } catch (error) {
      console.error('Error saving exercise:', error);
      Alert.alert('Error', 'Failed to record exercise');
    } finally {
      setLoading(false);
    }
  };

  // Prepare chart data - duration over time
  const prepareDurationChartData = () => {
    const cutoffDate = subDays(new Date(), chartPeriod);
    const filtered = exerciseHistory
      .filter(log => {
        const date = parseISO(log.recorded_at);
        return date >= cutoffDate;
      })
      .sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at));

    if (filtered.length === 0) return null;

    // Group by date
    const byDate = {};
    filtered.forEach(log => {
      const dateKey = format(parseISO(log.recorded_at), 'MMM d');
      const data = typeof log.data === 'string' ? JSON.parse(log.data) : log.data;
      if (!byDate[dateKey]) {
        byDate[dateKey] = 0;
      }
      byDate[dateKey] += data.duration || 0;
    });

    const labels = Object.keys(byDate);
    const data = Object.values(byDate);

    return { labels, datasets: [{ data }] };
  };

  // Prepare chart data - exercise type distribution
  const prepareTypeDistributionData = () => {
    const cutoffDate = subDays(new Date(), chartPeriod);
    const filtered = exerciseHistory.filter(log => {
      const date = parseISO(log.recorded_at);
      return date >= cutoffDate;
    });

    if (filtered.length === 0) return null;

    // Count by type
    const typeCounts = {};
    filtered.forEach(log => {
      const data = typeof log.data === 'string' ? JSON.parse(log.data) : log.data;
      const type = data.type || 'Other';
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });

    const labels = Object.keys(typeCounts).slice(0, 6); // Top 6
    const data = labels.map(label => typeCounts[label]);

    return { labels, datasets: [{ data }] };
  };

  // Prepare chart data - intensity over time
  const prepareIntensityChartData = () => {
    const cutoffDate = subDays(new Date(), chartPeriod);
    const filtered = exerciseHistory
      .filter(log => {
        const date = parseISO(log.recorded_at);
        return date >= cutoffDate;
      })
      .sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at));

    if (filtered.length === 0) return null;

    const intensityMap = { light: 1, moderate: 2, vigorous: 3 };

    // Group by date
    const byDate = {};
    filtered.forEach(log => {
      const dateKey = format(parseISO(log.recorded_at), 'MMM d');
      const data = typeof log.data === 'string' ? JSON.parse(log.data) : log.data;
      if (!byDate[dateKey]) {
        byDate[dateKey] = [];
      }
      byDate[dateKey].push(intensityMap[data.intensity] || 2);
    });

    // Average intensity per day
    const labels = Object.keys(byDate);
    const data = labels.map(dateKey => {
      const intensities = byDate[dateKey];
      const avg = intensities.reduce((sum, val) => sum + val, 0) / intensities.length;
      return avg;
    });

    return { labels, datasets: [{ data }] };
  };

  const durationChartData = prepareDurationChartData();
  const typeChartData = prepareTypeDistributionData();
  const intensityChartData = prepareIntensityChartData();

  // Calculate statistics
  const calculateStats = () => {
    const cutoffDate = subDays(new Date(), chartPeriod);
    const filtered = exerciseHistory.filter(log => {
      const date = parseISO(log.recorded_at);
      return date >= cutoffDate;
    });

    const totalDuration = filtered.reduce((sum, log) => {
      const data = typeof log.data === 'string' ? JSON.parse(log.data) : log.data;
      return sum + (data.duration || 0);
    }, 0);

    const totalSessions = filtered.length;
    const avgDuration = totalSessions > 0 ? Math.round(totalDuration / totalSessions) : 0;
    const totalMinutes = totalDuration;

    return { totalSessions, avgDuration, totalMinutes };
  };

  const stats = calculateStats();

  const canContinue = exerciseType && duration;

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top', 'bottom']}>
      {/* Header */}
      <View className="flex-row items-center px-5 pt-4 pb-3">
        <TouchableOpacity 
          className="w-10 h-10 rounded-full bg-gray-100 justify-center items-center mr-3"
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text className="text-2xl font-bold text-gray-900 flex-1">Exercise Tracking</Text>
      </View>

      {/* Tabs */}
      <View className="flex-row border-b border-gray-200 bg-white px-5">
        <TouchableOpacity
          className={`flex-1 py-3 items-center border-b-2 ${
            activeTab === 'log' ? '' : 'border-transparent'
          }`}
          style={{ borderBottomColor: activeTab === 'log' ? '#90CDF4' : 'transparent' }}
          onPress={() => setActiveTab('log')}
          activeOpacity={0.7}
        >
          <Text 
            className="text-sm font-semibold"
            style={{ color: activeTab === 'log' ? '#90CDF4' : '#999' }}
          >
            Log
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          className={`flex-1 py-3 items-center border-b-2 ${
            activeTab === 'charts' ? '' : 'border-transparent'
          }`}
          style={{ borderBottomColor: activeTab === 'charts' ? '#90CDF4' : 'transparent' }}
          onPress={() => setActiveTab('charts')}
          activeOpacity={0.7}
        >
          <Text 
            className="text-sm font-semibold"
            style={{ color: activeTab === 'charts' ? '#90CDF4' : '#999' }}
          >
            Charts & Stats
          </Text>
        </TouchableOpacity>
      </View>

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
          <View className="p-5">
            {/* Log Tab */}
            {activeTab === 'log' && (
              <>
                {/* Exercise Type */}
                <View className="mb-6">
                  <Text className="text-sm font-semibold text-gray-600 mb-3">Exercise Type</Text>
                  <View className="flex-row flex-wrap gap-2.5">
                    {exerciseTypes.map((type) => (
                      <TouchableOpacity
                        key={type}
                        className="py-2.5 px-4 rounded-lg"
                        style={{
                          backgroundColor: exerciseType === type ? '#90CDF4' : '#F5F5F5',
                        }}
                        onPress={() => setExerciseType(type)}
                        activeOpacity={0.7}
                      >
                        <Text
                          className="text-sm font-medium"
                          style={{
                            color: exerciseType === type ? '#fff' : '#666',
                            fontWeight: exerciseType === type ? '600' : '500',
                          }}
                        >
                          {type}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Duration */}
                <View className="mb-6">
                  <Text className="text-sm font-semibold text-gray-600 mb-2">Duration (minutes)</Text>
                  <TextInput
                    className="bg-gray-50 rounded-xl p-4 text-base"
                    placeholder="Enter duration"
                    placeholderTextColor="#999"
                    value={duration}
                    onChangeText={setDuration}
                    keyboardType="number-pad"
                  />
                </View>

                {/* Intensity */}
                <View className="mb-6">
                  <Text className="text-sm font-semibold text-gray-600 mb-2">Intensity</Text>
                  <View className="flex-row gap-2.5">
                    {['light', 'moderate', 'vigorous'].map((level) => (
                      <TouchableOpacity
                        key={level}
                        className="flex-1 py-3 px-4 rounded-lg items-center"
                        style={{
                          backgroundColor: intensity === level ? '#90CDF4' : '#F5F5F5',
                        }}
                        onPress={() => setIntensity(level)}
                        activeOpacity={0.7}
                      >
                        <Text
                          className="text-sm font-medium"
                          style={{
                            color: intensity === level ? '#fff' : '#666',
                            fontWeight: intensity === level ? '600' : '500',
                          }}
                        >
                          {level.charAt(0).toUpperCase() + level.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Notes */}
                <View className="mb-6">
                  <Text className="text-sm font-semibold text-gray-600 mb-2">Notes</Text>
                  <TextInput
                    className="bg-gray-50 rounded-xl p-4 text-base h-20"
                    style={{ textAlignVertical: 'top' }}
                    placeholder="Additional notes"
                    placeholderTextColor="#999"
                    value={notes}
                    onChangeText={setNotes}
                    multiline
                    numberOfLines={3}
                  />
                </View>

                {/* Recent History */}
                {exerciseHistory.length > 0 && (
                  <View className="mb-6 pt-6 border-t border-gray-200">
                    <Text className="text-lg font-bold text-gray-900 mb-4">Recent Exercises</Text>
                    {exerciseHistory.slice(0, 5).map((log, index) => {
                      const data = typeof log.data === 'string' ? JSON.parse(log.data) : log.data;
                      return (
                        <View key={log.id || index} className="bg-white rounded-xl p-4 mb-3">
                          <View className="flex-row justify-between items-center mb-2">
                            <Text className="text-base font-semibold text-gray-900">{data.type}</Text>
                            <Text className="text-sm text-gray-600">
                              {format(parseISO(log.recorded_at), 'MMM d, yyyy')}
                            </Text>
                          </View>
                          <Text className="text-sm text-gray-600 mb-1">
                            {data.duration} min • {data.intensity} intensity
                          </Text>
                          {data.notes && (
                            <Text className="text-xs text-gray-600 mt-2 italic">{data.notes}</Text>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}
              </>
            )}

            {/* Charts Tab */}
            {activeTab === 'charts' && (
              <>
                {/* Statistics Cards */}
                <View className="mb-6 flex-row gap-3">
                  <View className="flex-1 bg-white rounded-xl p-4">
                    <Text className="text-xs text-gray-600 mb-1">Total Sessions</Text>
                    <Text className="text-2xl font-bold text-gray-900">{stats.totalSessions}</Text>
                  </View>
                  <View className="flex-1 bg-white rounded-xl p-4">
                    <Text className="text-xs text-gray-600 mb-1">Avg Duration</Text>
                    <Text className="text-2xl font-bold text-gray-900">{stats.avgDuration}m</Text>
                  </View>
                  <View className="flex-1 bg-white rounded-xl p-4">
                    <Text className="text-xs text-gray-600 mb-1">Total Minutes</Text>
                    <Text className="text-2xl font-bold text-gray-900">{stats.totalMinutes}</Text>
                  </View>
                </View>

                {/* Period Selector */}
                <View className="mb-6 flex-row gap-2">
                  {[7, 14, 30, 90].map((days) => (
                    <TouchableOpacity
                      key={days}
                      className="flex-1 py-3 px-3 rounded-lg items-center"
                      style={{
                        backgroundColor: chartPeriod === days ? '#90CDF4' : '#F5F5F5',
                      }}
                      onPress={() => setChartPeriod(days)}
                      activeOpacity={0.7}
                    >
                      <Text 
                        className="text-xs font-medium"
                        style={{
                          color: chartPeriod === days ? '#fff' : '#666',
                          fontWeight: chartPeriod === days ? '600' : '500',
                        }}
                      >
                        {days}D
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Duration Over Time Chart */}
                {durationChartData ? (
                  <View className="mb-6 bg-white rounded-xl p-4">
                    <Text className="text-base font-semibold text-gray-900 mb-3">
                      Exercise Duration Over Time (minutes)
                    </Text>
                    <LineChart
                      data={durationChartData}
                      width={screenWidth - 80}
                      height={220}
                      chartConfig={{
                        backgroundColor: '#ffffff',
                        backgroundGradientFrom: '#ffffff',
                        backgroundGradientTo: '#ffffff',
                        decimalPlaces: 0,
                        color: (opacity = 1) => `rgba(144, 205, 244, ${opacity})`,
                        labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                        style: { borderRadius: 16 },
                        propsForDots: {
                          r: '4',
                          strokeWidth: '2',
                          stroke: '#90CDF4',
                        },
                      }}
                      bezier
                      style={{ marginVertical: 8, borderRadius: 16 }}
                    />
                  </View>
                ) : (
                  <View className="mb-6 bg-white rounded-xl p-4">
                    <Text className="text-sm text-gray-500 text-center">
                      No exercise data for the selected period
                    </Text>
                  </View>
                )}

                {/* Exercise Type Distribution */}
                {typeChartData && typeChartData.labels.length > 0 && (
                  <View className="mb-6 bg-white rounded-xl p-4">
                    <Text className="text-base font-semibold text-gray-900 mb-3">
                      Exercise Type Distribution
                    </Text>
                    <BarChart
                      data={typeChartData}
                      width={screenWidth - 80}
                      height={220}
                      chartConfig={{
                        backgroundColor: '#ffffff',
                        backgroundGradientFrom: '#ffffff',
                        backgroundGradientTo: '#ffffff',
                        decimalPlaces: 0,
                        color: (opacity = 1) => `rgba(144, 205, 244, ${opacity})`,
                        labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                        style: { borderRadius: 16 },
                      }}
                      style={{ marginVertical: 8, borderRadius: 16 }}
                      yAxisLabel=""
                      yAxisSuffix=""
                      verticalLabelRotation={45}
                    />
                  </View>
                )}

                {/* Intensity Chart */}
                {intensityChartData && (
                  <View className="mb-6 bg-white rounded-xl p-4">
                    <Text className="text-base font-semibold text-gray-900 mb-3">
                      Intensity Over Time (1=Light, 2=Moderate, 3=Vigorous)
                    </Text>
                    <LineChart
                      data={intensityChartData}
                      width={screenWidth - 80}
                      height={220}
                      chartConfig={{
                        backgroundColor: '#ffffff',
                        backgroundGradientFrom: '#ffffff',
                        backgroundGradientTo: '#ffffff',
                        decimalPlaces: 1,
                        color: (opacity = 1) => `rgba(144, 205, 244, ${opacity})`,
                        labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                        style: { borderRadius: 16 },
                        propsForDots: {
                          r: '4',
                          strokeWidth: '2',
                          stroke: '#90CDF4',
                        },
                      }}
                      bezier
                      style={{ marginVertical: 8, borderRadius: 16 }}
                    />
                  </View>
                )}

                {/* Exercise Log by Date */}
                <View className="mb-6 pt-6 border-t border-gray-200">
                  <Text className="text-lg font-bold text-gray-900 mb-4">All Exercise Logs</Text>
                  {exerciseHistory.length === 0 ? (
                    <Text className="text-sm text-gray-500 text-center py-4">
                      No exercise data recorded yet
                    </Text>
                  ) : (
                    exerciseHistory.map((log, index) => {
                      const data = typeof log.data === 'string' ? JSON.parse(log.data) : log.data;
                      return (
                        <View key={log.id || index} className="bg-white rounded-xl p-4 mb-3">
                          <View className="flex-row justify-between items-center mb-2">
                            <Text className="text-base font-semibold text-gray-900">{data.type}</Text>
                            <Text className="text-sm text-gray-600">
                              {format(parseISO(log.recorded_at), 'MMM d, yyyy • HH:mm')}
                            </Text>
                          </View>
                          <Text className="text-sm text-gray-600 mb-1">
                            {data.duration} min • {data.intensity} intensity
                          </Text>
                          {data.notes && (
                            <Text className="text-xs text-gray-600 mt-2 italic">{data.notes}</Text>
                          )}
                        </View>
                      );
                    })
                  )}
                </View>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer - Only show for Log tab */}
      {activeTab === 'log' && (
        <View className="px-5 pb-8 pt-4 border-t border-gray-200">
          <TouchableOpacity
            className="rounded-xl p-4 items-center justify-center"
            style={{ 
              backgroundColor: canContinue && !loading ? '#90CDF4' : '#B0BEC5' 
            }}
            onPress={handleSaveExercise}
            disabled={!canContinue || loading}
            activeOpacity={0.7}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white text-base font-bold">Save Exercise</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

export default ExerciseTrackingScreen;

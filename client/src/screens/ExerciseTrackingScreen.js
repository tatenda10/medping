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
import { format, subDays, parseISO, eachDayOfInterval, startOfDay } from 'date-fns';
import { LineChart, BarChart } from 'react-native-chart-kit';
import databaseService from '../services/databaseService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import BASE_URL from '../context/Api';
import syncService from '../services/syncService';

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

      if (userId !== 'guest') {
        const healthLogs = await databaseService.getHealthLogs(userId);
        const exerciseLogs = healthLogs
          .filter(log => log.log_type === 'exercise')
          .sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at));
        setExerciseHistory(exerciseLogs);
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

      await databaseService.saveHealthLog(exerciseLog);

      // Sync to server if authenticated
      if (userId !== 'guest') {
        const online = await syncService.isOnline();
        if (online) {
          try {
            const token = await AsyncStorage.getItem('authToken');
            if (token) {
              await axios.post(`${BASE_URL}/health-logs`, exerciseLog, {
                headers: { 'Authorization': `Bearer ${token}` },
              });
            }
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
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="bg-primary rounded-t-[20px] px-6 py-6 flex-row justify-between items-center">
        <Text className="text-lg font-bold text-white flex-1">Exercise Tracking</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} className="px-4 py-2">
          <Text className="text-base text-white font-semibold">✕</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View className="flex-row border-b border-gray-200 bg-white">
        <TouchableOpacity
          className={`flex-1 py-3 items-center border-b-2 ${
            activeTab === 'log' ? 'border-primary' : 'border-transparent'
          }`}
          onPress={() => setActiveTab('log')}
        >
          <Text className={`text-sm font-semibold ${activeTab === 'log' ? 'text-primary' : 'text-gray-500'}`}>
            Log
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          className={`flex-1 py-3 items-center border-b-2 ${
            activeTab === 'charts' ? 'border-primary' : 'border-transparent'
          }`}
          onPress={() => setActiveTab('charts')}
        >
          <Text className={`text-sm font-semibold ${activeTab === 'charts' ? 'text-primary' : 'text-gray-500'}`}>
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
          <View className="p-6">
            {/* Log Tab */}
            {activeTab === 'log' && (
              <>
                {/* Exercise Type */}
                <View className="mb-6">
                  <Text className="text-base font-semibold text-gray-800 mb-3">Exercise Type</Text>
                  <View className="flex-row flex-wrap gap-2.5">
                    {exerciseTypes.map((type) => (
                      <TouchableOpacity
                        key={type}
                        className={`py-2.5 px-4 rounded-lg border ${
                          exerciseType === type
                            ? 'bg-primary border-primary'
                            : 'bg-gray-50 border-gray-300'
                        }`}
                        onPress={() => setExerciseType(type)}
                        activeOpacity={0.7}
                      >
                        <Text
                          className={`text-sm font-medium ${
                            exerciseType === type
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

                {/* Duration */}
                <View className="mb-6">
                  <Text className="text-base font-semibold text-gray-800 mb-2">Duration (minutes)</Text>
                  <TextInput
                    className="border border-gray-300 rounded-lg p-3 text-base bg-white"
                    placeholder="Enter duration"
                    value={duration}
                    onChangeText={setDuration}
                    keyboardType="number-pad"
                  />
                </View>

                {/* Intensity */}
                <View className="mb-6">
                  <Text className="text-base font-semibold text-gray-800 mb-2">Intensity</Text>
                  <View className="flex-row gap-2.5">
                    {['light', 'moderate', 'vigorous'].map((level) => (
                      <TouchableOpacity
                        key={level}
                        className={`flex-1 py-3 px-4 rounded-lg border items-center ${
                          intensity === level
                            ? 'bg-primary border-primary'
                            : 'bg-gray-50 border-gray-300'
                        }`}
                        onPress={() => setIntensity(level)}
                        activeOpacity={0.7}
                      >
                        <Text
                          className={`text-sm font-medium ${
                            intensity === level
                              ? 'text-white font-semibold'
                              : 'text-gray-600'
                          }`}
                        >
                          {level.charAt(0).toUpperCase() + level.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
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

                {/* Recent History */}
                {exerciseHistory.length > 0 && (
                  <View className="mb-6 pt-6 border-t border-gray-300">
                    <Text className="text-lg font-semibold text-gray-800 mb-4">Recent Exercises</Text>
                    {exerciseHistory.slice(0, 5).map((log, index) => {
                      const data = typeof log.data === 'string' ? JSON.parse(log.data) : log.data;
                      return (
                        <View key={log.id || index} className="p-3 bg-gray-50 rounded-lg mb-3">
                          <View className="flex-row justify-between items-center mb-2">
                            <Text className="text-base font-semibold text-gray-800">{data.type}</Text>
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
                  <View className="flex-1 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <Text className="text-xs text-blue-600 mb-1">Total Sessions</Text>
                    <Text className="text-2xl font-bold text-blue-800">{stats.totalSessions}</Text>
                  </View>
                  <View className="flex-1 p-4 bg-green-50 rounded-lg border border-green-200">
                    <Text className="text-xs text-green-600 mb-1">Avg Duration</Text>
                    <Text className="text-2xl font-bold text-green-800">{stats.avgDuration}m</Text>
                  </View>
                  <View className="flex-1 p-4 bg-purple-50 rounded-lg border border-purple-200">
                    <Text className="text-xs text-purple-600 mb-1">Total Minutes</Text>
                    <Text className="text-2xl font-bold text-purple-800">{stats.totalMinutes}</Text>
                  </View>
                </View>

                {/* Period Selector */}
                <View className="mb-6 flex-row gap-2">
                  {[7, 14, 30, 90].map((days) => (
                    <TouchableOpacity
                      key={days}
                      className={`flex-1 py-2 px-3 rounded-lg border items-center ${
                        chartPeriod === days
                          ? 'bg-primary border-primary'
                          : 'bg-white border-gray-300'
                      }`}
                      onPress={() => setChartPeriod(days)}
                    >
                      <Text className={`text-xs font-medium ${
                        chartPeriod === days ? 'text-white' : 'text-gray-600'
                      }`}>
                        {days}D
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Duration Over Time Chart */}
                {durationChartData ? (
                  <View className="mb-6">
                    <Text className="text-base font-semibold text-gray-800 mb-3 px-1">
                      Exercise Duration Over Time (minutes)
                    </Text>
                    <LineChart
                      data={durationChartData}
                      width={screenWidth - 48}
                      height={220}
                      chartConfig={{
                        backgroundColor: '#ffffff',
                        backgroundGradientFrom: '#ffffff',
                        backgroundGradientTo: '#ffffff',
                        decimalPlaces: 0,
                        color: (opacity = 1) => `rgba(66, 133, 244, ${opacity})`,
                        labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                        style: { borderRadius: 16 },
                        propsForDots: {
                          r: '4',
                          strokeWidth: '2',
                          stroke: '#4285F4',
                        },
                      }}
                      bezier
                      style={{ marginVertical: 8, borderRadius: 16 }}
                    />
                  </View>
                ) : (
                  <View className="mb-6 p-4 bg-gray-50 rounded-lg">
                    <Text className="text-sm text-gray-500 text-center">
                      No exercise data for the selected period
                    </Text>
                  </View>
                )}

                {/* Exercise Type Distribution */}
                {typeChartData && typeChartData.labels.length > 0 && (
                  <View className="mb-6">
                    <Text className="text-base font-semibold text-gray-800 mb-3 px-1">
                      Exercise Type Distribution
                    </Text>
                    <BarChart
                      data={typeChartData}
                      width={screenWidth - 48}
                      height={220}
                      chartConfig={{
                        backgroundColor: '#ffffff',
                        backgroundGradientFrom: '#ffffff',
                        backgroundGradientTo: '#ffffff',
                        decimalPlaces: 0,
                        color: (opacity = 1) => `rgba(52, 168, 83, ${opacity})`,
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
                  <View className="mb-6">
                    <Text className="text-base font-semibold text-gray-800 mb-3 px-1">
                      Intensity Over Time (1=Light, 2=Moderate, 3=Vigorous)
                    </Text>
                    <LineChart
                      data={intensityChartData}
                      width={screenWidth - 48}
                      height={220}
                      chartConfig={{
                        backgroundColor: '#ffffff',
                        backgroundGradientFrom: '#ffffff',
                        backgroundGradientTo: '#ffffff',
                        decimalPlaces: 1,
                        color: (opacity = 1) => `rgba(255, 109, 0, ${opacity})`,
                        labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                        style: { borderRadius: 16 },
                        propsForDots: {
                          r: '4',
                          strokeWidth: '2',
                          stroke: '#FF6D00',
                        },
                      }}
                      bezier
                      style={{ marginVertical: 8, borderRadius: 16 }}
                    />
                  </View>
                )}

                {/* Exercise Log by Date */}
                <View className="mb-6 pt-6 border-t border-gray-300">
                  <Text className="text-lg font-semibold text-gray-800 mb-4">All Exercise Logs</Text>
                  {exerciseHistory.length === 0 ? (
                    <Text className="text-sm text-gray-500 text-center py-4">
                      No exercise data recorded yet
                    </Text>
                  ) : (
                    exerciseHistory.map((log, index) => {
                      const data = typeof log.data === 'string' ? JSON.parse(log.data) : log.data;
                      return (
                        <View key={log.id || index} className="p-3 bg-gray-50 rounded-lg mb-3">
                          <View className="flex-row justify-between items-center mb-2">
                            <Text className="text-base font-semibold text-gray-800">{data.type}</Text>
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
        <View className="p-6 border-t border-gray-300">
          <TouchableOpacity
            className={`py-4 rounded-xl items-center ${
              canContinue && !loading ? 'bg-primary' : 'bg-gray-400'
            }`}
            onPress={handleSaveExercise}
            disabled={!canContinue || loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white text-lg font-semibold">Save Exercise</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

export default ExerciseTrackingScreen;

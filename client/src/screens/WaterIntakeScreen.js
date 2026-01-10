import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
  TextInput,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format, startOfDay, isToday, subDays, eachDayOfInterval, startOfWeek, endOfWeek, parseISO, differenceInDays } from 'date-fns';
import { LineChart, BarChart } from 'react-native-chart-kit';
import databaseService from '../services/databaseService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import BASE_URL from '../context/Api';
import syncService from '../services/syncService';

const screenWidth = Dimensions.get('window').width;

const WaterIntakeScreen = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState('track'); // 'track', 'history', 'milestones'
  const [todayIntake, setTodayIntake] = useState(0);
  const [dailyGoal, setDailyGoal] = useState(2000); // ml
  const [intakeHistory, setIntakeHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [customAmount, setCustomAmount] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState(0); // 0 = current week, -1 = last week, etc.
  const scrollViewRef = useRef(null);

  useEffect(() => {
    loadTodayIntake();
    loadDailyGoal();
    loadIntakeHistory();
  }, []);

  useEffect(() => {
    if (activeTab === 'history' || activeTab === 'milestones') {
      loadIntakeHistory();
    }
  }, [activeTab, selectedWeek]);

  const loadDailyGoal = async () => {
    try {
      const stored = await AsyncStorage.getItem('waterIntakeGoal');
      if (stored) {
        setDailyGoal(parseInt(stored));
      }
    } catch (error) {
      console.error('Error loading daily goal:', error);
    }
  };

  const loadIntakeHistory = async () => {
    try {
      const userData = await AsyncStorage.getItem('userData');
      const user = userData ? JSON.parse(userData) : null;
      const userId = user?.id || user?.user?.id || 'guest';

      if (userId === 'guest') return;

      const healthLogs = await databaseService.getHealthLogs(userId);
      const waterLogs = healthLogs
        .filter(log => log.log_type === 'water_intake')
        .sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at));
      
      setIntakeHistory(waterLogs);
      calculateTodayIntake(waterLogs);
    } catch (error) {
      console.error('Error loading intake history:', error);
    }
  };

  const calculateTodayIntake = (logs) => {
    const today = startOfDay(new Date());
    const todayLogs = logs.filter(log => {
      const logDate = new Date(log.recorded_at);
      return logDate >= today;
    });

    const total = todayLogs.reduce((sum, log) => {
      const data = typeof log.data === 'string' ? JSON.parse(log.data) : log.data;
      return sum + (data.amount || 0);
    }, 0);

    setTodayIntake(total);
  };

  const loadTodayIntake = async () => {
    try {
      const userData = await AsyncStorage.getItem('userData');
      const user = userData ? JSON.parse(userData) : null;
      const userId = user?.id || user?.user?.id || 'guest';

      if (userId === 'guest') return;

      const healthLogs = await databaseService.getHealthLogs(userId);
      calculateTodayIntake(healthLogs);
    } catch (error) {
      console.error('Error loading today intake:', error);
    }
  };

  const handleAddWater = async (amount) => {
    if (!amount || amount <= 0) return;

    setLoading(true);
    try {
      const userData = await AsyncStorage.getItem('userData');
      const user = userData ? JSON.parse(userData) : null;
      const userId = user?.id || user?.user?.id || 'guest';

      if (userId === 'guest') {
        Alert.alert('Error', 'Please create an account to track water intake');
        return;
      }

      const healthLog = {
        id: `water_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        user_id: userId,
        log_type: 'water_intake',
        data: { amount },
        recorded_at: new Date().toISOString(),
      };

      await databaseService.saveHealthLog(healthLog);

      // Sync to server
      const online = await syncService.isOnline();
      if (online) {
        try {
          const token = await AsyncStorage.getItem('authToken');
          if (token) {
            await axios.post(`${BASE_URL}/health-logs`, healthLog, {
              headers: { 'Authorization': `Bearer ${token}` },
            });
          }
        } catch (error) {
          console.log('Saved locally, will sync later');
        }
      }

      setCustomAmount('');
      setShowCustomInput(false);
      loadTodayIntake();
      loadIntakeHistory();
    } catch (error) {
      console.error('Error adding water intake:', error);
      Alert.alert('Error', 'Failed to record water intake');
    } finally {
      setLoading(false);
    }
  };

  const handleCustomAdd = () => {
    const amount = parseInt(customAmount);
    if (amount && amount > 0) {
      handleAddWater(amount);
    } else {
      Alert.alert('Error', 'Please enter a valid amount');
    }
  };

  // Get weekly data
  const getWeeklyData = () => {
    const weekStart = startOfWeek(subDays(new Date(), selectedWeek * 7), { weekStartsOn: 1 });
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
    const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

    const weeklyData = weekDays.map(day => {
      const dayStart = startOfDay(day);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const dayLogs = intakeHistory.filter(log => {
        const logDate = new Date(log.recorded_at);
        return logDate >= dayStart && logDate <= dayEnd;
      });

      const total = dayLogs.reduce((sum, log) => {
        const data = typeof log.data === 'string' ? JSON.parse(log.data) : log.data;
        return sum + (data.amount || 0);
      }, 0);

      return {
        date: day,
        intake: total,
        goal: dailyGoal,
        achieved: total >= dailyGoal,
      };
    });

    return weeklyData;
  };

  // Calculate milestones
  const calculateMilestones = () => {
    const milestones = [];
    
    // Current streak
    let currentStreak = 0;
    const sortedHistory = [...intakeHistory].sort((a, b) => 
      new Date(b.recorded_at) - new Date(a.recorded_at)
    );
    
    const today = startOfDay(new Date());
    for (let i = 0; i < 365; i++) {
      const checkDate = subDays(today, i);
      const dayLogs = sortedHistory.filter(log => {
        const logDate = startOfDay(new Date(log.recorded_at));
        return logDate.getTime() === checkDate.getTime();
      });
      
      const dayTotal = dayLogs.reduce((sum, log) => {
        const data = typeof log.data === 'string' ? JSON.parse(log.data) : log.data;
        return sum + (data.amount || 0);
      }, 0);

      if (dayTotal >= dailyGoal || (i === 0 && dayTotal > 0)) {
        currentStreak++;
      } else {
        break;
      }
    }

    if (currentStreak > 0) {
      milestones.push({
        title: `${currentStreak} Day Streak! 🔥`,
        description: `You've met your goal for ${currentStreak} day(s) in a row`,
        icon: '🔥',
        achieved: currentStreak >= 7,
      });
    }

    // Total days with goal met
    const daysWithGoal = intakeHistory.reduce((count, log) => {
      const date = startOfDay(new Date(log.recorded_at));
      return count;
    }, 0);

    const uniqueDays = new Set(
      intakeHistory.map(log => format(startOfDay(new Date(log.recorded_at)), 'yyyy-MM-dd'))
    ).size;

    milestones.push({
      title: `${uniqueDays} Days Tracked`,
      description: `You've logged water intake on ${uniqueDays} different day(s)`,
      icon: '📊',
      achieved: uniqueDays >= 30,
    });

    // All-time total
    const allTimeTotal = intakeHistory.reduce((sum, log) => {
      const data = typeof log.data === 'string' ? JSON.parse(log.data) : log.data;
      return sum + (data.amount || 0);
    }, 0);

    const liters = (allTimeTotal / 1000).toFixed(1);
    milestones.push({
      title: `${liters}L Total`,
      description: `You've logged ${liters} liters total`,
      icon: '💧',
      achieved: allTimeTotal >= 100000, // 100L milestone
    });

    // Best day
    const dailyTotals = {};
    intakeHistory.forEach(log => {
      const dateKey = format(startOfDay(new Date(log.recorded_at)), 'yyyy-MM-dd');
      const data = typeof log.data === 'string' ? JSON.parse(log.data) : log.data;
      if (!dailyTotals[dateKey]) {
        dailyTotals[dateKey] = 0;
      }
      dailyTotals[dateKey] += data.amount || 0;
    });

    const bestDay = Math.max(...Object.values(dailyTotals), 0);
    if (bestDay > 0) {
      milestones.push({
        title: `${bestDay}ml Best Day`,
        description: `Your highest daily intake was ${bestDay}ml`,
        icon: '⭐',
        achieved: bestDay >= dailyGoal * 1.5,
      });
    }

    return milestones;
  };

  // Prepare chart data for weekly view
  const prepareWeeklyChartData = () => {
    const weeklyData = getWeeklyData();
    const labels = weeklyData.map(d => format(d.date, 'EEE'));
    const intakeData = weeklyData.map(d => d.intake);
    const goalData = weeklyData.map(() => dailyGoal);

    return {
      labels,
      datasets: [
        {
          data: intakeData,
          color: (opacity = 1) => `rgba(66, 133, 244, ${opacity})`,
          strokeWidth: 2,
        },
        {
          data: goalData,
          color: (opacity = 1) => `rgba(52, 168, 83, ${opacity})`,
          strokeWidth: 2,
          withDots: false,
        },
      ],
    };
  };

  // Prepare chart data for daily intake over time (30 days)
  const prepareDailyChartData = () => {
    const last30Days = subDays(new Date(), 30);
    const filtered = intakeHistory.filter(log => {
      const logDate = new Date(log.recorded_at);
      return logDate >= last30Days;
    });

    // Group by date
    const byDate = {};
    filtered.forEach(log => {
      const dateKey = format(startOfDay(new Date(log.recorded_at)), 'MMM d');
      const data = typeof log.data === 'string' ? JSON.parse(log.data) : log.data;
      if (!byDate[dateKey]) {
        byDate[dateKey] = 0;
      }
      byDate[dateKey] += data.amount || 0;
    });

    const labels = Object.keys(byDate).slice(-14); // Last 14 days
    const data = Object.values(byDate).slice(-14);

    return { labels, datasets: [{ data }] };
  };

  const progress = Math.min((todayIntake / dailyGoal) * 100, 100);
  const weeklyData = getWeeklyData();
  const milestones = calculateMilestones();
  const weeklyChartData = prepareWeeklyChartData();
  const dailyChartData = prepareDailyChartData();

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="bg-primary rounded-t-[20px] px-6 py-6 flex-row justify-between items-center">
        <Text className="text-lg font-bold text-white flex-1">Water Intake</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} className="px-4 py-2">
          <Text className="text-base text-white font-semibold">✕</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View className="flex-row border-b border-gray-200 bg-white">
        <TouchableOpacity
          className={`flex-1 py-3 items-center border-b-2 ${
            activeTab === 'track' ? 'border-primary' : 'border-transparent'
          }`}
          onPress={() => setActiveTab('track')}
        >
          <Text className={`text-sm font-semibold ${activeTab === 'track' ? 'text-primary' : 'text-gray-500'}`}>
            Track
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          className={`flex-1 py-3 items-center border-b-2 ${
            activeTab === 'history' ? 'border-primary' : 'border-transparent'
          }`}
          onPress={() => setActiveTab('history')}
        >
          <Text className={`text-sm font-semibold ${activeTab === 'history' ? 'text-primary' : 'text-gray-500'}`}>
            History & Graphs
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          className={`flex-1 py-3 items-center border-b-2 ${
            activeTab === 'milestones' ? 'border-primary' : 'border-transparent'
          }`}
          onPress={() => setActiveTab('milestones')}
        >
          <Text className={`text-sm font-semibold ${activeTab === 'milestones' ? 'text-primary' : 'text-gray-500'}`}>
            Milestones
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
            {/* Track Tab */}
            {activeTab === 'track' && (
              <>
                {/* Progress Circle */}
                <View className="items-center mb-8">
                  <View className="w-48 h-48 rounded-full bg-blue-100 border-8 border-primary items-center justify-center mb-5">
                    <Text className="text-5xl font-bold text-primary">{todayIntake}</Text>
                    <Text className="text-lg text-gray-600 mt-1">ml</Text>
                    <Text className="text-sm text-gray-500 mt-1">of {dailyGoal} ml</Text>
                  </View>
                  {/* Progress Bar */}
                  <View className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    <View 
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${progress}%` }}
                    />
                  </View>
                  <Text className="text-sm text-gray-600 mt-2">
                    {Math.round(progress)}% of daily goal
                  </Text>
                </View>

                {/* Quick Add Buttons */}
                <View className="mb-6">
                  <Text className="text-lg font-semibold text-gray-800 mb-4">Quick Add</Text>
                  <View className="flex-row gap-3">
                    <TouchableOpacity
                      className="flex-1 py-4 bg-primary rounded-xl items-center"
                      onPress={() => handleAddWater(250)}
                      disabled={loading}
                      activeOpacity={0.8}
                    >
                      {loading ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text className="text-white text-base font-semibold">+250ml</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      className="flex-1 py-4 bg-primary rounded-xl items-center"
                      onPress={() => handleAddWater(500)}
                      disabled={loading}
                      activeOpacity={0.8}
                    >
                      {loading ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text className="text-white text-base font-semibold">+500ml</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      className="flex-1 py-4 bg-primary rounded-xl items-center"
                      onPress={() => handleAddWater(750)}
                      disabled={loading}
                      activeOpacity={0.8}
                    >
                      {loading ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text className="text-white text-base font-semibold">+750ml</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Custom Amount */}
                {showCustomInput ? (
                  <View className="mb-6">
                    <Text className="text-base font-semibold text-gray-800 mb-2">Custom Amount (ml)</Text>
                    <View className="flex-row gap-2">
                      <TextInput
                        className="flex-1 border border-gray-300 rounded-lg p-3 text-base bg-white"
                        placeholder="Enter amount"
                        value={customAmount}
                        onChangeText={setCustomAmount}
                        keyboardType="number-pad"
                      />
                      <TouchableOpacity
                        className="px-4 py-3 bg-primary rounded-lg items-center justify-center"
                        onPress={handleCustomAdd}
                        disabled={loading}
                        activeOpacity={0.8}
                      >
                        <Text className="text-white font-semibold">Add</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        className="px-4 py-3 bg-gray-300 rounded-lg items-center justify-center"
                        onPress={() => {
                          setShowCustomInput(false);
                          setCustomAmount('');
                        }}
                        activeOpacity={0.8}
                      >
                        <Text className="text-gray-700 font-semibold">Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity
                    className="py-4 bg-gray-50 border-2 border-gray-300 rounded-xl items-center mb-6"
                    onPress={() => setShowCustomInput(true)}
                    activeOpacity={0.8}
                  >
                    <Text className="text-primary text-base font-semibold">Add Custom Amount</Text>
                  </TouchableOpacity>
                )}

                {/* Today's Intake History */}
                {intakeHistory.filter(log => {
                  const logDate = startOfDay(new Date(log.recorded_at));
                  return logDate.getTime() === startOfDay(new Date()).getTime();
                }).length > 0 && (
                  <View className="pt-6 border-t border-gray-300">
                    <Text className="text-lg font-semibold text-gray-800 mb-4">Today's Intake</Text>
                    {intakeHistory
                      .filter(log => {
                        const logDate = startOfDay(new Date(log.recorded_at));
                        return logDate.getTime() === startOfDay(new Date()).getTime();
                      })
                      .sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at))
                      .map((log, index) => {
                        const data = typeof log.data === 'string' ? JSON.parse(log.data) : log.data;
                        return (
                          <View key={log.id || index} className="flex-row justify-between items-center p-3 bg-gray-50 rounded-lg mb-2">
                            <Text className="text-base font-semibold text-gray-800">+{data.amount}ml</Text>
                            <Text className="text-sm text-gray-600">
                              {format(parseISO(log.recorded_at), 'HH:mm')}
                            </Text>
                          </View>
                        );
                      })}
                  </View>
                )}
              </>
            )}

            {/* History & Graphs Tab */}
            {activeTab === 'history' && (
              <>
                {/* Week Selector */}
                <View className="mb-6 flex-row gap-2 items-center justify-between">
                  <TouchableOpacity
                    className="px-4 py-2 bg-gray-100 rounded-lg"
                    onPress={() => setSelectedWeek(selectedWeek + 1)}
                  >
                    <Text className="text-gray-700 font-medium">← Prev Week</Text>
                  </TouchableOpacity>
                  <Text className="text-base font-semibold text-gray-800">
                    {selectedWeek === 0 ? 'This Week' : selectedWeek === -1 ? 'Last Week' : `${Math.abs(selectedWeek)} weeks ago`}
                  </Text>
                  <TouchableOpacity
                    className="px-4 py-2 bg-gray-100 rounded-lg"
                    onPress={() => setSelectedWeek(Math.max(selectedWeek - 1, 0))}
                    disabled={selectedWeek === 0}
                  >
                    <Text className={`font-medium ${selectedWeek === 0 ? 'text-gray-400' : 'text-gray-700'}`}>
                      Next Week →
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Weekly Chart */}
                {weeklyChartData.labels.length > 0 && (
                  <View className="mb-6">
                    <Text className="text-base font-semibold text-gray-800 mb-3 px-1">
                      Weekly Intake (ml)
                    </Text>
                    <LineChart
                      data={{
                        labels: weeklyChartData.labels,
                        datasets: weeklyChartData.datasets,
                      }}
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
                    <Text className="text-xs text-gray-500 text-center mt-2">
                      Blue line: Your intake | Green line: Daily goal
                    </Text>
                  </View>
                )}

                {/* Daily Chart (Last 14 days) */}
                {dailyChartData.labels.length > 0 && (
                  <View className="mb-6">
                    <Text className="text-base font-semibold text-gray-800 mb-3 px-1">
                      Daily Intake - Last 14 Days (ml)
                    </Text>
                    <BarChart
                      data={dailyChartData}
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
                      yAxisSuffix="ml"
                      verticalLabelRotation={45}
                    />
                  </View>
                )}

                {/* Weekly Data Table */}
                <View className="mb-6 pt-6 border-t border-gray-300">
                  <Text className="text-lg font-semibold text-gray-800 mb-4">Weekly Breakdown</Text>
                  {weeklyData.map((day, index) => (
                    <View key={index} className={`p-3 rounded-lg mb-2 flex-row justify-between items-center ${
                      day.achieved ? 'bg-green-50 border border-green-200' : 'bg-gray-50'
                    }`}>
                      <View className="flex-1">
                        <Text className="text-base font-medium text-gray-800">
                          {format(day.date, 'EEEE, MMM d')}
                        </Text>
                        <Text className="text-sm text-gray-600">
                          {day.intake}ml / {day.goal}ml
                        </Text>
                      </View>
                      {day.achieved ? (
                        <Text className="text-green-600 font-semibold">✓ Goal Met</Text>
                      ) : (
                        <Text className="text-gray-500">
                          {Math.round((day.intake / day.goal) * 100)}%
                        </Text>
                      )}
                    </View>
                  ))}
                </View>
              </>
            )}

            {/* Milestones Tab */}
            {activeTab === 'milestones' && (
              <>
                <Text className="text-base font-semibold text-gray-800 mb-4">
                  Your Achievements 🎉
                </Text>
                {milestones.length === 0 ? (
                  <View className="p-6 items-center">
                    <Text className="text-base text-gray-500 text-center">
                      Start tracking your water intake to unlock milestones!
                    </Text>
                  </View>
                ) : (
                  milestones.map((milestone, index) => (
                    <View
                      key={index}
                      className={`p-4 rounded-lg mb-4 border-2 ${
                        milestone.achieved
                          ? 'bg-yellow-50 border-yellow-300'
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <View className="flex-row items-center mb-2">
                        <Text className="text-3xl mr-3">{milestone.icon}</Text>
                        <View className="flex-1">
                          <Text className="text-lg font-bold text-gray-800">
                            {milestone.title}
                          </Text>
                          <Text className="text-sm text-gray-600 mt-1">
                            {milestone.description}
                          </Text>
                        </View>
                        {milestone.achieved && (
                          <View className="bg-yellow-400 rounded-full px-3 py-1">
                            <Text className="text-white text-xs font-bold">⭐</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  ))
                )}

                {/* Goal Setting */}
                <View className="mt-6 pt-6 border-t border-gray-300">
                  <Text className="text-base font-semibold text-gray-800 mb-3">Daily Goal (ml)</Text>
                  <View className="flex-row gap-2">
                    {[1500, 2000, 2500, 3000].map((goal) => (
                      <TouchableOpacity
                        key={goal}
                        className={`flex-1 py-3 px-4 rounded-lg border items-center ${
                          dailyGoal === goal
                            ? 'bg-primary border-primary'
                            : 'bg-gray-50 border-gray-300'
                        }`}
                        onPress={async () => {
                          setDailyGoal(goal);
                          await AsyncStorage.setItem('waterIntakeGoal', goal.toString());
                        }}
                      >
                        <Text className={`text-sm font-medium ${
                          dailyGoal === goal ? 'text-white' : 'text-gray-600'
                        }`}>
                          {goal}ml
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text className="text-xs text-gray-500 mt-2">
                    Recommended: 2000ml (8 glasses) per day
                  </Text>
                </View>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default WaterIntakeScreen;

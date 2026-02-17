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
import { format, subDays, parseISO } from 'date-fns';
import { LineChart } from 'react-native-chart-kit';
import databaseService from '../services/databaseService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clerkAxios } from '../utils/clerkAxios';
import syncService from '../services/syncService';

const screenWidth = Dimensions.get('window').width;

const VITALS_OPTIONS = [
  { key: 'weight', label: 'Weight', unit: 'kg', color: '#90CDF4', icon: 'scale' },
  { key: 'blood_pressure_systolic', label: 'Blood Pressure (Systolic)', unit: 'mmHg', color: '#90CDF4', icon: 'healing' },
  { key: 'blood_pressure_diastolic', label: 'Blood Pressure (Diastolic)', unit: 'mmHg', color: '#90CDF4', icon: 'healing' },
  { key: 'blood_glucose', label: 'Blood Glucose', unit: 'mg/dL', color: '#90CDF4', icon: 'water-drop' },
  { key: 'heart_rate', label: 'Heart Rate', unit: 'bpm', color: '#90CDF4', icon: 'favorite' },
  { key: 'temperature', label: 'Temperature', unit: '°C', color: '#90CDF4', icon: 'device-thermostat' },
];

const VitalsTrackingScreen = ({ navigation }) => {
  const { userId } = useAuth();
  const [activeTab, setActiveTab] = useState('log'); // 'log', 'charts', 'settings'
  const [weight, setWeight] = useState('');
  const [bloodPressureSystolic, setBloodPressureSystolic] = useState('');
  const [bloodPressureDiastolic, setBloodPressureDiastolic] = useState('');
  const [bloodGlucose, setBloodGlucose] = useState('');
  const [heartRate, setHeartRate] = useState('');
  const [temperature, setTemperature] = useState('');
  const [notes, setNotes] = useState('');
  const [vitalsHistory, setVitalsHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [trackedVitals, setTrackedVitals] = useState({
    weight: true,
    blood_pressure_systolic: true,
    blood_pressure_diastolic: true,
    blood_glucose: true,
    heart_rate: true,
    temperature: true,
  });
  const [chartPeriod, setChartPeriod] = useState(7); // days
  const scrollViewRef = useRef(null);

  useEffect(() => {
    loadTrackedVitals();
    loadVitalsHistory();
  }, []);

  useEffect(() => {
    if (activeTab === 'charts') {
      loadVitalsHistory(); // Reload for charts
    }
  }, [activeTab, chartPeriod]);

  const loadTrackedVitals = async () => {
    try {
      const stored = await AsyncStorage.getItem('trackedVitals');
      if (stored) {
        setTrackedVitals(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading tracked vitals:', error);
    }
  };

  const saveTrackedVitals = async (newTrackedVitals) => {
    try {
      await AsyncStorage.setItem('trackedVitals', JSON.stringify(newTrackedVitals));
      setTrackedVitals(newTrackedVitals);
      Alert.alert('Success', 'Vitals settings updated');
    } catch (error) {
      console.error('Error saving tracked vitals:', error);
      Alert.alert('Error', 'Failed to save settings');
    }
  };

  const loadVitalsHistory = async () => {
    try {
      const currentUserId = userId || 'guest';

      // Load from local database
      if (Platform.OS !== 'web') {
        const localVitals = await databaseService.getVitalsLogs(userId);
        // Sort by date descending
        const sorted = localVitals.sort((a, b) => 
          new Date(b.recorded_at) - new Date(a.recorded_at)
        );
        setVitalsHistory(sorted);
      } else {
        setVitalsHistory([]);
      }

      // Try to sync and fetch latest from server (if online and authenticated)
      if (userId !== 'guest') {
        const online = await syncService.isOnline();
        if (online) {
          try {
            const response = await clerkAxios.get('/vitals');

            if (response.data.success && response.data.vitals) {
              const serverVitals = response.data.vitals || [];
              
              // Update local database with server data
              if (Platform.OS !== 'web') {
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
              } else {
                setVitalsHistory(serverVitals.sort((a, b) => 
                  new Date(b.recorded_at) - new Date(a.recorded_at)
                ));
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

    setLoading(true);
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
        notes: notes.trim() || null,
        recorded_at: new Date().toISOString(),
      };

      // Save to local database
      if (Platform.OS !== 'web') {
        await databaseService.saveVitalsLog(vitalsData);
      }

      // Sync to server if authenticated
      if (userId !== 'guest') {
        const online = await syncService.isOnline();
        if (online) {
          try {
            await clerkAxios.post('/vitals', vitalsData);
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
      setNotes('');

      Alert.alert('Success', 'Vitals recorded successfully');
      loadVitalsHistory();
      setActiveTab('charts'); // Switch to charts to see the new data
    } catch (error) {
      console.error('Error saving vitals:', error);
      Alert.alert('Error', 'Failed to save vitals');
    } finally {
      setLoading(false);
    }
  };

  // Prepare chart data for a specific vital
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

  const renderChart = (vitalKey, label, unit, color) => {
    if (!trackedVitals[vitalKey]) return null;

    const chartData = prepareChartData(vitalKey);
    if (!chartData) {
      return (
        <View key={vitalKey} className="mb-6 bg-white rounded-xl p-4">
          <Text className="text-base font-semibold text-gray-900 mb-2">{label} ({unit})</Text>
          <Text className="text-sm text-gray-500">No data available for the selected period</Text>
        </View>
      );
    }

    return (
      <View key={vitalKey} className="mb-6 bg-white rounded-xl p-4">
        <Text className="text-base font-semibold text-gray-900 mb-3">
          {label} ({unit})
        </Text>
        <LineChart
          data={{
            labels: chartData.labels,
            datasets: chartData.datasets,
          }}
          width={screenWidth - 80}
          height={220}
          chartConfig={{
            backgroundColor: '#ffffff',
            backgroundGradientFrom: '#ffffff',
            backgroundGradientTo: '#ffffff',
            decimalPlaces: vitalKey === 'weight' || vitalKey === 'temperature' || vitalKey === 'blood_glucose' ? 1 : 0,
            color: (opacity = 1) => color || `rgba(144, 205, 244, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
            style: {
              borderRadius: 16,
            },
            propsForDots: {
              r: '4',
              strokeWidth: '2',
              stroke: color || '#90CDF4',
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

  const canContinue = weight || bloodPressureSystolic || bloodGlucose || heartRate || temperature;
  const enabledVitals = VITALS_OPTIONS.filter(v => trackedVitals[v.key]);

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
        <Text className="text-2xl font-bold text-gray-900 flex-1">Track Vitals</Text>
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
            Charts
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          className={`flex-1 py-3 items-center border-b-2 ${
            activeTab === 'settings' ? '' : 'border-transparent'
          }`}
          style={{ borderBottomColor: activeTab === 'settings' ? '#90CDF4' : 'transparent' }}
          onPress={() => setActiveTab('settings')}
          activeOpacity={0.7}
        >
          <Text 
            className="text-sm font-semibold"
            style={{ color: activeTab === 'settings' ? '#90CDF4' : '#999' }}
          >
            Settings
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
                {enabledVitals.length === 0 && (
                  <View className="mb-6 p-4 bg-yellow-50 rounded-xl">
                    <Text className="text-sm text-yellow-800">
                      No vitals are currently enabled. Go to Settings to enable vitals you want to track.
                    </Text>
                  </View>
                )}

                {trackedVitals.weight && (
                  <View className="mb-6">
                    <Text className="text-sm font-semibold text-gray-600 mb-2">Weight (kg)</Text>
                    <TextInput
                      className="bg-gray-50 rounded-xl p-4 text-base"
                      placeholder="Enter weight"
                      placeholderTextColor="#999"
                      value={weight}
                      onChangeText={setWeight}
                      keyboardType="decimal-pad"
                    />
                  </View>
                )}

                {trackedVitals.blood_pressure_systolic && (
                  <View className="mb-6">
                    <Text className="text-sm font-semibold text-gray-600 mb-2">Blood Pressure (mmHg)</Text>
                    <View className="flex-row items-center gap-3">
                      <TextInput
                        className="flex-1 bg-gray-50 rounded-xl p-4 text-base"
                        placeholder="Systolic"
                        placeholderTextColor="#999"
                        value={bloodPressureSystolic}
                        onChangeText={setBloodPressureSystolic}
                        keyboardType="number-pad"
                      />
                      <Text className="text-xl text-gray-600">/</Text>
                      <TextInput
                        className="flex-1 bg-gray-50 rounded-xl p-4 text-base"
                        placeholder="Diastolic"
                        placeholderTextColor="#999"
                        value={bloodPressureDiastolic}
                        onChangeText={setBloodPressureDiastolic}
                        keyboardType="number-pad"
                      />
                    </View>
                  </View>
                )}

                {trackedVitals.blood_glucose && (
                  <View className="mb-6">
                    <Text className="text-sm font-semibold text-gray-600 mb-2">Blood Glucose (mg/dL)</Text>
                    <TextInput
                      className="bg-gray-50 rounded-xl p-4 text-base"
                      placeholder="Enter blood glucose"
                      placeholderTextColor="#999"
                      value={bloodGlucose}
                      onChangeText={setBloodGlucose}
                      keyboardType="decimal-pad"
                    />
                  </View>
                )}

                {trackedVitals.heart_rate && (
                  <View className="mb-6">
                    <Text className="text-sm font-semibold text-gray-600 mb-2">Heart Rate (bpm)</Text>
                    <TextInput
                      className="bg-gray-50 rounded-xl p-4 text-base"
                      placeholder="Enter heart rate"
                      placeholderTextColor="#999"
                      value={heartRate}
                      onChangeText={setHeartRate}
                      keyboardType="number-pad"
                    />
                  </View>
                )}

                {trackedVitals.temperature && (
                  <View className="mb-6">
                    <Text className="text-sm font-semibold text-gray-600 mb-2">Temperature (°C)</Text>
                    <TextInput
                      className="bg-gray-50 rounded-xl p-4 text-base"
                      placeholder="Enter temperature"
                      placeholderTextColor="#999"
                      value={temperature}
                      onChangeText={setTemperature}
                      keyboardType="decimal-pad"
                    />
                  </View>
                )}

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

                {/* Recent Records */}
                {vitalsHistory.length > 0 && (
                  <View className="mb-6 pt-6 border-t border-gray-200">
                    <Text className="text-lg font-bold text-gray-900 mb-4">Recent Records</Text>
                    {vitalsHistory.slice(0, 5).map((vital, index) => (
                      <View key={vital.id || index} className="bg-white rounded-xl p-4 mb-3">
                        <Text className="text-sm font-semibold text-gray-600 mb-2">
                          {format(parseISO(vital.recorded_at), 'MMM d, yyyy • HH:mm')}
                        </Text>
                        <View className="flex-row flex-wrap gap-3">
                          {vital.weight && trackedVitals.weight && (
                            <Text className="text-sm text-gray-800">Weight: {vital.weight} kg</Text>
                          )}
                          {vital.blood_pressure_systolic && vital.blood_pressure_diastolic && 
                           trackedVitals.blood_pressure_systolic && (
                            <Text className="text-sm text-gray-800">
                              BP: {vital.blood_pressure_systolic}/{vital.blood_pressure_diastolic} mmHg
                            </Text>
                          )}
                          {vital.blood_glucose && trackedVitals.blood_glucose && (
                            <Text className="text-sm text-gray-800">Glucose: {vital.blood_glucose} mg/dL</Text>
                          )}
                          {vital.heart_rate && trackedVitals.heart_rate && (
                            <Text className="text-sm text-gray-800">HR: {vital.heart_rate} bpm</Text>
                          )}
                          {vital.temperature && trackedVitals.temperature && (
                            <Text className="text-sm text-gray-800">Temp: {vital.temperature} °C</Text>
                          )}
                        </View>
                        {vital.notes && (
                          <Text className="text-xs text-gray-600 mt-2 italic">{vital.notes}</Text>
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}

            {/* Charts Tab */}
            {activeTab === 'charts' && (
              <>
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

                {enabledVitals.length === 0 ? (
                  <View className="p-4 bg-yellow-50 rounded-xl">
                    <Text className="text-sm text-yellow-800 text-center">
                      No vitals enabled. Go to Settings to enable vitals you want to track.
                    </Text>
                  </View>
                ) : (
                  enabledVitals.map(vital => {
                    if (vital.key === 'blood_pressure_systolic') {
                      return (
                        <View key={vital.key}>
                          {renderChart('blood_pressure_systolic', 'Blood Pressure (Systolic)', 'mmHg', '#90CDF4')}
                          {renderChart('blood_pressure_diastolic', 'Blood Pressure (Diastolic)', 'mmHg', '#90CDF4')}
                        </View>
                      );
                    } else if (vital.key === 'blood_pressure_diastolic') {
                      return null; // Already rendered with systolic
                    }
                    return renderChart(vital.key, vital.label, vital.unit, '#90CDF4');
                  })
                )}

                {vitalsHistory.length === 0 && (
                  <View className="p-6 items-center">
                    <Text className="text-base text-gray-500 text-center">
                      No vitals data recorded yet. Start logging your vitals to see charts here.
                    </Text>
                  </View>
                )}
              </>
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && (
              <>
                <Text className="text-base font-semibold text-gray-900 mb-4">
                  Select which vitals you want to track:
                </Text>
                {VITALS_OPTIONS.map((vital) => {
                  // Skip diastolic if systolic is shown (they're paired)
                  if (vital.key === 'blood_pressure_diastolic') {
                    return (
                      <TouchableOpacity
                        key={vital.key}
                        className="bg-white rounded-xl p-4 mb-3 flex-row items-center justify-between"
                        onPress={() => {
                          const updated = { ...trackedVitals };
                          // Always keep diastolic same as systolic for BP
                          updated[vital.key] = trackedVitals.blood_pressure_systolic;
                          saveTrackedVitals(updated);
                        }}
                        activeOpacity={0.7}
                      >
                        <View className="flex-1">
                          <Text className="text-base font-medium text-gray-900">{vital.label}</Text>
                          <Text className="text-xs text-gray-500 mt-1">
                            Automatically tracked with Systolic
                          </Text>
                        </View>
                        <View 
                          className="w-6 h-6 rounded items-center justify-center"
                          style={{
                            backgroundColor: trackedVitals[vital.key] ? '#90CDF4' : '#F5F5F5',
                            borderWidth: trackedVitals[vital.key] ? 0 : 2,
                            borderColor: '#E0E0E0',
                          }}
                        >
                          {trackedVitals[vital.key] && (
                            <MaterialIcons name="check" size={16} color="white" />
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  }
                  
                  return (
                    <TouchableOpacity
                      key={vital.key}
                      className="bg-white rounded-xl p-4 mb-3 flex-row items-center justify-between"
                      onPress={() => {
                        const updated = { ...trackedVitals };
                        updated[vital.key] = !updated[vital.key];
                        // If systolic is disabled, also disable diastolic
                        if (vital.key === 'blood_pressure_systolic' && !updated[vital.key]) {
                          updated.blood_pressure_diastolic = false;
                        }
                        // If systolic is enabled, also enable diastolic
                        if (vital.key === 'blood_pressure_systolic' && updated[vital.key]) {
                          updated.blood_pressure_diastolic = true;
                        }
                        saveTrackedVitals(updated);
                      }}
                      activeOpacity={0.7}
                    >
                      <View className="flex-1">
                        <Text className="text-base font-medium text-gray-900">{vital.label}</Text>
                        <Text className="text-xs text-gray-500 mt-1">{vital.unit}</Text>
                      </View>
                      <View 
                        className="w-6 h-6 rounded items-center justify-center"
                        style={{
                          backgroundColor: trackedVitals[vital.key] ? '#90CDF4' : '#F5F5F5',
                          borderWidth: trackedVitals[vital.key] ? 0 : 2,
                          borderColor: '#E0E0E0',
                        }}
                      >
                        {trackedVitals[vital.key] && (
                          <MaterialIcons name="check" size={16} color="white" />
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
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
            onPress={handleSaveVitals}
            disabled={!canContinue || loading}
            activeOpacity={0.7}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white text-base font-bold">Save Vitals</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

export default VitalsTrackingScreen;

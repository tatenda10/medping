import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Platform, Alert, Linking, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { format, startOfMonth, endOfMonth, subMonths, parseISO } from 'date-fns';
import databaseService from '../services/databaseService';
import { useAuthCheck } from '../hooks/useAuthCheck';
import CreateAccountPrompt from '../components/CreateAccountPrompt';
import { clerkAxios } from '../utils/clerkAxios';
import syncService from '../services/syncService';
import Svg, { Circle } from 'react-native-svg';

const MetricsScreen = ({ navigation: navProp }) => {
  const navigation = navProp || useNavigation();
  const { isAuthenticated } = useAuthCheck();
  const [showCreateAccountPrompt, setShowCreateAccountPrompt] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState(new Date());
  const [adherenceData, setAdherenceData] = useState({
    percentage: 0,
    taken: 0,
    missed: 0,
    total: 0,
  });
  const [averageVitals, setAverageVitals] = useState({
    bloodPressure: { systolic: null, diastolic: null, trend: null },
    heartRate: { value: null, trend: null },
    bloodGlucose: { value: null, trend: null },
  });
  const [downloadingPDF, setDownloadingPDF] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setShowCreateAccountPrompt(true);
    } else {
      loadData();
    }
  }, [isAuthenticated, selectedPeriod]);

  const loadData = async () => {
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

      // Load medications and dose logs
      const medications = await databaseService.getMedications(currentUserId);
      const allDoseLogs = await databaseService.getDoseLogs(currentUserId);

      // Load vitals
      let vitals = [];
      if (Platform.OS !== 'web') {
        vitals = await databaseService.getVitalsLogs(currentUserId);
      }

      // Try to sync from server if online
      const online = await syncService.isOnline();
      if (online) {
        try {
          // Sync medications
          const medResponse = await clerkAxios.get('/medications');
          if (medResponse.data.success) {
            for (const med of medResponse.data.medications || []) {
              await databaseService.saveMedication(med, false);
            }
          }

          // Sync vitals
          const vitalsResponse = await clerkAxios.get('/vitals');
          if (vitalsResponse.data.success && vitalsResponse.data.vitals) {
            for (const vital of vitalsResponse.data.vitals) {
              await databaseService.saveVitalsLog({ ...vital, user_id: currentUserId });
            }
            vitals = await databaseService.getVitalsLogs(currentUserId);
          }
        } catch (error) {
          console.log('Using local data');
        }
      }

      // Calculate adherence for selected month
      calculateAdherence(medications, allDoseLogs);
      
      // Calculate average vitals
      calculateAverageVitals(vitals);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateAdherence = (medications, doseLogs) => {
    const startDate = startOfMonth(selectedPeriod);
    const endDate = endOfMonth(selectedPeriod);
    
    // Get all scheduled doses for the month
    const scheduledDoses = [];
    medications.forEach(med => {
      if (!med.start_date) return;
      const medStart = new Date(med.start_date);
      const medEnd = med.is_continuous ? endDate : (med.end_date ? new Date(med.end_date) : endDate);
      
      if (medEnd < startDate || medStart > endDate) return;

      let times = med.times_of_day;
      if (typeof times === 'string') {
        try {
          times = JSON.parse(times);
        } catch (e) {
          return;
        }
      }
      if (!Array.isArray(times)) return;

      // Generate doses for each day in the month
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        if (d < medStart || (medEnd && d > medEnd)) continue;
        
        times.forEach(time => {
          const [hours, minutes] = time.split(':').map(Number);
          const scheduledDateTime = new Date(d);
          scheduledDateTime.setHours(hours, minutes, 0, 0);
          
          scheduledDoses.push({
            medication_id: med.id,
            scheduled_time: scheduledDateTime,
          });
        });
      }
    });

    // Count taken and missed
    let taken = 0;
    let missed = 0;

    scheduledDoses.forEach(scheduled => {
      const log = doseLogs.find(l => {
        const logDate = new Date(l.scheduled_time);
        const scheduledDate = new Date(scheduled.scheduled_time);
        return l.medication_id === scheduled.medication_id &&
               format(logDate, 'yyyy-MM-dd HH:mm') === format(scheduledDate, 'yyyy-MM-dd HH:mm');
      });

      if (log) {
        if (log.status === 'taken') taken++;
        else if (log.status === 'missed') missed++;
      } else {
        // If no log and time has passed, consider missed
        if (scheduled.scheduled_time < new Date()) {
          missed++;
        }
      }
    });

    const total = taken + missed;
    const percentage = total > 0 ? Math.round((taken / total) * 100) : 0;

    setAdherenceData({ percentage, taken, missed, total });
  };

  const calculateAverageVitals = (vitals) => {
    const startDate = startOfMonth(selectedPeriod);
    const endDate = endOfMonth(selectedPeriod);
    const prevStartDate = startOfMonth(subMonths(selectedPeriod, 1));
    const prevEndDate = endOfMonth(subMonths(selectedPeriod, 1));

    // Filter vitals for current month
    const currentVitals = vitals.filter(v => {
                  try {
                    const vDate = parseISO(v.recorded_at);
                    return vDate >= startDate && vDate <= endDate;
                  } catch (e) {
                    return false;
                  }
                });

    // Filter vitals for previous month
    const prevVitals = vitals.filter(v => {
      try {
        const vDate = parseISO(v.recorded_at);
        return vDate >= prevStartDate && vDate <= prevEndDate;
      } catch (e) {
        return false;
      }
    });

    // Calculate averages for current month
    const bpReadings = currentVitals.filter(v => v.blood_pressure_systolic && v.blood_pressure_diastolic);
    const hrReadings = currentVitals.filter(v => v.heart_rate);
    const glucoseReadings = currentVitals.filter(v => v.blood_glucose);

    // Calculate averages for previous month
    const prevBpReadings = prevVitals.filter(v => v.blood_pressure_systolic && v.blood_pressure_diastolic);
    const prevHrReadings = prevVitals.filter(v => v.heart_rate);
    const prevGlucoseReadings = prevVitals.filter(v => v.blood_glucose);

    // Blood Pressure
    let avgSystolic = null;
    let avgDiastolic = null;
    let bpTrend = null;
    if (bpReadings.length > 0) {
      avgSystolic = Math.round(bpReadings.reduce((sum, v) => sum + parseInt(v.blood_pressure_systolic), 0) / bpReadings.length);
      avgDiastolic = Math.round(bpReadings.reduce((sum, v) => sum + parseInt(v.blood_pressure_diastolic), 0) / bpReadings.length);
      
      if (prevBpReadings.length > 0) {
        const prevAvgSystolic = prevBpReadings.reduce((sum, v) => sum + parseInt(v.blood_pressure_systolic), 0) / prevBpReadings.length;
        const change = ((avgSystolic - prevAvgSystolic) / prevAvgSystolic) * 100;
        bpTrend = { value: Math.abs(change).toFixed(1), isPositive: change < 0 };
      }
    }

    // Heart Rate
    let avgHeartRate = null;
    let hrTrend = null;
    if (hrReadings.length > 0) {
      avgHeartRate = Math.round(hrReadings.reduce((sum, v) => sum + parseInt(v.heart_rate), 0) / hrReadings.length);
      
      if (prevHrReadings.length > 0) {
        const prevAvg = prevHrReadings.reduce((sum, v) => sum + parseInt(v.heart_rate), 0) / prevHrReadings.length;
        const change = Math.abs(avgHeartRate - prevAvg);
        hrTrend = change < 2 ? 'Stable' : null;
      }
    }

    // Blood Glucose
    let avgGlucose = null;
    let glucoseTrend = null;
    if (glucoseReadings.length > 0) {
      avgGlucose = Math.round(glucoseReadings.reduce((sum, v) => sum + parseFloat(v.blood_glucose), 0) / glucoseReadings.length);
      
      if (prevGlucoseReadings.length > 0) {
        const prevAvg = prevGlucoseReadings.reduce((sum, v) => sum + parseFloat(v.blood_glucose), 0) / prevGlucoseReadings.length;
        const change = ((avgGlucose - prevAvg) / prevAvg) * 100;
        glucoseTrend = { value: Math.abs(change).toFixed(1), isPositive: change < 0 };
      }
    }

    setAverageVitals({
      bloodPressure: { systolic: avgSystolic, diastolic: avgDiastolic, trend: bpTrend },
      heartRate: { value: avgHeartRate, trend: hrTrend },
      bloodGlucose: { value: avgGlucose, trend: glucoseTrend },
    });
  };

  const handleDownloadPDF = async () => {
    if (downloadingPDF) return;
    
    setDownloadingPDF(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        Alert.alert('Error', 'Please log in to download reports');
        setDownloadingPDF(false);
      return;
    }

      const month = selectedPeriod.getMonth() + 1;
      const year = selectedPeriod.getFullYear();
      const url = `${BASE_URL}/reports/pdf?month=${month}&year=${year}`;

      if (Platform.OS === 'web') {
        // For web, fetch and download
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to download PDF');
        }

        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `health-report-${year}-${String(month).padStart(2, '0')}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
      } else {
        // For mobile, download and save using FileSystem
        const monthStr = String(month).padStart(2, '0');
        const fileName = `health-report-${year}-${monthStr}.pdf`;
        const fileUri = `${FileSystem.documentDirectory}${fileName}`;

        // Download the PDF
        const downloadResult = await FileSystem.downloadAsync(url, fileUri, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (downloadResult.status === 200) {
          // Check if sharing is available
          const isAvailable = await Sharing.isAvailableAsync();
          if (isAvailable) {
            await Sharing.shareAsync(downloadResult.uri, {
              mimeType: 'application/pdf',
              dialogTitle: 'Share Health Report',
            });
          } else {
            Alert.alert('Success', 'PDF downloaded successfully!');
          }
        } else {
          throw new Error('Failed to download PDF');
        }
      }
    } catch (error) {
      console.error('Error downloading PDF:', error);
      Alert.alert('Error', 'Failed to download PDF report. Please try again.');
    } finally {
      setDownloadingPDF(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-1 justify-center items-center px-5">
          <Text className="text-lg text-gray-600 text-center mb-4">
            Please create an account to access health reports
          </Text>
        </View>
        <CreateAccountPrompt
          visible={showCreateAccountPrompt}
          onClose={() => setShowCreateAccountPrompt(false)}
          message="Create an account to view your health reports and analytics."
        />
      </SafeAreaView>
    );
  }

  const periodStart = format(startOfMonth(selectedPeriod), 'MMM dd');
  const periodEnd = format(endOfMonth(selectedPeriod), 'MMM dd, yyyy');
  const periodLabel = `${periodStart} - ${periodEnd}`;

  // Calculate circular progress
  const radius = 60;
  const strokeWidth = 12;
  const circumference = 2 * Math.PI * radius;
  const progress = adherenceData.percentage / 100;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
      {/* Header */}
        <View className="flex-row items-center px-5 pt-4 pb-3">
          <TouchableOpacity 
            className="w-10 h-10 rounded-full bg-gray-100 justify-center items-center mr-3"
            onPress={() => navigation.goBack()}
          >
            <MaterialIcons name="arrow-back" size={24} color="#666" />
        </TouchableOpacity>
          <Text className="text-2xl font-bold text-gray-900 flex-1">Health Reports</Text>
      </View>

        {/* Selected Period Card */}
        <View className="mx-5 mb-5 bg-gray-50 rounded-xl p-4 flex-row justify-between items-center">
          <View>
            <Text className="text-xs text-gray-600 mb-1">SELECTED PERIOD</Text>
            <Text className="text-base font-semibold text-gray-900">{periodLabel}</Text>
          </View>
          <TouchableOpacity 
            className="w-10 h-10 rounded-full justify-center items-center"
            style={{ backgroundColor: '#90CDF4' }}
            onPress={() => {
              // TODO: Open date picker
            }}
          >
            <MaterialIcons name="calendar-today" size={20} color="white" />
                  </TouchableOpacity>
                </View>

        {/* Medication Adherence Section */}
        <View className="px-5 mb-6">
          <Text className="text-xs text-gray-600 mb-4 uppercase tracking-wide">Medication Adherence</Text>
          <View className="bg-gray-50 rounded-xl p-6">
            <View className="flex-row items-center justify-between mb-6">
              {/* Circular Progress */}
              <View className="items-center">
                <View style={{ width: 140, height: 140 }}>
                  <Svg width={140} height={140}>
                    {/* Background circle */}
                    <Circle
                      cx={70}
                      cy={70}
                      r={radius}
                      stroke="#E5E7EB"
                      strokeWidth={strokeWidth}
                      fill="transparent"
                    />
                    {/* Progress circle */}
                    <Circle
                      cx={70}
                      cy={70}
                      r={radius}
                      stroke="#90CDF4"
                      strokeWidth={strokeWidth}
                      fill="transparent"
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                      transform={`rotate(-90 70 70)`}
                    />
                  </Svg>
                  <View className="absolute inset-0 justify-center items-center">
                    <Text className="text-3xl font-bold text-gray-900">{adherenceData.percentage}%</Text>
                    <Text className="text-sm text-gray-600">Monthly</Text>
                  </View>
                </View>
              </View>

              {/* Taken and Missed Counts */}
              <View className="flex-1 ml-6">
                <View className="bg-white rounded-lg p-4 mb-3 border border-gray-200">
                  <View className="flex-row items-center mb-2">
                    <MaterialIcons name="check-circle" size={20} color="#43A047" />
                    <Text className="text-sm text-gray-600 ml-2">Taken</Text>
                  </View>
                  <Text className="text-2xl font-bold text-gray-900">{adherenceData.taken}</Text>
                </View>
                <View className="bg-white rounded-lg p-4 border border-gray-200">
                  <View className="flex-row items-center mb-2">
                    <MaterialIcons name="cancel" size={20} color="#E53935" />
                    <Text className="text-sm text-gray-600 ml-2">Missed</Text>
                  </View>
                  <Text className="text-2xl font-bold text-gray-900">{adherenceData.missed}</Text>
                </View>
              </View>
                  </View>
                </View>
              </View>

        {/* Average Vitals Section */}
        <View className="px-5 mb-6">
          <Text className="text-xs text-gray-600 mb-4 uppercase tracking-wide">Average Vitals</Text>
          
          {/* Blood Pressure Card */}
          <View className="bg-white rounded-xl p-4 mb-3 border border-gray-200 flex-row items-center">
            <View className="w-12 h-12 rounded-lg justify-center items-center mr-3" style={{ backgroundColor: '#FCE4EC' }}>
              <MaterialIcons name="favorite" size={24} color="#E91E63" />
            </View>
            <View className="flex-1">
              <Text className="text-sm text-gray-600 mb-1">Blood Pressure</Text>
              <View className="flex-row items-baseline">
                <Text className="text-2xl font-bold text-gray-900">
                  {averageVitals.bloodPressure.systolic && averageVitals.bloodPressure.diastolic
                    ? `${averageVitals.bloodPressure.systolic}/${averageVitals.bloodPressure.diastolic}`
                    : '--'}
                    </Text>
                <Text className="text-sm text-gray-600 ml-2">mmHg</Text>
                          </View>
                        </View>
            {averageVitals.bloodPressure.trend && (
              <View className="flex-row items-center">
                <MaterialIcons 
                  name={averageVitals.bloodPressure.trend.isPositive ? "trending-down" : "trending-up"} 
                  size={20} 
                  color={averageVitals.bloodPressure.trend.isPositive ? "#43A047" : "#E53935"} 
                />
                <Text 
                  className="text-sm font-semibold ml-1"
                  style={{ color: averageVitals.bloodPressure.trend.isPositive ? "#43A047" : "#E53935" }}
                >
                  {averageVitals.bloodPressure.trend.value}%
                                  </Text>
                                </View>
                                )}
                              </View>

          {/* Heart Rate Card */}
          <View className="bg-white rounded-xl p-4 mb-3 border border-gray-200 flex-row items-center">
            <View className="w-12 h-12 rounded-lg justify-center items-center mr-3" style={{ backgroundColor: '#E0F2FE' }}>
              <MaterialIcons name="favorite" size={24} color="#90CDF4" />
            </View>
            <View className="flex-1">
              <Text className="text-sm text-gray-600 mb-1">Heart Rate</Text>
              <View className="flex-row items-baseline">
                <Text className="text-2xl font-bold text-gray-900">
                  {averageVitals.heartRate.value || '--'}
                              </Text>
                <Text className="text-sm text-gray-600 ml-2">BPM</Text>
                        </View>
                      </View>
            {averageVitals.heartRate.trend && (
              <View className="flex-row items-center">
                <View className="w-0.5 h-6 bg-gray-400" />
                <Text className="text-sm text-gray-600 ml-2">Stable</Text>
                        </View>
                      )}
                    </View>

          {/* Blood Glucose Card */}
          <View className="bg-white rounded-xl p-4 mb-3 border border-gray-200 flex-row items-center">
            <View className="w-12 h-12 rounded-lg justify-center items-center mr-3" style={{ backgroundColor: '#FFF3E0' }}>
              <MaterialIcons name="water-drop" size={24} color="#FF9800" />
            </View>
            <View className="flex-1">
              <Text className="text-sm text-gray-600 mb-1">Blood Glucose</Text>
              <View className="flex-row items-baseline">
                <Text className="text-2xl font-bold text-gray-900">
                  {averageVitals.bloodGlucose.value || '--'}
                </Text>
                <Text className="text-sm text-gray-600 ml-2">mg/dL</Text>
              </View>
                </View>
            {averageVitals.bloodGlucose.trend && (
              <View className="flex-row items-center">
                <MaterialIcons 
                  name={averageVitals.bloodGlucose.trend.isPositive ? "trending-down" : "trending-up"} 
                  size={20} 
                  color={averageVitals.bloodGlucose.trend.isPositive ? "#43A047" : "#E53935"} 
                />
                <Text 
                  className="text-sm font-semibold ml-1"
                  style={{ color: averageVitals.bloodGlucose.trend.isPositive ? "#43A047" : "#E53935" }}
                >
                  {averageVitals.bloodGlucose.trend.value}%
                </Text>
              </View>
          )}
          </View>
        </View>

        {/* Download PDF Button */}
        <TouchableOpacity
          className="mx-5 mb-8 rounded-xl p-4 flex-row items-center justify-center"
          style={{ backgroundColor: downloadingPDF ? '#B0BEC5' : '#90CDF4' }}
          onPress={handleDownloadPDF}
          activeOpacity={0.7}
          disabled={downloadingPDF}
        >
          {downloadingPDF ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <MaterialIcons name="picture-as-pdf" size={24} color="white" />
          )}
          <Text className="text-base font-bold text-white ml-2">
            {downloadingPDF ? 'Generating PDF...' : 'Download PDF Report'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <CreateAccountPrompt
        visible={showCreateAccountPrompt}
        onClose={() => setShowCreateAccountPrompt(false)}
        message="Create an account to view your health reports and analytics."
      />
    </SafeAreaView>
  );
};

export default MetricsScreen;

import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { format } from 'date-fns';
import databaseService from './databaseService';
import AsyncStorage from '@react-native-async-storage/async-storage';

class ExportService {
  /**
   * Convert array of objects to CSV string
   */
  arrayToCSV(data, headers) {
    if (!data || data.length === 0) {
      return headers.join(',') + '\n';
    }

    const csvRows = [];
    
    // Add headers
    csvRows.push(headers.join(','));
    
    // Add data rows
    data.forEach(row => {
      const values = headers.map(header => {
        const value = row[header] || '';
        // Escape commas and quotes in values
        if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      });
      csvRows.push(values.join(','));
    });
    
    return csvRows.join('\n');
  }

  /**
   * Export all user data to CSV files
   */
  async exportAllData(dateRange = null) {
    try {
      const userData = await AsyncStorage.getItem('userData');
      const user = userData ? JSON.parse(userData) : null;
      const userId = user?.id || user?.user?.id;

      if (!userId) {
        throw new Error('User not found');
      }

      const exportDir = `${FileSystem.documentDirectory}exports/`;
      await FileSystem.makeDirectoryAsync(exportDir, { intermediates: true });

      const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm-ss');
      const basePath = `${exportDir}mediping_export_${timestamp}`;

      // Export Medications
      const medications = await databaseService.getMedications(userId);
      const medicationCSV = this.exportMedications(medications);
      await FileSystem.writeAsStringAsync(`${basePath}_medications.csv`, medicationCSV);

      // Export Dose Logs
      const doseLogs = await databaseService.getDoseLogs(userId);
      const filteredDoseLogs = this.filterByDateRange(doseLogs, dateRange, 'scheduled_time');
      const doseLogCSV = this.exportDoseLogs(filteredDoseLogs);
      await FileSystem.writeAsStringAsync(`${basePath}_dose_logs.csv`, doseLogCSV);

      // Export Refills
      const refills = await databaseService.getRefills(userId);
      const filteredRefills = this.filterByDateRange(refills, dateRange, 'refill_date');
      const refillCSV = this.exportRefills(filteredRefills);
      await FileSystem.writeAsStringAsync(`${basePath}_refills.csv`, refillCSV);

      // Export Health Logs
      const healthLogs = await databaseService.getHealthLogs(userId);
      const filteredHealthLogs = this.filterByDateRange(healthLogs, dateRange, 'recorded_at');
      const healthLogCSV = this.exportHealthLogs(filteredHealthLogs);
      await FileSystem.writeAsStringAsync(`${basePath}_health_logs.csv`, healthLogCSV);

      // Create combined export file
      const combinedCSV = this.createCombinedExport({
        medications,
        doseLogs: filteredDoseLogs,
        refills: filteredRefills,
        healthLogs: filteredHealthLogs,
      });
      await FileSystem.writeAsStringAsync(`${basePath}_complete.csv`, combinedCSV);

      // Share the combined file
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(`${basePath}_complete.csv`, {
          mimeType: 'text/csv',
          dialogTitle: 'Export MediPing Data',
        });
      }

      return {
        success: true,
        files: [
          `${basePath}_medications.csv`,
          `${basePath}_dose_logs.csv`,
          `${basePath}_refills.csv`,
          `${basePath}_health_logs.csv`,
          `${basePath}_complete.csv`,
        ],
      };
    } catch (error) {
      console.error('Error exporting data:', error);
      throw error;
    }
  }

  /**
   * Filter data by date range
   */
  filterByDateRange(data, dateRange, dateField) {
    if (!dateRange || !dateRange.start || !dateRange.end) {
      return data;
    }

    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);
    end.setHours(23, 59, 59, 999); // Include entire end date

    return data.filter(item => {
      const itemDate = new Date(item[dateField]);
      return itemDate >= start && itemDate <= end;
    });
  }

  /**
   * Export medications to CSV
   */
  exportMedications(medications) {
    const headers = [
      'ID',
      'Name',
      'Dosage',
      'Type',
      'Frequency',
      'Times Per Day',
      'Times of Day',
      'Start Date',
      'End Date',
      'Is Continuous',
      'Food Instructions',
      'Notes',
      'Reason for Treatment',
      'Quantity Remaining',
      'Low Stock Threshold',
      'Created At',
    ];

    const rows = medications.map(med => ({
      'ID': med.id,
      'Name': med.name || '',
      'Dosage': med.dosage || '',
      'Type': med.medication_type || '',
      'Frequency': med.frequency || '',
      'Times Per Day': med.times_per_day || '',
      'Times of Day': Array.isArray(med.times_of_day) 
        ? med.times_of_day.join('; ') 
        : (typeof med.times_of_day === 'string' ? med.times_of_day : ''),
      'Start Date': med.start_date ? format(new Date(med.start_date), 'yyyy-MM-dd HH:mm:ss') : '',
      'End Date': med.end_date ? format(new Date(med.end_date), 'yyyy-MM-dd HH:mm:ss') : '',
      'Is Continuous': med.is_continuous ? 'Yes' : 'No',
      'Food Instructions': med.food_instructions || '',
      'Notes': med.notes || '',
      'Reason for Treatment': med.reason_for_treatment || '',
      'Quantity Remaining': med.quantity_remaining || '',
      'Low Stock Threshold': med.low_stock_threshold || '',
      'Created At': med.created_at ? format(new Date(med.created_at), 'yyyy-MM-dd HH:mm:ss') : '',
    }));

    return this.arrayToCSV(rows, headers);
  }

  /**
   * Export dose logs to CSV
   */
  exportDoseLogs(doseLogs) {
    const headers = [
      'ID',
      'Medication ID',
      'Scheduled Time',
      'Status',
      'Taken Time',
      'Notes',
      'Injection Site',
      'Created At',
    ];

    const rows = doseLogs.map(log => ({
      'ID': log.id,
      'Medication ID': log.medication_id || '',
      'Scheduled Time': log.scheduled_time ? format(new Date(log.scheduled_time), 'yyyy-MM-dd HH:mm:ss') : '',
      'Status': log.status || '',
      'Taken Time': log.taken_time ? format(new Date(log.taken_time), 'yyyy-MM-dd HH:mm:ss') : '',
      'Notes': log.notes || '',
      'Injection Site': log.injection_site || '',
      'Created At': log.created_at ? format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss') : '',
    }));

    return this.arrayToCSV(rows, headers);
  }

  /**
   * Export refills to CSV
   */
  exportRefills(refills) {
    const headers = [
      'ID',
      'Medication ID',
      'Quantity',
      'Refill Date',
      'Notes',
      'Created At',
    ];

    const rows = refills.map(refill => ({
      'ID': refill.id,
      'Medication ID': refill.medication_id || '',
      'Quantity': refill.quantity || '',
      'Refill Date': refill.refill_date ? format(new Date(refill.refill_date), 'yyyy-MM-dd HH:mm:ss') : '',
      'Notes': refill.notes || '',
      'Created At': refill.created_at ? format(new Date(refill.created_at), 'yyyy-MM-dd HH:mm:ss') : '',
    }));

    return this.arrayToCSV(rows, headers);
  }

  /**
   * Export health logs to CSV
   */
  exportHealthLogs(healthLogs) {
    const headers = [
      'ID',
      'Log Type',
      'Data',
      'Recorded At',
      'Created At',
    ];

    const rows = healthLogs.map(log => ({
      'ID': log.id,
      'Log Type': log.log_type || '',
      'Data': typeof log.data === 'object' ? JSON.stringify(log.data) : (log.data || ''),
      'Recorded At': log.recorded_at ? format(new Date(log.recorded_at), 'yyyy-MM-dd HH:mm:ss') : '',
      'Created At': log.created_at ? format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss') : '',
    }));

    return this.arrayToCSV(rows, headers);
  }

  /**
   * Create combined export with all data
   */
  createCombinedExport(data) {
    const sections = [];
    
    sections.push('=== MEDICATIONS ===');
    sections.push(this.exportMedications(data.medications));
    sections.push('\n');
    
    sections.push('=== DOSE LOGS ===');
    sections.push(this.exportDoseLogs(data.doseLogs));
    sections.push('\n');
    
    sections.push('=== REFILLS ===');
    sections.push(this.exportRefills(data.refills));
    sections.push('\n');
    
    sections.push('=== HEALTH LOGS ===');
    sections.push(this.exportHealthLogs(data.healthLogs));
    
    return sections.join('\n');
  }
}

export default new ExportService();


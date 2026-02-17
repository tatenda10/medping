import AsyncStorage from '@react-native-async-storage/async-storage';
import databaseService from './databaseService';
import axios from 'axios';
import BASE_URL from '../context/Api';

class OnboardingService {
  /**
   * Check if user has completed onboarding
   */
  async hasCompletedOnboarding() {
    try {
      const completed = await AsyncStorage.getItem('onboarding_completed');
      return completed === 'true';
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      return false;
    }
  }

  /**
   * Mark onboarding as completed
   */
  async markOnboardingCompleted() {
    try {
      await AsyncStorage.setItem('onboarding_completed', 'true');
    } catch (error) {
      console.error('Error marking onboarding completed:', error);
    }
  }

  /**
   * Complete onboarding (alias for markOnboardingCompleted)
   */
  async completeOnboarding() {
    return this.markOnboardingCompleted();
  }

  /**
   * Get questionnaire answers
   */
  async getQuestionnaireAnswers() {
    try {
      const answers = await AsyncStorage.getItem('onboarding_questionnaire');
      return answers ? JSON.parse(answers) : null;
    } catch (error) {
      console.error('Error getting questionnaire answers:', error);
      return null;
    }
  }

  /**
   * Get guest medications
   */
  async getGuestMedications() {
    try {
      await databaseService.ensureInitialized();
      const medications = await databaseService.getMedications('guest');
      return medications;
    } catch (error) {
      console.error('Error getting guest medications:', error);
      return [];
    }
  }

  /**
   * Migrate guest data to user account after signup
   */
  async migrateGuestDataToUser(userId, authToken) {
    try {
      // 1. Get questionnaire answers from AsyncStorage
      const questionnaireAnswers = await this.getQuestionnaireAnswers();

      // 2. Get guest medications
      const guestMedications = await this.getGuestMedications();

      // 3. Update medications: change user_id from 'guest' to actual userId
      for (const medication of guestMedications) {
        // Update in local database - use saveMedication with updated user_id
        const updatedMedication = {
          ...medication,
          user_id: userId,
        };
        await databaseService.saveMedication(updatedMedication, false);

        // Also migrate dose logs and refills for this medication
        try {
          await databaseService.ensureInitialized();
          if (databaseService.db) {
            // Update dose logs for this medication
            await databaseService.db.runAsync(
              `UPDATE dose_logs SET user_id = ? WHERE user_id = 'guest' AND medication_id = ?`,
              [userId, medication.id]
            );
            
            // Update refills for this medication
            await databaseService.db.runAsync(
              `UPDATE refills SET user_id = ? WHERE user_id = 'guest' AND medication_id = ?`,
              [userId, medication.id]
            );
          }
        } catch (migrationError) {
          console.log('Error migrating dose logs/refills for medication:', migrationError);
          // Continue with next medication
        }

        // Try to sync to server
        try {
          const medicationData = {
            ...updatedMedication,
            times_of_day: typeof updatedMedication.times_of_day === 'string'
              ? JSON.parse(updatedMedication.times_of_day)
              : updatedMedication.times_of_day,
          };
          delete medicationData.server_synced;
          delete medicationData.deleted;

          const { clerkAxios } = await import('../utils/clerkAxios');
          await clerkAxios.post(
            `/medications`,
            medicationData
          );
        } catch (error) {
          console.log('Medication sync failed, will retry later:', error);
        }
      }

      // 4. Migrate questionnaire answers from database (update user_id from 'guest' to userId)
      try {
        await databaseService.ensureInitialized();
        if (databaseService.db && questionnaireAnswers) {
          // Update existing guest questionnaire answers to user's ID
          await databaseService.db.runAsync(
            `UPDATE questionnaire_answers SET user_id = ? WHERE user_id = 'guest'`,
            [userId]
          );
        }
      } catch (error) {
        console.log('Error migrating questionnaire answers from database:', error);
        // If update fails, try to save new record
        if (questionnaireAnswers) {
          try {
            await databaseService.saveQuestionnaireAnswers(userId, questionnaireAnswers);
          } catch (saveError) {
            console.log('Error saving questionnaire answers to database:', saveError);
          }
        }
      }

      // 5. Save questionnaire answers to user profile on server (if server supports it)
      if (questionnaireAnswers) {
        try {
          const { clerkAxios } = await import('../utils/clerkAxios');
          await clerkAxios.post(
            `/user/profile`,
            {
              onboarding_questionnaire: questionnaireAnswers,
            }
          );
        } catch (error) {
          console.log('Questionnaire sync failed:', error);
          // Not critical, continue
        }
      }

      // 6. Clear guest data from AsyncStorage
      await this.clearGuestData();

      // 7. Mark onboarding as completed
      await this.markOnboardingCompleted();

      return {
        success: true,
        medicationsMigrated: guestMedications.length,
        questionnaireMigrated: !!questionnaireAnswers,
      };
    } catch (error) {
      console.error('Error migrating guest data:', error);
      throw error;
    }
  }

  /**
   * Clear guest data after migration
   */
  async clearGuestData() {
    try {
      // Clear questionnaire
      await AsyncStorage.removeItem('onboarding_questionnaire');

      // Note: We don't delete guest medications from DB, just update their user_id
      // This is handled in migrateGuestDataToUser
    } catch (error) {
      console.error('Error clearing guest data:', error);
    }
  }

  /**
   * Check if user has guest medications
   */
  async hasGuestMedications() {
    try {
      const medications = await this.getGuestMedications();
      return medications.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if user has any medications (guest or authenticated)
   */
  async hasAnyMedications(userId = null) {
    try {
      await databaseService.ensureInitialized();
      
      // Check guest medications
      const guestMedications = await databaseService.getMedications('guest');
      if (guestMedications.length > 0) {
        return true;
      }
      
      // If userId provided, check user medications
      if (userId) {
        const userMedications = await databaseService.getMedications(userId);
        if (userMedications.length > 0) {
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error('Error checking for medications:', error);
      return false;
    }
  }
}

export default new OnboardingService();


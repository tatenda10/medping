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
      // 1. Get questionnaire answers
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

          await axios.post(
            `${BASE_URL}/medications`,
            medicationData,
            {
              headers: { 'Authorization': `Bearer ${authToken}` },
            }
          );
        } catch (error) {
          console.log('Medication sync failed, will retry later:', error);
        }
      }

      // 4. Save questionnaire answers to user profile (if server supports it)
      if (questionnaireAnswers) {
        try {
          await axios.post(
            `${BASE_URL}/user/profile`,
            {
              onboarding_questionnaire: questionnaireAnswers,
            },
            {
              headers: { 'Authorization': `Bearer ${authToken}` },
            }
          );
        } catch (error) {
          console.log('Questionnaire sync failed:', error);
          // Not critical, continue
        }
      }

      // 5. Clear guest data
      await this.clearGuestData();

      // 6. Mark onboarding as completed
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
}

export default new OnboardingService();


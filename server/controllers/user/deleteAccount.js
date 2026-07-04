const { transaction } = require('../../config/mysql');

/**
 * Delete user account and all associated data
 */
const deleteAccount = async (req, res) => {
  try {
    const userId = req.user.id;

    await transaction(async (tx) => {
      // Caregiver relationships
      await tx.execute('DELETE FROM caregiver_relationships WHERE caregiver_id = ?', [userId]);
      await tx.execute('DELETE FROM caregiver_relationships WHERE care_recipient_id = ?', [userId]);

      // Notifications
      await tx.execute('DELETE FROM notifications WHERE user_id = ?', [userId]);

      // Vitals, appointments, health logs
      await tx.execute('DELETE FROM vitals_logs WHERE user_id = ?', [userId]);
      await tx.execute('DELETE FROM appointments WHERE user_id = ?', [userId]);
      await tx.execute('DELETE FROM health_logs WHERE user_id = ?', [userId]);

      // Refills, dose logs, medications
      await tx.execute('DELETE FROM refills WHERE user_id = ?', [userId]);
      await tx.execute('DELETE FROM dose_logs WHERE user_id = ?', [userId]);
      await tx.execute('DELETE FROM medications WHERE user_id = ?', [userId]);

      // Dependents
      await tx.execute('DELETE FROM dependents WHERE user_id = ?', [userId]);

      // Profile
      await tx.execute('DELETE FROM user_profiles WHERE user_id = ?', [userId]);

      // Finally user
      await tx.execute('DELETE FROM users WHERE id = ?', [userId]);
    });

    res.json({
      success: true,
      message: 'Account and all associated data deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete account',
      error: error.message,
    });
  }
};

module.exports = deleteAccount;


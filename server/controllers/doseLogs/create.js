const { query } = require('../../config/mysql');
const caregiverNotificationService = require('../../services/caregiverNotificationService');

const createDoseLog = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      medication_id,
      scheduled_time,
      status, // 'taken', 'missed', 'skipped'
      notes,
    } = req.body;

    // Validation
    if (!medication_id || !scheduled_time || !status) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: medication_id, scheduled_time, status',
      });
    }

    // Verify medication belongs to user
    const medicationRows = await query(
      'SELECT id FROM medications WHERE id = ? AND user_id = ? LIMIT 1',
      [medication_id, userId]
    );
    const medication = medicationRows?.[0] || null;

    if (!medication) {
      return res.status(404).json({
        success: false,
        message: 'Medication not found',
      });
    }

    const idRows = await query('SELECT UUID() as id');
    const doseLogId = idRows?.[0]?.id;

    // Create dose log
    await query(
      `INSERT INTO dose_logs (
         id, user_id, medication_id, scheduled_time, status, taken_time, notes, created_at
       ) VALUES (
         ?, ?, ?, ?, ?, ?, ?, NOW()
       )`,
      [
        doseLogId,
        userId,
        medication_id,
        new Date(scheduled_time),
        status,
        status === 'taken' ? new Date() : null,
        notes || null,
      ]
    );

    const doseRows = await query('SELECT * FROM dose_logs WHERE id = ? LIMIT 1', [doseLogId]);
    const doseLog = doseRows?.[0] || null;

    // Notify caregivers if dose was missed
    if (status === 'missed') {
      caregiverNotificationService.notifyMissedDose(userId, medication_id, scheduled_time)
        .catch(err => console.error('Error notifying caregivers:', err));
    }

    res.status(201).json({
      success: true,
      message: 'Dose logged successfully',
      doseLog,
    });
  } catch (error) {
    console.error('Error creating dose log:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to log dose',
      error: error.message,
    });
  }
};

module.exports = { createDoseLog };


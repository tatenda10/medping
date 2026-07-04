const { query } = require('../../config/mysql');

const createCaregiverDoseLog = async (req, res) => {
  try {
    const caregiverId = req.user.id; // The caregiver (current user)
    const {
      medication_id,
      care_recipient_id,
      scheduled_time,
      status, // 'taken', 'missed', 'skipped'
      notes,
    } = req.body;

    // Validation
    if (!medication_id || !care_recipient_id || !scheduled_time || !status) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: medication_id, care_recipient_id, scheduled_time, status',
      });
    }

    // Verify caregiver relationship exists and is accepted
    const relRows = await query(
      `SELECT id
       FROM caregiver_relationships
       WHERE caregiver_id = ? AND care_recipient_id = ? AND status = 'accepted'
       LIMIT 1`,
      [caregiverId, care_recipient_id]
    );
    const relationship = relRows?.[0] || null;

    if (!relationship) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this care recipient\'s medications',
      });
    }

    // Verify medication belongs to care recipient
    const medRows = await query(
      'SELECT id FROM medications WHERE id = ? AND user_id = ? LIMIT 1',
      [medication_id, care_recipient_id]
    );
    const medication = medRows?.[0] || null;

    if (!medication) {
      return res.status(404).json({
        success: false,
        message: 'Medication not found or does not belong to care recipient',
      });
    }

    // Check if dose log already exists for this time
    const scheduled = new Date(scheduled_time);
    const existingRows = await query(
      `SELECT *
       FROM dose_logs
       WHERE user_id = ? AND medication_id = ? AND scheduled_time = ?
       LIMIT 1`,
      [care_recipient_id, medication_id, scheduled]
    );
    const existingLog = existingRows?.[0] || null;

    let doseLog;

    if (existingLog) {
      // Update existing dose log
      await query(
        `UPDATE dose_logs
         SET status = ?, taken_time = ?, notes = ?
         WHERE id = ?`,
        [
          status,
          status === 'taken' ? new Date() : null,
          notes || existingLog.notes,
          existingLog.id,
        ]
      );
      const updatedRows = await query('SELECT * FROM dose_logs WHERE id = ? LIMIT 1', [
        existingLog.id,
      ]);
      doseLog = updatedRows?.[0] || null;
    } else {
      // Create new dose log with care recipient's user_id
      const idRows = await query('SELECT UUID() as id');
      const doseLogId = idRows?.[0]?.id;
      await query(
        `INSERT INTO dose_logs (id, user_id, medication_id, scheduled_time, status, taken_time, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          doseLogId,
          care_recipient_id,
          medication_id,
          scheduled,
          status,
          status === 'taken' ? new Date() : null,
          notes || null,
        ]
      );
      const rows = await query('SELECT * FROM dose_logs WHERE id = ? LIMIT 1', [doseLogId]);
      doseLog = rows?.[0] || null;
    }

    res.status(201).json({
      success: true,
      message: 'Dose logged successfully',
      doseLog,
    });
  } catch (error) {
    console.error('Error creating caregiver dose log:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to log dose',
      error: error.message,
    });
  }
};

module.exports = createCaregiverDoseLog;


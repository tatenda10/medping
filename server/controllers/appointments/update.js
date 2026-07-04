const { query } = require('../../config/mysql');

const updateAppointment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const updateData = req.body;

    // Verify appointment belongs to user
    const existingRows = await query(
      'SELECT * FROM appointments WHERE id = ? AND user_id = ? LIMIT 1',
      [id, userId]
    );
    const appointment = existingRows?.[0] || null;

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found',
      });
    }

    const fields = [];
    const params = [];

    const allowed = [
      'title',
      'doctor_name',
      'appointment_type',
      'scheduled_time',
      'location',
      'notes',
      'reminder_minutes',
    ];

    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(updateData, key)) {
        fields.push(`${key} = ?`);
        if (key === 'scheduled_time' && updateData.scheduled_time) {
          params.push(new Date(updateData.scheduled_time));
        } else {
          params.push(updateData[key]);
        }
      }
    }

    if (fields.length === 0) {
      return res.json({
        success: true,
        message: 'No changes',
        appointment,
      });
    }

    fields.push('updated_at = NOW()');
    params.push(id, userId);

    await query(
      `UPDATE appointments SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
      params
    );

    const updatedRows = await query('SELECT * FROM appointments WHERE id = ? LIMIT 1', [id]);
    const updated = updatedRows?.[0] || null;

    res.json({
      success: true,
      message: 'Appointment updated successfully',
      appointment: updated,
    });
  } catch (error) {
    console.error('Error updating appointment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update appointment',
      error: error.message,
    });
  }
};

module.exports = { updateAppointment };


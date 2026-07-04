const { query } = require('../../config/mysql');

const createAppointment = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      title,
      doctor_name,
      appointment_type,
      scheduled_time,
      location,
      notes,
      reminder_minutes,
    } = req.body;

    if (!title || !scheduled_time) {
      return res.status(400).json({
        success: false,
        message: 'Title and scheduled_time are required',
      });
    }

    const idRows = await query('SELECT UUID() as id');
    const id = idRows?.[0]?.id;

    await query(
      `INSERT INTO appointments (
         id, user_id, title, doctor_name, appointment_type, scheduled_time,
         location, notes, reminder_minutes, created_at, updated_at
       ) VALUES (
         ?, ?, ?, ?, ?, ?,
         ?, ?, ?, NOW(), NOW()
       )`,
      [
        id,
        userId,
        title,
        doctor_name || null,
        appointment_type || null,
        new Date(scheduled_time),
        location || null,
        notes || null,
        reminder_minutes ?? 60,
      ]
    );

    const rows = await query('SELECT * FROM appointments WHERE id = ? LIMIT 1', [id]);
    const appointment = rows?.[0] || null;

    res.status(201).json({
      success: true,
      message: 'Appointment created successfully',
      appointment,
    });
  } catch (error) {
    console.error('Error creating appointment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create appointment',
      error: error.message,
    });
  }
};

module.exports = { createAppointment };


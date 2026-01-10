const prisma = require('../../config/database');

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

    const appointment = await prisma.appointment.create({
      data: {
        user_id: userId,
        title,
        doctor_name: doctor_name || null,
        appointment_type: appointment_type || null,
        scheduled_time: new Date(scheduled_time),
        location: location || null,
        notes: notes || null,
        reminder_minutes: reminder_minutes || 60,
      },
    });

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


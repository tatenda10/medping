const prisma = require('../../config/database');
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
    const medication = await prisma.medication.findFirst({
      where: {
        id: medication_id,
        user_id: userId,
      },
    });

    if (!medication) {
      return res.status(404).json({
        success: false,
        message: 'Medication not found',
      });
    }

    // Create dose log
    const doseLog = await prisma.doseLog.create({
      data: {
        user_id: userId,
        medication_id,
        scheduled_time: new Date(scheduled_time),
        status,
        taken_time: status === 'taken' ? new Date() : null,
        notes: notes || null,
      },
    });

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


const prisma = require('../../config/database');

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
    const relationship = await prisma.caregiverRelationship.findFirst({
      where: {
        caregiver_id: caregiverId,
        care_recipient_id: care_recipient_id,
        status: 'accepted',
      },
    });

    if (!relationship) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this care recipient\'s medications',
      });
    }

    // Verify medication belongs to care recipient
    const medication = await prisma.medication.findFirst({
      where: {
        id: medication_id,
        user_id: care_recipient_id,
      },
    });

    if (!medication) {
      return res.status(404).json({
        success: false,
        message: 'Medication not found or does not belong to care recipient',
      });
    }

    // Check if dose log already exists for this time
    const existingLog = await prisma.doseLog.findFirst({
      where: {
        user_id: care_recipient_id,
        medication_id: medication_id,
        scheduled_time: new Date(scheduled_time),
      },
    });

    let doseLog;

    if (existingLog) {
      // Update existing dose log
      doseLog = await prisma.doseLog.update({
        where: { id: existingLog.id },
        data: {
          status,
          taken_time: status === 'taken' ? new Date() : null,
          notes: notes || existingLog.notes,
        },
      });
    } else {
      // Create new dose log with care recipient's user_id
      doseLog = await prisma.doseLog.create({
        data: {
          user_id: care_recipient_id, // Use care recipient's ID, not caregiver's
          medication_id,
          scheduled_time: new Date(scheduled_time),
          status,
          taken_time: status === 'taken' ? new Date() : null,
          notes: notes || null,
        },
      });
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


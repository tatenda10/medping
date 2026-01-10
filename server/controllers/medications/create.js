const prisma = require('../../config/database');
const caregiverNotificationService = require('../../services/caregiverNotificationService');

const createMedication = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      name,
      dosage,
      medication_type,
      frequency,
      times_per_day,
      times_of_day,
      start_date,
      end_date,
      is_continuous,
      food_instructions,
      notes,
      quantity_remaining,
      low_stock_threshold,
    } = req.body;

    // Validation
    if (!name || !dosage || !times_of_day || !start_date) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, dosage, times_of_day, start_date',
      });
    }

    if (!Array.isArray(times_of_day) || times_of_day.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'times_of_day must be a non-empty array',
      });
    }

    // Create medication
    const medication = await prisma.medication.create({
      data: {
        user: {
          connect: { id: userId },
        },
        name,
        dosage,
        medication_type: medication_type || 'tablet',
        frequency: frequency || 'daily',
        times_per_day: times_per_day || times_of_day.length,
        times_of_day: times_of_day,
        start_date: new Date(start_date),
        end_date: end_date ? new Date(end_date) : null,
        is_continuous: is_continuous !== undefined ? is_continuous : true,
        food_instructions: food_instructions || null,
        notes: notes || null,
        quantity_remaining: quantity_remaining || null,
        low_stock_threshold: low_stock_threshold || 7,
      },
    });

    // Notify caregivers about new medication
    caregiverNotificationService.notifyNewMedication(userId, medication.id)
      .catch(err => console.error('Error notifying caregivers:', err));

    res.status(201).json({
      success: true,
      message: 'Medication created successfully',
      medication,
    });
  } catch (error) {
    console.error('Error creating medication:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create medication',
      error: error.message,
    });
  }
};

module.exports = { createMedication };


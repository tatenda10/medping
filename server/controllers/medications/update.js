const prisma = require('../../config/database');

const updateMedication = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
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
      photo_url,
      quantity_remaining,
      low_stock_threshold,
    } = req.body;

    // Verify medication belongs to user
    const existingMedication = await prisma.medication.findFirst({
      where: {
        id: id,
        user_id: userId,
      },
    });

    if (!existingMedication) {
      return res.status(404).json({
        success: false,
        message: 'Medication not found',
      });
    }

    // Validation
    if (!name || !dosage || !times_of_day || !Array.isArray(times_of_day) || times_of_day.length === 0 || !start_date) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, dosage, times_of_day, start_date',
      });
    }

    // Derive frequency and times_per_day from times_of_day array if not provided
    let derivedFrequency = frequency || 'custom';
    let derivedTimesPerDay = times_per_day || times_of_day.length;

    if (times_of_day.length === 1) {
      derivedFrequency = 'daily';
    } else if (times_of_day.length === 24) {
      derivedFrequency = 'hourly';
    }

    // Update medication
    const updatedMedication = await prisma.medication.update({
      where: {
        id: id,
      },
      data: {
        name,
        dosage,
        medication_type: medication_type || 'tablet',
        frequency: derivedFrequency,
        times_per_day: derivedTimesPerDay,
        times_of_day: times_of_day,
        start_date: new Date(start_date),
        end_date: end_date ? new Date(end_date) : null,
        is_continuous: is_continuous !== undefined ? is_continuous : true,
        food_instructions: food_instructions || null,
        notes: notes || null,
        photo_url: photo_url || null,
        quantity_remaining: quantity_remaining || null,
        low_stock_threshold: low_stock_threshold || 7,
      },
    });

    res.json({
      success: true,
      message: 'Medication updated successfully',
      medication: updatedMedication,
    });
  } catch (error) {
    console.error('Error updating medication:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update medication',
      error: error.message,
    });
  }
};

module.exports = { updateMedication };


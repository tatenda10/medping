const { query } = require('../../config/mysql');
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
      reason_for_treatment,
      schedule_pattern,
      schedule_pattern_data,
      injection_site_data,
      photo_url,
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

    const medicationIdRows = await query('SELECT UUID() as id');
    const medicationId = medicationIdRows?.[0]?.id;

    // Create medication
    await query(
      `INSERT INTO medications (
         id, user_id, name, dosage, medication_type, frequency, times_per_day, times_of_day,
         start_date, end_date, is_continuous, food_instructions, notes, photo_url,
         quantity_remaining, low_stock_threshold, reason_for_treatment, schedule_pattern,
         schedule_pattern_data, injection_site_data, created_at, updated_at
       ) VALUES (
         ?, ?, ?, ?, ?, ?, ?, ?,
         ?, ?, ?, ?, ?, ?,
         ?, ?, ?, ?,
         ?, ?, NOW(), NOW()
       )`,
      [
        medicationId,
        userId,
        name,
        dosage,
        medication_type || 'tablet',
        frequency || 'daily',
        times_per_day || times_of_day.length,
        JSON.stringify(times_of_day),
        new Date(start_date),
        end_date ? new Date(end_date) : null,
        is_continuous !== undefined ? !!is_continuous : true,
        food_instructions || null,
        notes || null,
        photo_url || null,
        quantity_remaining ?? null,
        low_stock_threshold ?? 7,
        reason_for_treatment || null,
        schedule_pattern || 'daily',
        schedule_pattern_data ? JSON.stringify(schedule_pattern_data) : null,
        injection_site_data ? JSON.stringify(injection_site_data) : null,
      ]
    );

    const createdRows = await query('SELECT * FROM medications WHERE id = ? LIMIT 1', [
      medicationId,
    ]);
    const medication = createdRows?.[0] || null;
    if (medication && typeof medication.times_of_day === 'string') {
      try {
        medication.times_of_day = JSON.parse(medication.times_of_day);
      } catch (e) {}
    }

    // Notify caregivers about new medication
    caregiverNotificationService.notifyNewMedication(userId, medicationId)
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


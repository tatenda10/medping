const { query } = require('../../config/mysql');

function parseMedicationRow(row) {
  const med = { ...row };
  if (typeof med.times_of_day === 'string') {
    try {
      med.times_of_day = JSON.parse(med.times_of_day);
    } catch (e) {}
  }
  if (typeof med.schedule_pattern_data === 'string') {
    try {
      med.schedule_pattern_data = JSON.parse(med.schedule_pattern_data);
    } catch (e) {}
  }
  if (typeof med.injection_site_data === 'string') {
    try {
      med.injection_site_data = JSON.parse(med.injection_site_data);
    } catch (e) {}
  }
  return med;
}

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
      reason_for_treatment,
      schedule_pattern,
      schedule_pattern_data,
      injection_site_data,
    } = req.body;

    // Verify medication belongs to user
    const existingRows = await query(
      'SELECT * FROM medications WHERE id = ? AND user_id = ? LIMIT 1',
      [id, userId]
    );
    const existingMedication = existingRows?.[0] || null;

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
    await query(
      `UPDATE medications
       SET name = ?,
           dosage = ?,
           medication_type = ?,
           frequency = ?,
           times_per_day = ?,
           times_of_day = ?,
           start_date = ?,
           end_date = ?,
           is_continuous = ?,
           food_instructions = ?,
           notes = ?,
           photo_url = ?,
           quantity_remaining = ?,
           low_stock_threshold = ?,
           reason_for_treatment = ?,
           schedule_pattern = ?,
           schedule_pattern_data = ?,
           injection_site_data = ?,
           updated_at = NOW()
       WHERE id = ? AND user_id = ?`,
      [
        name,
        dosage,
        medication_type || 'tablet',
        derivedFrequency,
        derivedTimesPerDay,
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
        schedule_pattern || existingMedication.schedule_pattern || 'daily',
        schedule_pattern_data ? JSON.stringify(schedule_pattern_data) : existingMedication.schedule_pattern_data,
        injection_site_data ? JSON.stringify(injection_site_data) : existingMedication.injection_site_data,
        id,
        userId,
      ]
    );

    const updatedRows = await query('SELECT * FROM medications WHERE id = ? LIMIT 1', [id]);
    const updatedMedication = updatedRows?.[0] ? parseMedicationRow(updatedRows[0]) : null;

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


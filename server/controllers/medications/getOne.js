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

const getMedication = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    // Allow access if the medication belongs to the user OR the user is an accepted caregiver for the owner
    const rows = await query(
      `SELECT m.*
       FROM medications m
       WHERE m.id = ?
         AND (
           m.user_id = ?
           OR m.user_id IN (
             SELECT cr.care_recipient_id
             FROM caregiver_relationships cr
             WHERE cr.caregiver_id = ? AND cr.status = 'accepted'
           )
         )
       LIMIT 1`,
      [id, userId, userId]
    );
    const medication = rows?.[0] ? parseMedicationRow(rows[0]) : null;

    if (!medication) {
      return res.status(404).json({
        success: false,
        message: 'Medication not found',
      });
    }

    res.json({
      success: true,
      medication,
    });
  } catch (error) {
    console.error('Error fetching medication:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch medication',
      error: error.message,
    });
  }
};

module.exports = { getMedication };


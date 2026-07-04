const { query } = require('../../config/mysql');

function parseMedicationRow(row) {
  const med = { ...row };
  if (typeof med.times_of_day === 'string') {
    try {
      med.times_of_day = JSON.parse(med.times_of_day);
    } catch (e) {
      // Leave as-is if parsing fails
    }
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

const listMedications = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get all medications for the user
    const userMedicationsRows = await query(
      `SELECT *
       FROM medications
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [userId]
    );
    const userMedications = userMedicationsRows.map(parseMedicationRow);

    // Get medications from care recipients (people whose schedules the user can view)
    const caregiverRelationships = await query(
      `SELECT care_recipient_id
       FROM caregiver_relationships
       WHERE caregiver_id = ? AND status = 'accepted'`,
      [userId]
    );
    const careRecipientIds = caregiverRelationships.map((rel) => rel.care_recipient_id);

    let careRecipientMedications = [];
    if (careRecipientIds.length > 0) {
      const placeholders = careRecipientIds.map(() => '?').join(',');
      const careRecipientMedicationsRows = await query(
        `SELECT m.*, u.id as care_recipient_user_id, u.name as care_recipient_name, u.email as care_recipient_email
         FROM medications m
         JOIN users u ON u.id = m.user_id
         WHERE m.user_id IN (${placeholders})
         ORDER BY m.created_at DESC`,
        careRecipientIds
      );
      careRecipientMedications = careRecipientMedicationsRows.map((row) => {
        const med = parseMedicationRow(row);
        med.user = {
          id: row.care_recipient_user_id,
          name: row.care_recipient_name,
          email: row.care_recipient_email,
        };
        return med;
      });
    }

    // Combine medications and mark care recipient medications
    const allMedications = [
      ...userMedications.map(med => ({ ...med, is_care_recipient: false })),
      ...careRecipientMedications.map(med => ({ ...med, is_care_recipient: true })),
    ];

    res.json({
      success: true,
      medications: allMedications,
    });
  } catch (error) {
    console.error('Error listing medications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch medications',
      error: error.message,
    });
  }
};

module.exports = { listMedications };


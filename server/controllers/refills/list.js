const { query } = require('../../config/mysql');

const listRefills = async (req, res) => {
  try {
    const userId = req.user.id;
    const { medication_id } = req.query;
    const params = [userId];
    let medFilterSql = '';
    if (medication_id) {
      medFilterSql = ' AND r.medication_id = ?';
      params.push(medication_id);
    }

    const refills = await query(
      `SELECT r.*, m.id as medication_id_ref, m.name as medication_name, m.dosage as medication_dosage
       FROM refills r
       JOIN medications m ON m.id = r.medication_id
       WHERE r.user_id = ?${medFilterSql}
       ORDER BY r.refill_date DESC`,
      params
    );

    const shaped = refills.map((r) => ({
      ...r,
      medication: {
        id: r.medication_id_ref,
        name: r.medication_name,
        dosage: r.medication_dosage,
      },
    }));

    res.json({
      success: true,
      refills: shaped,
    });
  } catch (error) {
    console.error('Error listing refills:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to list refills',
      error: error.message,
    });
  }
};

module.exports = listRefills;


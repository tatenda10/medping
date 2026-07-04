const { query } = require('../../config/mysql');

const createVitalsLog = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      weight,
      blood_pressure_systolic,
      blood_pressure_diastolic,
      blood_glucose,
      heart_rate,
      temperature,
      notes,
    } = req.body;

    const idRows = await query('SELECT UUID() as id');
    const id = idRows?.[0]?.id;

    await query(
      `INSERT INTO vitals_logs (
         id, user_id, weight, blood_pressure_systolic, blood_pressure_diastolic,
         blood_glucose, heart_rate, temperature, notes, recorded_at, created_at
       ) VALUES (
         ?, ?, ?, ?, ?,
         ?, ?, ?, ?, NOW(), NOW()
       )`,
      [
        id,
        userId,
        weight ?? null,
        blood_pressure_systolic ?? null,
        blood_pressure_diastolic ?? null,
        blood_glucose ?? null,
        heart_rate ?? null,
        temperature ?? null,
        notes || null,
      ]
    );

    const vitalsRows = await query('SELECT * FROM vitals_logs WHERE id = ? LIMIT 1', [id]);
    const vitalsLog = vitalsRows?.[0] || null;

    res.status(201).json({
      success: true,
      message: 'Vitals logged successfully',
      vitals: vitalsLog,
    });
  } catch (error) {
    console.error('Error creating vitals log:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to log vitals',
      error: error.message,
    });
  }
};

module.exports = { createVitalsLog };


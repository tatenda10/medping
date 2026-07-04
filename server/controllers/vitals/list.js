const { query } = require('../../config/mysql');

const listVitalsLogs = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 50, offset = 0 } = req.query;
    const take = Math.max(0, parseInt(limit, 10) || 50);
    const skip = Math.max(0, parseInt(offset, 10) || 0);

    // Some MySQL setups do not like placeholders for LIMIT/OFFSET.
    // Safely inline the numeric values and keep userId parameterized.
    const vitals = await query(
      `SELECT *
       FROM vitals_logs
       WHERE user_id = ?
       ORDER BY recorded_at DESC
       LIMIT ${take} OFFSET ${skip}`,
      [userId]
    );

    res.json({
      success: true,
      vitals,
    });
  } catch (error) {
    console.error('Error listing vitals logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch vitals logs',
      error: error.message,
    });
  }
};

module.exports = { listVitalsLogs };


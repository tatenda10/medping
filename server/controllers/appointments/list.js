const { query } = require('../../config/mysql');

const listAppointments = async (req, res) => {
  try {
    const userId = req.user.id;
    const appointments = await query(
      `SELECT *
       FROM appointments
       WHERE user_id = ?
       ORDER BY scheduled_time DESC`,
      [userId]
    );

    res.json({
      success: true,
      appointments,
    });
  } catch (error) {
    console.error('Error listing appointments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch appointments',
      error: error.message,
    });
  }
};

module.exports = { listAppointments };


const { query } = require('../../config/mysql');

const deleteAppointment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    // Verify appointment belongs to user
    const existingRows = await query(
      'SELECT id FROM appointments WHERE id = ? AND user_id = ? LIMIT 1',
      [id, userId]
    );
    const appointment = existingRows?.[0] || null;

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found',
      });
    }

    await query('DELETE FROM appointments WHERE id = ? AND user_id = ?', [id, userId]);

    res.json({
      success: true,
      message: 'Appointment deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting appointment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete appointment',
      error: error.message,
    });
  }
};

module.exports = { deleteAppointment };


const prisma = require('../../config/database');

const deleteAppointment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    // Verify appointment belongs to user
    const appointment = await prisma.appointment.findFirst({
      where: {
        id,
        user_id: userId,
      },
    });

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found',
      });
    }

    await prisma.appointment.delete({
      where: { id },
    });

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


const prisma = require('../../config/database');

const updateAppointment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const updateData = req.body;

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

    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        ...updateData,
        scheduled_time: updateData.scheduled_time ? new Date(updateData.scheduled_time) : undefined,
      },
    });

    res.json({
      success: true,
      message: 'Appointment updated successfully',
      appointment: updated,
    });
  } catch (error) {
    console.error('Error updating appointment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update appointment',
      error: error.message,
    });
  }
};

module.exports = { updateAppointment };


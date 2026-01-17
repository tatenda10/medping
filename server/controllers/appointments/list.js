const prisma = require('../../config/database');

const listAppointments = async (req, res) => {
  try {
    const userId = req.user.id;

    // Check if prisma is properly initialized
    if (!prisma || !prisma.appointment) {
      console.error('Prisma client not properly initialized');
      return res.status(500).json({
        success: false,
        message: 'Database connection error',
      });
    }

    const appointments = await prisma.appointment.findMany({
      where: {
        user_id: userId,
      },
      orderBy: {
        scheduled_time: 'desc',
      },
    });

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


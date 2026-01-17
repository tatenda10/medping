const prisma = require('../../config/database');

const listVitalsLogs = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 50, offset = 0 } = req.query;

    // Check if prisma is properly initialized
    if (!prisma || !prisma.vitalsLog) {
      console.error('Prisma client not properly initialized');
      return res.status(500).json({
        success: false,
        message: 'Database connection error',
      });
    }

    const vitals = await prisma.vitalsLog.findMany({
      where: {
        user_id: userId,
      },
      orderBy: {
        recorded_at: 'desc',
      },
      take: parseInt(limit),
      skip: parseInt(offset),
    });

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


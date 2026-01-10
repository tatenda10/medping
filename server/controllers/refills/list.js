const prisma = require('../../config/database');

const listRefills = async (req, res) => {
  try {
    const userId = req.user.id;
    const { medication_id } = req.query;

    const where = {
      user_id: userId,
    };

    if (medication_id) {
      where.medication_id = medication_id;
    }

    const refills = await prisma.refill.findMany({
      where,
      include: {
        medication: {
          select: {
            id: true,
            name: true,
            dosage: true,
          },
        },
      },
      orderBy: {
        refill_date: 'desc',
      },
    });

    res.json({
      success: true,
      refills,
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


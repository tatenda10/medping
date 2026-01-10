const prisma = require('../../config/database');

const getMedication = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    // Get medication and verify it belongs to the user
    const medication = await prisma.medication.findFirst({
      where: {
        id: id,
        user_id: userId,
      },
    });

    if (!medication) {
      return res.status(404).json({
        success: false,
        message: 'Medication not found',
      });
    }

    res.json({
      success: true,
      medication,
    });
  } catch (error) {
    console.error('Error fetching medication:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch medication',
      error: error.message,
    });
  }
};

module.exports = { getMedication };


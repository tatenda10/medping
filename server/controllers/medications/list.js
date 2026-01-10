const prisma = require('../../config/database');

const listMedications = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get all medications for the user
    const userMedications = await prisma.medication.findMany({
      where: {
        user_id: userId,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    // Get medications from care recipients (people whose schedules the user can view)
    const caregiverRelationships = await prisma.caregiverRelationship.findMany({
      where: {
        caregiver_id: userId,
        status: 'accepted', // Only include accepted relationships
      },
      select: {
        care_recipient_id: true,
      },
    });

    const careRecipientIds = caregiverRelationships.map(rel => rel.care_recipient_id);

    let careRecipientMedications = [];
    if (careRecipientIds.length > 0) {
      careRecipientMedications = await prisma.medication.findMany({
        where: {
          user_id: {
            in: careRecipientIds,
          },
        },
        orderBy: {
          created_at: 'desc',
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });
    }

    // Combine medications and mark care recipient medications
    const allMedications = [
      ...userMedications.map(med => ({ ...med, is_care_recipient: false })),
      ...careRecipientMedications.map(med => ({ ...med, is_care_recipient: true })),
    ];

    res.json({
      success: true,
      medications: allMedications,
    });
  } catch (error) {
    console.error('Error listing medications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch medications',
      error: error.message,
    });
  }
};

module.exports = { listMedications };


const prisma = require('../../config/database');

const listInvitations = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get invitations where user is the care recipient (pending invitations to accept/reject)
    const receivedInvitations = await prisma.caregiverRelationship.findMany({
      where: {
        care_recipient_id: userId,
        status: 'pending',
      },
      include: {
        caregiver: {
          select: {
            id: true,
            name: true,
            email: true,
            profile_image_url: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    // Get relationships where user is the caregiver (people whose schedules they can view)
    const sentInvitations = await prisma.caregiverRelationship.findMany({
      where: {
        caregiver_id: userId,
      },
      include: {
        care_recipient: {
          select: {
            id: true,
            name: true,
            email: true,
            profile_image_url: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    res.json({
      success: true,
      receivedInvitations: receivedInvitations.map(inv => ({
        id: inv.id,
        status: inv.status,
        created_at: inv.created_at,
        caregiver: inv.caregiver,
      })),
      sentInvitations: sentInvitations.map(inv => ({
        id: inv.id,
        status: inv.status,
        created_at: inv.created_at,
        care_recipient: inv.care_recipient,
      })),
    });
  } catch (error) {
    console.error('Error listing invitations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to list invitations',
      error: error.message,
    });
  }
};

module.exports = listInvitations;


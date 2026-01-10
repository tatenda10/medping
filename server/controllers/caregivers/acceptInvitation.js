const prisma = require('../../config/database');

const acceptInvitation = async (req, res) => {
  try {
    const { invitationId } = req.params;
    const userId = req.user.id;

    // Find the invitation where the current user is the care recipient
    const relationship = await prisma.caregiverRelationship.findUnique({
      where: { id: invitationId },
      include: {
        caregiver: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        care_recipient: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!relationship) {
      return res.status(404).json({
        success: false,
        message: 'Invitation not found',
      });
    }

    // Verify the current user is the care recipient
    if (relationship.care_recipient_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to accept this invitation',
      });
    }

    if (relationship.status === 'accepted') {
      return res.status(400).json({
        success: false,
        message: 'Invitation already accepted',
      });
    }

    // Update status to accepted
    const updatedRelationship = await prisma.caregiverRelationship.update({
      where: { id: invitationId },
      data: { status: 'accepted' },
      include: {
        caregiver: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Create notification for the caregiver
    await prisma.notification.create({
      data: {
        user_id: relationship.caregiver_id,
        type: 'caregiver_alert',
        title: 'Invitation Accepted',
        message: `${relationship.care_recipient.name || 'User'} has accepted your invitation`,
        data: {
          relationship_id: relationship.id,
        },
      },
    });

    res.json({
      success: true,
      message: 'Invitation accepted successfully',
      relationship: updatedRelationship,
    });
  } catch (error) {
    console.error('Error accepting invitation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to accept invitation',
      error: error.message,
    });
  }
};

module.exports = acceptInvitation;


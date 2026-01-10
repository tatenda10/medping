const prisma = require('../../config/database');

const rejectInvitation = async (req, res) => {
  try {
    const { invitationId } = req.params;
    const userId = req.user.id;

    // Find the invitation where the current user is the care recipient
    const relationship = await prisma.caregiverRelationship.findUnique({
      where: { id: invitationId },
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
        message: 'You are not authorized to reject this invitation',
      });
    }

    // Delete the relationship (rejecting removes it)
    await prisma.caregiverRelationship.delete({
      where: { id: invitationId },
    });

    res.json({
      success: true,
      message: 'Invitation rejected',
    });
  } catch (error) {
    console.error('Error rejecting invitation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject invitation',
      error: error.message,
    });
  }
};

module.exports = rejectInvitation;


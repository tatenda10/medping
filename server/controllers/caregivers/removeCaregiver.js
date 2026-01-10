const prisma = require('../../config/database');

const removeCaregiver = async (req, res) => {
  try {
    const { relationshipId } = req.params;
    const userId = req.user.id;

    // Find the relationship
    const relationship = await prisma.caregiverRelationship.findUnique({
      where: { id: relationshipId },
    });

    if (!relationship) {
      return res.status(404).json({
        success: false,
        message: 'Relationship not found',
      });
    }

    // Verify the current user is either the caregiver or care recipient
    if (relationship.caregiver_id !== userId && relationship.care_recipient_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to remove this relationship',
      });
    }

    // Delete the relationship
    await prisma.caregiverRelationship.delete({
      where: { id: relationshipId },
    });

    res.json({
      success: true,
      message: 'Relationship removed successfully',
    });
  } catch (error) {
    console.error('Error removing caregiver:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove relationship',
      error: error.message,
    });
  }
};

module.exports = removeCaregiver;


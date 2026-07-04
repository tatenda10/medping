const { query } = require('../../config/mysql');

const rejectInvitation = async (req, res) => {
  try {
    const { invitationId } = req.params;
    const userId = req.user.id;

    // Find the invitation where the current user is the care recipient
    const rows = await query('SELECT * FROM caregiver_relationships WHERE id = ? LIMIT 1', [
      invitationId,
    ]);
    const relationship = rows?.[0] || null;

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
    await query('DELETE FROM caregiver_relationships WHERE id = ? AND care_recipient_id = ?', [
      invitationId,
      userId,
    ]);

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


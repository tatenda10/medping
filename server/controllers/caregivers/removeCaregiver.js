const { query } = require('../../config/mysql');

const removeCaregiver = async (req, res) => {
  try {
    const { relationshipId } = req.params;
    const userId = req.user.id;

    // Find the relationship
    const rows = await query('SELECT * FROM caregiver_relationships WHERE id = ? LIMIT 1', [
      relationshipId,
    ]);
    const relationship = rows?.[0] || null;

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
    await query(
      `DELETE FROM caregiver_relationships
       WHERE id = ? AND (caregiver_id = ? OR care_recipient_id = ?)`,
      [relationshipId, userId, userId]
    );

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


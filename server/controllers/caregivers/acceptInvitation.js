const { query } = require('../../config/mysql');

const acceptInvitation = async (req, res) => {
  try {
    const { invitationId } = req.params;
    const userId = req.user.id;

    // Find the invitation where the current user is the care recipient
    const rows = await query(
      `SELECT cr.*, c.id as caregiver_id_u, c.name as caregiver_name, c.email as caregiver_email,
              r.id as care_recipient_id_u, r.name as care_recipient_name, r.email as care_recipient_email
       FROM caregiver_relationships cr
       JOIN users c ON c.id = cr.caregiver_id
       JOIN users r ON r.id = cr.care_recipient_id
       WHERE cr.id = ?
       LIMIT 1`,
      [invitationId]
    );
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
    await query(
      `UPDATE caregiver_relationships SET status = 'accepted', updated_at = NOW() WHERE id = ?`,
      [invitationId]
    );
    const updatedRows = await query('SELECT * FROM caregiver_relationships WHERE id = ? LIMIT 1', [
      invitationId,
    ]);
    const updatedRelationship = updatedRows?.[0] || null;

    // Create notification for the caregiver
    const notifIdRows = await query('SELECT UUID() as id');
    const notifId = notifIdRows?.[0]?.id;
    await query(
      `INSERT INTO notifications (id, user_id, type, title, message, data, is_read, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, NOW())`,
      [
        notifId,
        relationship.caregiver_id,
        'caregiver_alert',
        'Invitation Accepted',
        `${relationship.care_recipient_name || 'User'} has accepted your invitation`,
        JSON.stringify({ relationship_id: relationship.id }),
      ]
    );

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


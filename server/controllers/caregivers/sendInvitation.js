const { query } = require('../../config/mysql');

const sendInvitation = async (req, res) => {
  try {
    const { email } = req.body;
    const caregiverId = req.user.id; // The person sending the invitation (will be caregiver)

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required',
      });
    }

    // Find the user by email (the care recipient - person whose schedule will be shared)
    const normalizedEmail = String(email).trim().toLowerCase();
    const users = await query('SELECT id, name, email FROM users WHERE email = ? LIMIT 1', [
      normalizedEmail,
    ]);
    const careRecipient = users?.[0] || null;

    if (!careRecipient) {
      return res.status(404).json({
        success: false,
        message: 'User with this email not found',
      });
    }

    if (careRecipient.id === caregiverId) {
      return res.status(400).json({
        success: false,
        message: 'You cannot invite yourself',
      });
    }

    // Check if relationship already exists
    const existing = await query(
      `SELECT id, status
       FROM caregiver_relationships
       WHERE caregiver_id = ? AND care_recipient_id = ?
       LIMIT 1`,
      [caregiverId, careRecipient.id]
    );
    const existingRelationship = existing?.[0] || null;

    if (existingRelationship) {
      return res.status(400).json({
        success: false,
        message: existingRelationship.status === 'accepted' 
          ? 'You already have access to this user\'s schedule'
          : 'Invitation already sent',
      });
    }

    // Create the invitation (caregiver can view care recipient's schedule)
    const idRows = await query('SELECT UUID() as id');
    const relationshipId = idRows?.[0]?.id;
    await query(
      `INSERT INTO caregiver_relationships (id, caregiver_id, care_recipient_id, status, created_at, updated_at)
       VALUES (?, ?, ?, 'pending', NOW(), NOW())`,
      [relationshipId, caregiverId, careRecipient.id]
    );

    // Create notification for the care recipient
    const notifIdRows = await query('SELECT UUID() as id');
    const notifId = notifIdRows?.[0]?.id;
    await query(
      `INSERT INTO notifications (id, user_id, type, title, message, data, is_read, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, NOW())`,
      [
        notifId,
        careRecipient.id,
        'caregiver_alert',
        'New Caregiver Invitation',
        `${req.user.name || 'Someone'} wants to view your medication schedule`,
        JSON.stringify({
          relationship_id: relationshipId,
          caregiver_id: caregiverId,
          caregiver_name: req.user.name,
        }),
      ]
    );

    res.json({
      success: true,
      message: 'Invitation sent successfully',
      relationship: {
        id: relationshipId,
        status: 'pending',
        care_recipient: {
          id: careRecipient.id,
          name: careRecipient.name,
          email: careRecipient.email,
        },
      },
    });
  } catch (error) {
    console.error('Error sending invitation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send invitation',
      error: error.message,
    });
  }
};

module.exports = sendInvitation;


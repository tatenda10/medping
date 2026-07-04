const { query } = require('../../config/mysql');

const listInvitations = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get invitations where user is the care recipient (pending invitations to accept/reject)
    const receivedInvitations = await query(
      `SELECT cr.id, cr.status, cr.created_at,
              u.id as caregiver_id, u.name as caregiver_name, u.email as caregiver_email, u.profile_image_url as caregiver_profile_image_url
       FROM caregiver_relationships cr
       JOIN users u ON u.id = cr.caregiver_id
       WHERE cr.care_recipient_id = ? AND cr.status = 'pending'
       ORDER BY cr.created_at DESC`,
      [userId]
    );

    // Get relationships where user is the caregiver (people whose schedules they can view)
    const sentInvitations = await query(
      `SELECT cr.id, cr.status, cr.created_at,
              u.id as care_recipient_id, u.name as care_recipient_name, u.email as care_recipient_email, u.profile_image_url as care_recipient_profile_image_url
       FROM caregiver_relationships cr
       JOIN users u ON u.id = cr.care_recipient_id
       WHERE cr.caregiver_id = ?
       ORDER BY cr.created_at DESC`,
      [userId]
    );

    res.json({
      success: true,
      receivedInvitations: receivedInvitations.map((inv) => ({
        id: inv.id,
        status: inv.status,
        created_at: inv.created_at,
        caregiver: {
          id: inv.caregiver_id,
          name: inv.caregiver_name,
          email: inv.caregiver_email,
          profile_image_url: inv.caregiver_profile_image_url,
        },
      })),
      sentInvitations: sentInvitations.map((inv) => ({
        id: inv.id,
        status: inv.status,
        created_at: inv.created_at,
        care_recipient: {
          id: inv.care_recipient_id,
          name: inv.care_recipient_name,
          email: inv.care_recipient_email,
          profile_image_url: inv.care_recipient_profile_image_url,
        },
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


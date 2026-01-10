const prisma = require('../../config/database');

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
    const careRecipient = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

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
    const existingRelationship = await prisma.caregiverRelationship.findFirst({
      where: {
        caregiver_id: caregiverId,
        care_recipient_id: careRecipient.id,
      },
    });

    if (existingRelationship) {
      return res.status(400).json({
        success: false,
        message: existingRelationship.status === 'accepted' 
          ? 'You already have access to this user\'s schedule'
          : 'Invitation already sent',
      });
    }

    // Create the invitation (caregiver can view care recipient's schedule)
    const relationship = await prisma.caregiverRelationship.create({
      data: {
        caregiver_id: caregiverId,
        care_recipient_id: careRecipient.id,
        status: 'pending',
      },
      include: {
        care_recipient: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Create notification for the care recipient
    await prisma.notification.create({
      data: {
        user_id: careRecipient.id,
        type: 'caregiver_alert',
        title: 'New Caregiver Invitation',
        message: `${req.user.name || 'Someone'} wants to view your medication schedule`,
        data: {
          relationship_id: relationship.id,
          caregiver_id: caregiverId,
          caregiver_name: req.user.name,
        },
      },
    });

    res.json({
      success: true,
      message: 'Invitation sent successfully',
      relationship: {
        id: relationship.id,
        status: relationship.status,
        care_recipient: relationship.care_recipient,
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


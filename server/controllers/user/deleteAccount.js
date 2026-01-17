const prisma = require('../../config/database');

/**
 * Delete user account and all associated data
 */
const deleteAccount = async (req, res) => {
  try {
    const userId = req.user.id;

    // Delete all user data (Prisma cascade will handle related records)
    // But we need to manually delete relationships where user is caregiver or recipient
    
    // Delete caregiver relationships where user is the caregiver
    await prisma.caregiverRelationship.deleteMany({
      where: {
        caregiver_id: userId,
      },
    });

    // Delete caregiver relationships where user is the care recipient
    await prisma.caregiverRelationship.deleteMany({
      where: {
        care_recipient_id: userId,
      },
    });

    // Delete all notifications
    await prisma.notification.deleteMany({
      where: {
        user_id: userId,
      },
    });

    // Delete all vitals logs
    await prisma.vitalsLog.deleteMany({
      where: {
        user_id: userId,
      },
    });

    // Delete all appointments
    await prisma.appointment.deleteMany({
      where: {
        user_id: userId,
      },
    });

    // Delete all health logs
    await prisma.healthLog.deleteMany({
      where: {
        user_id: userId,
      },
    });

    // Delete all refills
    await prisma.refill.deleteMany({
      where: {
        user_id: userId,
      },
    });

    // Delete all dose logs
    await prisma.doseLog.deleteMany({
      where: {
        user_id: userId,
      },
    });

    // Delete all medications (this will cascade to dose logs, but we already deleted them)
    await prisma.medication.deleteMany({
      where: {
        user_id: userId,
      },
    });

    // Delete all dependents
    await prisma.dependent.deleteMany({
      where: {
        user_id: userId,
      },
    });

    // Delete user profile (cascade from user, but delete explicitly to be safe)
    await prisma.userProfile.deleteMany({
      where: {
        user_id: userId,
      },
    });

    // Finally, delete the user (this should cascade delete the profile)
    await prisma.user.delete({
      where: {
        id: userId,
      },
    });

    res.json({
      success: true,
      message: 'Account and all associated data deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete account',
      error: error.message,
    });
  }
};

module.exports = deleteAccount;


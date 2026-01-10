const prisma = require('../../config/database');

/**
 * Get user profile
 */
const getUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Remove sensitive data
    const { password_hash, ...userWithoutPassword } = user;

    res.json({
      success: true,
      user: userWithoutPassword,
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ 
      message: 'Error fetching user profile', 
      error: error.message 
    });
  }
};

/**
 * Update user profile
 */
const updateUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, age, gender, timezone, preferred_notification_sound } = req.body;

    // Update user basic info
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (timezone !== undefined) updateData.timezone = timezone;
    if (preferred_notification_sound !== undefined) {
      updateData.preferred_notification_sound = preferred_notification_sound;
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    // Update or create user profile
    const profileData = {};
    if (age !== undefined) profileData.age = age;
    if (gender !== undefined) profileData.gender = gender;

    const profile = await prisma.userProfile.upsert({
      where: { user_id: userId },
      update: profileData,
      create: {
        user_id: userId,
        ...profileData,
      },
    });

    // Remove sensitive data
    const { password_hash, ...userWithoutPassword } = user;

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        ...userWithoutPassword,
        profile,
      },
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ 
      message: 'Error updating user profile', 
      error: error.message 
    });
  }
};

/**
 * Complete onboarding
 */
const completeOnboarding = async (req, res) => {
  try {
    const userId = req.user.id;
    const { age, gender, timezone, preferred_notification_sound } = req.body;

    // Update user
    const userUpdateData = {};
    if (timezone) userUpdateData.timezone = timezone;
    if (preferred_notification_sound) {
      userUpdateData.preferred_notification_sound = preferred_notification_sound;
    }

    await prisma.user.update({
      where: { id: userId },
      data: userUpdateData,
    });

    // Update or create profile and mark onboarding as complete
    await prisma.userProfile.upsert({
      where: { user_id: userId },
      update: {
        age: age || undefined,
        gender: gender || undefined,
        onboarding_completed: true,
      },
      create: {
        user_id: userId,
        age: age || null,
        gender: gender || null,
        onboarding_completed: true,
      },
    });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
      },
    });

    const { password_hash, ...userWithoutPassword } = user;

    res.json({
      success: true,
      message: 'Onboarding completed successfully',
      user: userWithoutPassword,
    });
  } catch (error) {
    console.error('Error completing onboarding:', error);
    res.status(500).json({ 
      message: 'Error completing onboarding', 
      error: error.message 
    });
  }
};

module.exports = {
  getUserProfile,
  updateUserProfile,
  completeOnboarding,
};


const { query, transaction } = require('../../config/mysql');

/**
 * Get user profile
 */
const getUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const rows = await query(
      `SELECT 
         u.id, u.email, u.name, u.phone_number, u.profile_image_url,
         u.auth_provider, u.role, u.timezone, u.preferred_notification_sound,
         u.is_verified, u.created_at, u.updated_at,
         up.id as profile_id, up.age, up.gender, up.onboarding_completed as profile_onboarding_completed,
         up.created_at as profile_created_at, up.updated_at as profile_updated_at
       FROM users u
       LEFT JOIN user_profiles up ON up.user_id = u.id
       WHERE u.id = ?
       LIMIT 1`,
      [userId]
    );
    const user = rows?.[0] || null;

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const shapedUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      phone_number: user.phone_number,
      profile_image_url: user.profile_image_url,
      auth_provider: user.auth_provider,
      role: user.role,
      timezone: user.timezone,
      preferred_notification_sound: user.preferred_notification_sound,
      is_verified: !!user.is_verified,
      created_at: user.created_at,
      updated_at: user.updated_at,
      profile: user.profile_id
        ? {
            id: user.profile_id,
            user_id: user.id,
            age: user.age,
            gender: user.gender,
            onboarding_completed: !!user.profile_onboarding_completed,
            created_at: user.profile_created_at,
            updated_at: user.profile_updated_at,
          }
        : null,
    };

    res.json({
      success: true,
      user: shapedUser,
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
    const { name, age, gender, timezone, preferred_notification_sound, phone_number } = req.body;

    await transaction(async (tx) => {
      const userFields = [];
      const userParams = [];
      if (name !== undefined) {
        userFields.push('name = ?');
        userParams.push(name);
      }
      if (timezone !== undefined) {
        userFields.push('timezone = ?');
        userParams.push(timezone);
      }
      if (preferred_notification_sound !== undefined) {
        userFields.push('preferred_notification_sound = ?');
        userParams.push(preferred_notification_sound);
      }
      if (phone_number !== undefined) {
        userFields.push('phone_number = ?');
        userParams.push(phone_number ? String(phone_number).trim() : null);
      }
      if (userFields.length > 0) {
        userFields.push('updated_at = NOW()');
        await tx.execute(
          `UPDATE users SET ${userFields.join(', ')} WHERE id = ?`,
          [...userParams, userId]
        );
      }

      // Upsert profile (avoid subquery on same table — MySQL ER_UPDATE_TABLE_USED)
      if (age !== undefined || gender !== undefined) {
        const existingProfiles = await tx.query(
          'SELECT id FROM user_profiles WHERE user_id = ? LIMIT 1',
          [userId]
        );
        const existingProfile = existingProfiles?.[0] || null;

        if (existingProfile) {
          await tx.execute(
            `UPDATE user_profiles
             SET age = ?, gender = ?, updated_at = NOW()
             WHERE user_id = ?`,
            [age ?? null, gender ?? null, userId]
          );
        } else {
          const profileIdRows = await tx.query('SELECT UUID() as id');
          const profileId = profileIdRows?.[0]?.id;
          await tx.execute(
            `INSERT INTO user_profiles (id, user_id, age, gender, onboarding_completed, created_at, updated_at)
             VALUES (?, ?, ?, ?, 0, NOW(), NOW())`,
            [profileId, userId, age ?? null, gender ?? null]
          );
        }
      }
    });

    const rows = await query(
      `SELECT 
         u.id, u.email, u.name, u.phone_number, u.profile_image_url,
         u.auth_provider, u.role, u.timezone, u.preferred_notification_sound,
         u.is_verified, u.created_at, u.updated_at,
         up.id as profile_id, up.age, up.gender, up.onboarding_completed as profile_onboarding_completed,
         up.created_at as profile_created_at, up.updated_at as profile_updated_at
       FROM users u
       LEFT JOIN user_profiles up ON up.user_id = u.id
       WHERE u.id = ?
       LIMIT 1`,
      [userId]
    );
    const user = rows?.[0] || null;

    const shapedUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      phone_number: user.phone_number,
      profile_image_url: user.profile_image_url,
      auth_provider: user.auth_provider,
      role: user.role,
      timezone: user.timezone,
      preferred_notification_sound: user.preferred_notification_sound,
      is_verified: !!user.is_verified,
      created_at: user.created_at,
      updated_at: user.updated_at,
      profile: user.profile_id
        ? {
            id: user.profile_id,
            user_id: user.id,
            age: user.age,
            gender: user.gender,
            onboarding_completed: !!user.profile_onboarding_completed,
            created_at: user.profile_created_at,
            updated_at: user.profile_updated_at,
          }
        : null,
    };

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        ...shapedUser,
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

    await transaction(async (tx) => {
      const userFields = [];
      const userParams = [];
      if (timezone) {
        userFields.push('timezone = ?');
        userParams.push(timezone);
      }
      if (preferred_notification_sound) {
        userFields.push('preferred_notification_sound = ?');
        userParams.push(preferred_notification_sound);
      }
      if (userFields.length > 0) {
        userFields.push('updated_at = NOW()');
        await tx.execute(
          `UPDATE users SET ${userFields.join(', ')} WHERE id = ?`,
          [...userParams, userId]
        );
      }

      const profileIdRows = await tx.query('SELECT UUID() as id');
      const profileId = profileIdRows?.[0]?.id;
      await tx.execute(
        `INSERT INTO user_profiles (id, user_id, age, gender, onboarding_completed, created_at, updated_at)
         VALUES (?, ?, ?, ?, 1, NOW(), NOW())
         ON DUPLICATE KEY UPDATE
           age = COALESCE(VALUES(age), age),
           gender = COALESCE(VALUES(gender), gender),
           onboarding_completed = 1,
           updated_at = NOW()`,
        [profileId, userId, age ?? null, gender ?? null]
      );
    });

    const rows = await query(
      `SELECT 
         u.id, u.email, u.name, u.phone_number, u.profile_image_url,
         u.auth_provider, u.role, u.timezone, u.preferred_notification_sound,
         u.is_verified, u.created_at, u.updated_at,
         up.id as profile_id, up.age, up.gender, up.onboarding_completed as profile_onboarding_completed,
         up.created_at as profile_created_at, up.updated_at as profile_updated_at
       FROM users u
       LEFT JOIN user_profiles up ON up.user_id = u.id
       WHERE u.id = ?
       LIMIT 1`,
      [userId]
    );
    const user = rows?.[0] || null;

    const shapedUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      phone_number: user.phone_number,
      profile_image_url: user.profile_image_url,
      auth_provider: user.auth_provider,
      role: user.role,
      timezone: user.timezone,
      preferred_notification_sound: user.preferred_notification_sound,
      is_verified: !!user.is_verified,
      created_at: user.created_at,
      updated_at: user.updated_at,
      profile: user.profile_id
        ? {
            id: user.profile_id,
            user_id: user.id,
            age: user.age,
            gender: user.gender,
            onboarding_completed: !!user.profile_onboarding_completed,
            created_at: user.profile_created_at,
            updated_at: user.profile_updated_at,
          }
        : null,
    };

    res.json({
      success: true,
      message: 'Onboarding completed successfully',
      user: shapedUser,
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


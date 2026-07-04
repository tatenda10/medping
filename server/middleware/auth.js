const { verifyToken, createClerkClient } = require('@clerk/backend');
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const { query, transaction } = require('../config/mysql');

const clerkClient = config.CLERK_SECRET_KEY
  ? createClerkClient({ secretKey: config.CLERK_SECRET_KEY })
  : null;

/**
 * Generate JWT token for the API
 */
const generateToken = (payload) => {
  if (!config.JWT_SECRET) {
    throw new Error('JWT_SECRET is not set');
  }
  return jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN,
  });
};

/**
 * Middleware to verify JWT bearer token
 */
const buildDisplayName = ({ firstName, lastName, fullName, email }) => {
  if (fullName) return fullName;
  const joined = [firstName, lastName].filter(Boolean).join(' ').trim();
  if (joined) return joined;
  if (email) return email.split('@')[0];
  return 'User';
};

const executeIfTableExists = async (tx, sql, params) => {
  try {
    await tx.execute(sql, params);
  } catch (error) {
    if (error?.code === 'ER_NO_SUCH_TABLE') {
      return;
    }
    throw error;
  }
};

const getClerkVerificationOptions = () => {
  const options = {
    secretKey: config.CLERK_SECRET_KEY,
  };

  if (
    config.CLERK_JWT_KEY &&
    !String(config.CLERK_JWT_KEY).startsWith('sk_')
  ) {
    options.jwtKey = config.CLERK_JWT_KEY;
  }

  if (config.CLERK_AUTHORIZED_PARTIES?.length) {
    options.authorizedParties = config.CLERK_AUTHORIZED_PARTIES;
  }

  return options;
};

const buildFallbackEmail = (clerkUserId) => {
  const safeId = String(clerkUserId).replace(/[^a-zA-Z0-9]/g, '') || 'clerk';
  return `${safeId}@clerk.mediping.local`;
};

const resolveClerkProfile = async (clerkUserId, decoded) => {
  let email = decoded?.email || decoded?.email_address || null;
  let firstName = decoded?.given_name || null;
  let lastName = decoded?.family_name || null;
  let fullName = decoded?.name || null;
  let imageUrl = decoded?.image_url || decoded?.picture || null;

  if ((!email || !fullName) && clerkClient) {
    try {
      const clerkUser = await clerkClient.users.getUser(clerkUserId);
      email = email || clerkUser.emailAddresses?.[0]?.emailAddress || null;
      firstName = firstName || clerkUser.firstName || null;
      lastName = lastName || clerkUser.lastName || null;
      fullName =
        fullName ||
        [firstName, lastName].filter(Boolean).join(' ').trim() ||
        clerkUser.username ||
        null;
      imageUrl = imageUrl || clerkUser.imageUrl || null;
    } catch (error) {
      console.warn('Could not fetch Clerk user profile:', error.message);
    }
  }

  if (!email) {
    email = buildFallbackEmail(clerkUserId);
  }

  return { email, firstName, lastName, fullName, imageUrl };
};

const ensureLocalUser = async ({ clerkUserId, email, firstName, lastName, fullName, imageUrl }) => {
  const normalizedEmail = email
    ? String(email).trim().toLowerCase()
    : buildFallbackEmail(clerkUserId);
  const name = buildDisplayName({ firstName, lastName, fullName, email: normalizedEmail });

  const existingById = await query(
    'SELECT id, email, role, name FROM users WHERE clerk_user_id = ? OR id = ? LIMIT 1',
    [clerkUserId, clerkUserId]
  );
  const userById = existingById?.[0] || null;

  if (userById) {
    await query(
      `UPDATE users
       SET email = COALESCE(?, email),
           name = COALESCE(?, name),
           profile_image_url = COALESCE(?, profile_image_url),
           clerk_user_id = COALESCE(?, clerk_user_id),
           auth_provider = 'clerk',
           is_verified = 1,
           updated_at = NOW()
       WHERE id = ?`,
      [normalizedEmail, name, imageUrl || null, clerkUserId, userById.id]
    );

    return {
      id: userById.id,
      clerk_user_id: clerkUserId,
      email: normalizedEmail || userById.email,
      role: userById.role || 'user',
      name: name || userById.name,
    };
  }

  const existingByEmail =
    normalizedEmail
      ? (await query('SELECT id, email, role, name FROM users WHERE email = ? LIMIT 1', [normalizedEmail]))?.[0] || null
      : null;

  if (existingByEmail) {
    await query(
      `UPDATE users
       SET email = COALESCE(?, email),
           name = COALESCE(?, name),
           profile_image_url = COALESCE(?, profile_image_url),
           clerk_user_id = COALESCE(?, clerk_user_id),
           auth_provider = 'clerk',
           is_verified = 1,
           updated_at = NOW()
       WHERE id = ?`,
      [normalizedEmail, name, imageUrl || null, clerkUserId, existingByEmail.id]
    );

    return {
      id: existingByEmail.id,
      clerk_user_id: clerkUserId,
      email: normalizedEmail || existingByEmail.email,
      role: existingByEmail.role || 'user',
      name: name || existingByEmail.name,
    };
  }

  await transaction(async (tx) => {
    await tx.execute(
      `INSERT INTO users
        (id, clerk_user_id, email, name, profile_image_url, auth_provider, is_verified, role, created_at, updated_at)
       VALUES (UUID(), ?, ?, ?, ?, 'clerk', 1, 'user', NOW(), NOW())`,
      [clerkUserId, normalizedEmail, name, imageUrl || null]
    );

    const userRows = await tx.query(
      'SELECT id, email, role, name FROM users WHERE clerk_user_id = ? LIMIT 1',
      [clerkUserId]
    );
    const createdUser = userRows?.[0];
    const profileIdRows = await tx.query('SELECT UUID() as id');
    const profileId = profileIdRows?.[0]?.id;
    await executeIfTableExists(
      tx,
      `INSERT INTO user_profiles (id, user_id, onboarding_completed, created_at, updated_at)
       VALUES (?, ?, 0, NOW(), NOW())`,
      [profileId, createdUser.id]
    );

    return createdUser;
  });

  const createdUserRows = await query(
    'SELECT id, email, role, name FROM users WHERE clerk_user_id = ? LIMIT 1',
    [clerkUserId]
  );
  const createdUser = createdUserRows?.[0];

  return {
    id: createdUser?.id,
    clerk_user_id: clerkUserId,
    email: createdUser?.email || normalizedEmail,
    role: createdUser?.role || 'user',
    name: createdUser?.name || name,
  };
};

const authenticate = async (req, res, next) => {
  try {
    if (!config.CLERK_SECRET_KEY && !config.CLERK_JWT_KEY) {
      return res.status(500).json({ message: 'Clerk backend auth is not configured on the server' });
    }

    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    let decoded;
    try {
      decoded = await verifyToken(token, getClerkVerificationOptions());
    } catch (verifyError) {
      console.error('Clerk token verification error:', verifyError);
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    if (!decoded) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    const userId = decoded.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Invalid token payload' });
    }

    const profile = await resolveClerkProfile(userId, decoded);

    const user = await ensureLocalUser({
      clerkUserId: userId,
      ...profile,
    });

    req.user = user;
    req.auth = decoded;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({ message: 'Authentication error', error: error.message });
  }
};

module.exports = {
  authenticate,
  generateToken,
};

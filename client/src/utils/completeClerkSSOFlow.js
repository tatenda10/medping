import * as AuthSession from 'expo-auth-session';

const safeStringify = (value) => {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

export const logClerkAuthError = (label, details = {}) => {
  console.error(`❌ Clerk auth — ${label}`, details);
};

export const serializeClerkError = (error) => ({
  message: error?.message,
  code: error?.code,
  errors: error?.errors,
  clerkTraceId: error?.errors?.[0]?.meta?.traceId,
  raw: safeStringify(error),
});

export const logClerkAuthFailureOutcome = (context, outcome) => {
  logClerkAuthError(`${context} — incomplete`, {
    reason: outcome?.reason,
    missingFields: outcome?.missingFields,
  });
};

const buildUsernameFromEmail = (email) => {
  if (!email) {
    return `user_${Date.now()}`;
  }

  const base = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '').slice(0, 24);
  return base || `user_${Date.now()}`;
};

export const getClerkSSORedirectUrl = () =>
  AuthSession.makeRedirectUri({
    scheme: 'mediping',
    path: 'sso-callback',
  });

export async function completeClerkSSOFlow(result, { onComplete } = {}) {
  const { createdSessionId, setActive, signIn, signUp, authSessionResult } = result || {};

  if (authSessionResult?.type === 'cancel' || authSessionResult?.type === 'dismiss') {
    return { ok: false, reason: 'auth_cancelled' };
  }

  const activateSession = async (sessionId) => {
    if (!sessionId || !setActive) {
      return false;
    }

    await setActive({ session: sessionId });
    if (onComplete) {
      await onComplete();
    }
    return true;
  };

  if (createdSessionId && setActive) {
    await activateSession(createdSessionId);
    return { ok: true };
  }

  if (signIn?.status === 'complete') {
    if (signIn.createdSessionId && setActive) {
      await activateSession(signIn.createdSessionId);
      return { ok: true };
    }

    if (typeof signIn.finalize === 'function') {
      await signIn.finalize({
        navigate: async ({ session }) => {
          if (session?.currentTask) {
            console.log('Pending Clerk session task:', session.currentTask);
          }
        },
      });
      if (onComplete) {
        await onComplete();
      }
      return { ok: true };
    }
  }

  if (signIn?.status === 'needs_second_factor') {
    logClerkAuthFailureOutcome('SSO flow', { reason: 'needs_second_factor' });
    return { ok: false, reason: 'needs_second_factor' };
  }

  if (signIn?.status === 'needs_client_trust') {
    logClerkAuthFailureOutcome('SSO flow', { reason: 'needs_client_trust' });
    return { ok: false, reason: 'needs_client_trust' };
  }

  const externalAccountError = signIn?.firstFactorVerification?.error?.code;
  if (externalAccountError === 'external_account_not_found') {
    logClerkAuthFailureOutcome('SSO flow', { reason: 'account_not_found' });
    return { ok: false, reason: 'account_not_found' };
  }

  if (signUp?.status === 'missing_requirements') {
    const missingFields = signUp.missingFields || [];
    const patch = {};
    const email = signUp.emailAddress || signUp.unverifiedEmailAddress;

    if (missingFields.includes('username')) {
      patch.username = buildUsernameFromEmail(email);
    }
    if (missingFields.includes('first_name') && !signUp.firstName) {
      patch.firstName = signUp.firstName || 'MediPing';
    }
    if (missingFields.includes('last_name') && !signUp.lastName) {
      patch.lastName = signUp.lastName || 'User';
    }

    if (Object.keys(patch).length > 0 && typeof signUp.update === 'function') {
      try {
        await signUp.update(patch);
      } catch (updateError) {
        logClerkAuthError('signUp.update failed after Google auth', {
          patch,
          message: updateError?.message,
          errors: updateError?.errors,
          raw: safeStringify(updateError),
        });
        throw updateError;
      }
    }

    if (signUp.createdSessionId && setActive) {
      await activateSession(signUp.createdSessionId);
      return { ok: true };
    }

    if (signUp.status === 'complete') {
      if (signUp.createdSessionId && setActive) {
        await activateSession(signUp.createdSessionId);
        return { ok: true };
      }

      if (typeof signUp.finalize === 'function') {
        await signUp.finalize();
        if (onComplete) {
          await onComplete();
        }
        return { ok: true };
      }
    }

    logClerkAuthFailureOutcome('SSO flow', {
      reason: 'missing_requirements',
      missingFields,
    });
    return { ok: false, reason: 'missing_requirements', missingFields };
  }

  if (signUp?.status === 'complete') {
    if (signUp.createdSessionId && setActive) {
      await activateSession(signUp.createdSessionId);
      return { ok: true };
    }

    if (typeof signUp.finalize === 'function') {
      await signUp.finalize();
      if (onComplete) {
        await onComplete();
      }
      return { ok: true };
    }
  }

  logClerkAuthError('SSO incomplete', {
    authSessionType: authSessionResult?.type,
    authSessionUrl: authSessionResult?.url,
    hasSetActive: Boolean(setActive),
    hasCreatedSessionId: Boolean(createdSessionId),
    signInStatus: signIn?.status,
    signUpStatus: signUp?.status,
    missingFields: signUp?.missingFields,
    signInError: signIn?.firstFactorVerification?.error,
    signUpError: signUp?.verifications?.externalAccount?.error,
    rawResult: safeStringify(result),
  });

  if (authSessionResult?.type === 'success' && !createdSessionId && !signIn && !signUp) {
    return { ok: false, reason: 'callback_not_processed' };
  }

  return { ok: false, reason: 'empty_result' };
}

export function getClerkNetworkErrorMessage(error) {
  const message = error?.message || '';
  const isNetworkError =
    error?.code === 'network_error' ||
    message.includes('Network request failed') ||
    message.includes('Network error');

  if (!isNetworkError) {
    return null;
  }

  if (message.includes('clerk.mediping.website')) {
    return (
      'Cannot reach Clerk at clerk.mediping.website (SSL/network failure). ' +
      'Open Clerk Dashboard → Configure → Domains and verify the custom domain shows a valid certificate. ' +
      'For local dev, use a pk_test_... key from a Development instance instead of pk_live_....'
    );
  }

  return 'Network error contacting Clerk. Check your internet connection and try again.';
}

export function getClerkSSOIncompleteMessage(outcome) {
  switch (outcome?.reason) {
    case 'auth_cancelled':
      return null;
    case 'clerk_not_ready':
      return 'Clerk is still initializing. Wait a few seconds and try again. If this persists, enable Native applications in the Clerk dashboard and restart the app.';
    case 'missing_verification_url':
      return 'Google/Apple sign-in is not enabled in Clerk, or OAuth credentials are missing. Check Social connections in the Clerk dashboard.';
    case 'callback_not_processed':
      return 'Sign-in returned to the app but Clerk did not receive a session. Add mediping://sso-callback to Clerk Dashboard → Redirect URLs.';
    case 'empty_result':
      return 'Sign-in did not return a session. Confirm Google/Apple OAuth is enabled in Clerk and mediping://sso-callback is in Redirect URLs.';
    case 'needs_second_factor':
      return 'This account requires an additional verification step. Try signing in with email and password instead.';
    case 'needs_client_trust':
      return 'Clerk needs to verify this device. Try signing in with email and password instead.';
    case 'account_not_found':
      return 'No MediPing account exists for this Google/Apple login yet. Tap Create Account first, then use the same provider.';
    case 'missing_requirements':
      if (outcome.missingFields?.length) {
        return `Clerk still requires: ${outcome.missingFields.join(', ')}. Make those fields optional in the Clerk dashboard, or contact support.`;
      }
      return 'Your social account is missing required profile fields in Clerk. Check required fields in the Clerk dashboard.';
    default:
      return 'Sign-in did not finish. Confirm Google/Apple OAuth and redirect URLs are configured in Clerk, then try again.';
  }
}

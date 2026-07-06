import { useCallback, useEffect, useMemo, useRef } from 'react';
import * as WebBrowser from 'expo-web-browser';
import { useAuth, useClerk } from '@clerk/expo';
import { useSignIn as useLegacySignIn, useSignUp as useLegacySignUp } from '@clerk/expo/legacy';
import {
  completeClerkSSOFlow,
  getClerkSSORedirectUrl,
  logClerkAuthError,
} from '../utils/completeClerkSSOFlow';

const waitForClerkLoaded = (clerk, timeoutMs = 20000) =>
  new Promise((resolve) => {
    if (!clerk) {
      resolve(false);
      return;
    }

    if (clerk.loaded) {
      resolve(true);
      return;
    }

    const deadline = Date.now() + timeoutMs;
    let settled = false;

    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    if (typeof clerk.addOnLoaded === 'function') {
      clerk.addOnLoaded(() => finish(true));
    }

    const poll = setInterval(() => {
      if (clerk.loaded) {
        clearInterval(poll);
        finish(true);
        return;
      }

      if (Date.now() >= deadline) {
        clearInterval(poll);
        finish(false);
      }
    }, 100);
  });

const ensureClerkClientResources = async (clerk) => {
  if (!clerk) {
    return null;
  }

  const loaded = await waitForClerkLoaded(clerk);
  if (!loaded) {
    return null;
  }

  if (typeof clerk.__internal_reloadInitialResources === 'function') {
    try {
      await clerk.__internal_reloadInitialResources();
    } catch (error) {
      logClerkAuthError('Clerk reloadInitialResources failed', {
        message: error?.message,
      });
    }
  }

  const signIn = clerk.client?.signIn;
  const signUp = clerk.client?.signUp;

  if (!signIn || !signUp) {
    logClerkAuthError('Clerk client missing signIn/signUp resources', {
      loaded: clerk.loaded,
      hasClient: Boolean(clerk.client),
      clientKeys: clerk.client ? Object.keys(clerk.client) : [],
    });
    return null;
  }

  return {
    signIn,
    signUp,
    setActive: clerk.setActive.bind(clerk),
  };
};

export function useBrowserClerkSSO() {
  const { isLoaded: authLoaded } = useAuth();
  const clerk = useClerk();
  const { isLoaded: legacySignInLoaded } = useLegacySignIn();
  const { isLoaded: legacySignUpLoaded } = useLegacySignUp();
  const redirectUrl = useMemo(() => getClerkSSORedirectUrl(), []);

  const isReady = authLoaded && Boolean(clerk?.loaded) && legacySignInLoaded && legacySignUpLoaded;

  const stateRef = useRef({ clerk, isReady, authLoaded, legacySignInLoaded, legacySignUpLoaded });
  stateRef.current = { clerk, isReady, authLoaded, legacySignInLoaded, legacySignUpLoaded };

  useEffect(() => {
    if (__DEV__) {
      console.log('🔍 Clerk browser SSO readiness:', {
        authLoaded,
        clerkLoaded: Boolean(clerk?.loaded),
        legacySignInLoaded,
        legacySignUpLoaded,
        isReady,
      });
    }
  }, [authLoaded, clerk?.loaded, legacySignInLoaded, legacySignUpLoaded, isReady]);

  const waitForReady = useCallback(async (timeoutMs = 20000) => {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const { clerk: currentClerk, isReady: readyNow } = stateRef.current;
      if (readyNow) {
        return true;
      }

      if (currentClerk) {
        const resources = await ensureClerkClientResources(currentClerk);
        if (resources) {
          return true;
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 150));
    }

    return false;
  }, []);

  const startBrowserSSO = useCallback(
    async ({ strategy, onComplete } = {}) => {
      const ready = await waitForReady();
      const { clerk: currentClerk, authLoaded: authReady, legacySignInLoaded: signInReady, legacySignUpLoaded: signUpReady } =
        stateRef.current;

      const resources = await ensureClerkClientResources(currentClerk);
      if (!ready || !resources) {
        logClerkAuthError('Browser SSO blocked — Clerk not ready', {
          strategy,
          authLoaded: authReady,
          clerkLoaded: Boolean(currentClerk?.loaded),
          legacySignInLoaded: signInReady,
          legacySignUpLoaded: signUpReady,
        });
        return { ok: false, reason: 'clerk_not_ready' };
      }

      const { signIn, signUp, setActive } = resources;

      try {
        await signIn.create({ strategy, redirectUrl });
      } catch (error) {
        logClerkAuthError('Browser SSO signIn.create failed', {
          strategy,
          message: error?.message,
          errors: error?.errors,
        });
        throw error;
      }

      const externalVerificationRedirectURL =
        signIn.firstFactorVerification?.externalVerificationRedirectURL;

      if (!externalVerificationRedirectURL) {
        logClerkAuthError('Browser SSO missing external verification URL', {
          strategy,
          signInStatus: signIn.status,
          verificationStatus: signIn.firstFactorVerification?.status,
          verificationError: signIn.firstFactorVerification?.error,
        });
        return { ok: false, reason: 'missing_verification_url' };
      }

      const authSessionResult = await WebBrowser.openAuthSessionAsync(
        externalVerificationRedirectURL.toString(),
        redirectUrl
      );

      if (authSessionResult.type === 'cancel' || authSessionResult.type === 'dismiss') {
        return { ok: false, reason: 'auth_cancelled' };
      }

      if (authSessionResult.type !== 'success' || !authSessionResult.url) {
        logClerkAuthError('Browser SSO auth session did not succeed', {
          strategy,
          authSessionType: authSessionResult?.type,
        });
        return completeClerkSSOFlow(
          { createdSessionId: null, setActive, signIn, signUp, authSessionResult },
          { onComplete }
        );
      }

      const params = new URL(authSessionResult.url).searchParams;
      const rotatingTokenNonce = params.get('rotating_token_nonce') ?? '';
      await signIn.reload({ rotatingTokenNonce });

      if (signIn.firstFactorVerification?.status === 'transferable') {
        await signUp.create({ transfer: true });
      }

      return completeClerkSSOFlow(
        {
          createdSessionId: signUp.createdSessionId ?? signIn.createdSessionId ?? null,
          setActive,
          signIn,
          signUp,
          authSessionResult,
        },
        { onComplete }
      );
    },
    [redirectUrl, waitForReady]
  );

  return {
    startBrowserSSO,
    isReady,
    redirectUrl,
  };
}

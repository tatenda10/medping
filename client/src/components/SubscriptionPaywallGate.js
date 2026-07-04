import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../context/SubscriptionContext';
import { openSubscriptionPaywall } from '../navigation/postAuthNavigation';

const userIsSubscribed = ({ hasPremiumAccess, hasBasicAccess, activeEntitlementIds }) =>
  hasPremiumAccess || hasBasicAccess || activeEntitlementIds.length > 0;

const SubscriptionPaywallGate = ({ stackNavigation }) => {
  const { isAuthenticated, isLoaded } = useAuth();
  const {
    isLoading: subscriptionLoading,
    isReady: subscriptionReady,
    hasPremiumAccess,
    hasBasicAccess,
    activeEntitlementIds,
    isSupported: purchasesSupported,
  } = useSubscription();
  const paywallShownRef = useRef(false);
  const wasAuthenticatedRef = useRef(false);

  useEffect(() => {
    if (isAuthenticated && !wasAuthenticatedRef.current) {
      paywallShownRef.current = false;
    }
    wasAuthenticatedRef.current = isAuthenticated;

    if (!isLoaded || !isAuthenticated) {
      if (!isAuthenticated) {
        paywallShownRef.current = false;
      }
      return;
    }

    if (!purchasesSupported) {
      return;
    }

    if (subscriptionLoading && !subscriptionReady) {
      return;
    }

    if (userIsSubscribed({ hasPremiumAccess, hasBasicAccess, activeEntitlementIds })) {
      paywallShownRef.current = false;
      return;
    }

    if (paywallShownRef.current) {
      return;
    }

    paywallShownRef.current = true;

    if (stackNavigation?.navigate) {
      stackNavigation.navigate('Subscription');
      return;
    }

    openSubscriptionPaywall();
  }, [
    isAuthenticated,
    isLoaded,
    subscriptionLoading,
    subscriptionReady,
    hasPremiumAccess,
    hasBasicAccess,
    activeEntitlementIds,
    purchasesSupported,
    stackNavigation,
  ]);

  return null;
};

export default SubscriptionPaywallGate;

import { CommonActions } from '@react-navigation/native';
import { navigationRef } from './navigationRef';
import {
  fetchCustomerInfo,
  getActiveEntitlementIds,
  getEntitlementSummary,
  isPurchasesConfigured,
  isPurchasesSupported,
} from '../services/purchasesService';

let postAuthReadyHandler = null;

export const registerPostAuthReadyHandler = (handler) => {
  postAuthReadyHandler = handler;
};

export const userHasActiveSubscription = async (customerInfo = null) => {
  if (!isPurchasesSupported()) {
    return false;
  }

  try {
    const info = customerInfo || (isPurchasesConfigured() ? await fetchCustomerInfo() : null);
    if (!info) {
      return false;
    }

    const summary = getEntitlementSummary(info);
    const activeIds = getActiveEntitlementIds(info);

    return summary.basicAccess || summary.premiumAccess || activeIds.length > 0;
  } catch (error) {
    console.warn('Subscription check failed:', error?.message);
    return false;
  }
};

const waitForSubscriptionStatus = async (maxAttempts = 6) => {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (isPurchasesConfigured()) {
      return userHasActiveSubscription();
    }

    await new Promise((resolve) => setTimeout(resolve, 350));
  }

  return false;
};

export const openSubscriptionPaywall = () => {
  if (!navigationRef.current?.isReady()) {
    return false;
  }

  navigationRef.current.navigate('MainApp', { screen: 'Subscription' });
  return true;
};

const buildResetAction = (shouldShowPaywall) => {
  if (shouldShowPaywall) {
    return CommonActions.reset({
      index: 0,
      routes: [
        {
          name: 'MainApp',
          state: {
            index: 1,
            routes: [{ name: 'MainTabs' }, { name: 'Subscription' }],
          },
        },
      ],
    });
  }

  return CommonActions.reset({
    index: 0,
    routes: [{ name: 'MainApp' }],
  });
};

const dispatchNavigation = (shouldShowPaywall) => {
  if (!navigationRef.current?.isReady()) {
    return false;
  }

  navigationRef.current.dispatch(buildResetAction(shouldShowPaywall));
  postAuthReadyHandler?.();
  return true;
};

export async function navigateAfterAuthentication({ forcePaywall = null } = {}) {
  let shouldShowPaywall = forcePaywall === true;

  if (forcePaywall !== false && !shouldShowPaywall) {
    if (isPurchasesSupported()) {
      const subscribed = await waitForSubscriptionStatus();
      shouldShowPaywall = !subscribed;
    }
  }

  if (!dispatchNavigation(shouldShowPaywall)) {
    setTimeout(() => dispatchNavigation(shouldShowPaywall), 300);
  }
}

export async function shouldShowSubscriptionPaywall() {
  if (!isPurchasesSupported()) {
    return false;
  }

  const subscribed = await waitForSubscriptionStatus();
  return !subscribed;
}

// Backwards-compatible alias
export const openSubscriptionIfPending = openSubscriptionPaywall;

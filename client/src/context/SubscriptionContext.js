import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { ENTITLEMENTS } from '../constants/subscriptions';
import {
  configurePurchases,
  fetchCustomerInfo,
  fetchOfferings,
  getActiveEntitlementIds,
  getCurrentOffering,
  getEntitlementSummary,
  getPurchasesConfigError,
  hasEntitlement,
  identifyPurchasesUser,
  isPurchasesConfigured,
  isPurchasesSupported,
  logoutPurchasesUser,
  purchasePackage,
  restorePurchases,
} from '../services/purchasesService';

const SubscriptionContext = createContext(null);

export const SubscriptionProvider = ({ children }) => {
  const { isLoaded, isAuthenticated, userId } = useAuth();
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [customerInfo, setCustomerInfo] = useState(null);
  const [offerings, setOfferings] = useState(null);
  const [error, setError] = useState(null);

  const refreshSubscriptionState = useCallback(async () => {
    if (!isPurchasesSupported()) {
      setIsReady(false);
      setIsLoading(false);
      return;
    }

    if (!isPurchasesConfigured()) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const info = await fetchCustomerInfo();
      const offeringData = await fetchOfferings();

      setCustomerInfo(info);
      setOfferings(offeringData);
      setIsReady(true);

      const activeEntitlements = getActiveEntitlementIds(info);
      const currentOffering = getCurrentOffering(offeringData);
      const packages = currentOffering?.availablePackages || [];

      console.log('💳 RevenueCat entitlements:', activeEntitlements);
      console.log(
        '💳 RevenueCat products:',
        packages.map((pkg) => ({
          packageId: pkg.identifier,
          productId: pkg.product?.identifier,
          price: pkg.product?.priceString,
        }))
      );
    } catch (refreshError) {
      console.error('RevenueCat refresh failed:', refreshError);
      const message = refreshError?.message || 'Failed to load subscription data';
      if (message.toLowerCase().includes('credentials')) {
        setError(
          'RevenueCat rejected the API key. Confirm the Android/iOS public SDK keys in RevenueCat → Project → API keys match client/.env, then restart with: npx expo start -c'
        );
      } else {
        setError(message);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    let cancelled = false;

    const syncPurchasesUser = async () => {
      if (!isPurchasesSupported()) {
        setIsLoading(false);
        return;
      }

      try {
        const configError = getPurchasesConfigError();
        if (configError) {
          if (!cancelled) {
            setError(configError);
            setIsLoading(false);
          }
          return;
        }

        if (!isPurchasesConfigured()) {
          const configured = await configurePurchases(
            isAuthenticated && userId ? userId : null
          );
          if (!configured || cancelled) {
            return;
          }
        } else if (isAuthenticated && userId) {
          const info = await identifyPurchasesUser(userId);
          if (!cancelled) {
            setCustomerInfo(info);
          }
        } else {
          await logoutPurchasesUser();
          if (!cancelled) {
            setCustomerInfo(null);
          }
        }

        if (!cancelled) {
          await refreshSubscriptionState();
        }
      } catch (syncError) {
        console.error('RevenueCat user sync failed:', syncError);
        if (!cancelled) {
          const message = syncError?.message || 'Failed to sync subscription account';
          if (message.toLowerCase().includes('credentials')) {
            setError(
              'RevenueCat rejected the API key. Confirm the Android/iOS public SDK keys in RevenueCat → Project → API keys match client/.env, then restart with: npx expo start -c'
            );
          } else {
            setError(message);
          }
          setIsLoading(false);
        }
      }
    };

    syncPurchasesUser();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isAuthenticated, userId, refreshSubscriptionState]);

  const currentOffering = useMemo(() => getCurrentOffering(offerings), [offerings]);
  const packages = useMemo(
    () => currentOffering?.availablePackages || [],
    [currentOffering]
  );
  const activeEntitlementIds = useMemo(
    () => getActiveEntitlementIds(customerInfo),
    [customerInfo]
  );
  const entitlements = useMemo(
    () => getEntitlementSummary(customerInfo),
    [customerInfo]
  );

  const purchase = useCallback(async (rcPackage) => {
    const info = await purchasePackage(rcPackage);
    setCustomerInfo(info);
    return info;
  }, []);

  const restore = useCallback(async () => {
    const info = await restorePurchases();
    setCustomerInfo(info);
    await refreshSubscriptionState();
    return info;
  }, [refreshSubscriptionState]);

  const value = {
    isReady,
    isLoading,
    isSupported: isPurchasesSupported(),
    error,
    customerInfo,
    offerings,
    currentOffering,
    packages,
    activeEntitlementIds,
    entitlements,
    hasEntitlement: (entitlementId) => hasEntitlement(customerInfo, entitlementId),
    hasBasicAccess: entitlements.basicAccess,
    hasPremiumAccess: entitlements.premiumAccess,
    hasSmsNotifications: entitlements.smsNotifications,
    hasVoiceCalls: entitlements.voiceCalls,
    hasCaregiverAccess: entitlements.caregiverAccess,
    refreshSubscriptionState,
    purchase,
    restore,
    ENTITLEMENTS,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within SubscriptionProvider');
  }
  return context;
};

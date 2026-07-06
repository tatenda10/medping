import { Platform } from 'react-native';
import Constants from 'expo-constants';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import { ENTITLEMENTS, OFFERING_ID } from '../constants/subscriptions';

const trimKey = (value) => (typeof value === 'string' ? value.trim() : '');

const extra = Constants.expoConfig?.extra || Constants.manifest2?.extra || {};

const IOS_API_KEY = trimKey(
  extra.revenueCatIosApiKey || process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY
);
const ANDROID_API_KEY = trimKey(
  extra.revenueCatAndroidApiKey || process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY
);

let configured = false;
let configuredApiKey = null;

const isSupportedPlatform = () => Platform.OS === 'ios' || Platform.OS === 'android';

const maskApiKey = (apiKey) => {
  if (!apiKey || apiKey.length < 10) {
    return '(missing or invalid)';
  }

  return `${apiKey.slice(0, 5)}...${apiKey.slice(-4)}`;
};

const validateApiKey = (apiKey) => {
  if (!apiKey) {
    return 'RevenueCat API key is missing. Add EXPO_PUBLIC_REVENUECAT_* keys to client/.env and restart Expo with cache cleared (npx expo start -c).';
  }

  if (Platform.OS === 'ios' && !apiKey.startsWith('appl_')) {
    return `RevenueCat iOS key must start with appl_. Got: ${maskApiKey(apiKey)}`;
  }

  if (Platform.OS === 'android' && !apiKey.startsWith('goog_')) {
    return `RevenueCat Android key must start with goog_. Got: ${maskApiKey(apiKey)}`;
  }

  return null;
};

const getApiKey = () => {
  if (Platform.OS === 'ios') {
    return IOS_API_KEY;
  }
  if (Platform.OS === 'android') {
    return ANDROID_API_KEY;
  }
  return null;
};

export const configurePurchases = async (appUserID = null) => {
  if (!isSupportedPlatform()) {
    console.log('RevenueCat: skipped on', Platform.OS);
    return false;
  }

  const apiKey = getApiKey();
  const validationError = validateApiKey(apiKey);

  if (validationError) {
    console.error('RevenueCat:', validationError);
    return false;
  }

  if (configured && configuredApiKey === apiKey) {
    return true;
  }

  if (__DEV__) {
    Purchases.setLogLevel(LOG_LEVEL.VERBOSE);
  }

  const config = { apiKey };
  if (appUserID) {
    config.appUserID = String(appUserID);
  }

  console.log(
    `RevenueCat: configuring for ${Platform.OS} with key ${maskApiKey(apiKey)}` +
      (appUserID ? ` user=${appUserID}` : '')
  );

  Purchases.configure(config);
  configured = true;
  configuredApiKey = apiKey;
  console.log('✅ RevenueCat configured');
  return true;
};

export const identifyPurchasesUser = async (appUserId) => {
  if (!configured || !appUserId) {
    return null;
  }

  const { customerInfo } = await Purchases.logIn(String(appUserId));
  return customerInfo;
};

const isAnonymousRevenueCatUser = async () => {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    const appUserId = customerInfo?.originalAppUserId || '';
    return appUserId.startsWith('$RCAnonymousID:');
  } catch {
    return true;
  }
};

export const logoutPurchasesUser = async () => {
  if (!configured) {
    return null;
  }

  try {
    if (await isAnonymousRevenueCatUser()) {
      return null;
    }

    return await Purchases.logOut();
  } catch (error) {
    const message = error?.message || '';
    if (message.toLowerCase().includes('anonymous')) {
      return null;
    }
    console.log('RevenueCat logout skipped:', message);
    return null;
  }
};

export const fetchCustomerInfo = async () => {
  if (!configured) {
    return null;
  }

  return Purchases.getCustomerInfo();
};

export const fetchOfferings = async () => {
  if (!configured) {
    return null;
  }

  const offerings = await Purchases.getOfferings();
  const analysis = analyzeOfferings(offerings);

  console.log('💳 RevenueCat offerings (from Purchases.getOfferings):', {
    currentOfferingId: analysis.diagnostics.offeringId,
    packageCount: analysis.diagnostics.packageCount,
    storeProductCount: analysis.diagnostics.storeProductCount,
    packages: analysis.diagnostics.packageSummaries,
    allOfferingIds: analysis.diagnostics.allOfferingIds,
  });

  if (analysis.isEmpty) {
    console.warn(
      '💳 RevenueCat: offerings.current is null or has no packages. Check RevenueCat dashboard offerings and store product activation.'
    );
  } else if (!analysis.hasStoreProducts) {
    console.warn(
      '💳 RevenueCat: packages exist but store products are missing. On Android, install from Play internal testing with license testers configured.'
    );
  }

  return offerings;
};

export const getCurrentOffering = (offerings) => {
  if (!offerings) {
    return null;
  }

  return offerings.current || offerings.all?.[OFFERING_ID] || null;
};

const normalizeId = (value) => String(value || '').toLowerCase();

export const inferPackageTier = (pkg) => {
  const id = normalizeId(pkg?.identifier);
  if (id.includes('premium')) {
    return 'premium';
  }
  if (id.includes('basic')) {
    return 'basic';
  }
  return null;
};

export const inferPackagePeriod = (pkg) => {
  const id = normalizeId(pkg?.identifier);
  const type = normalizeId(pkg?.packageType);

  if (id.includes('yearly') || id.includes('annual') || type.includes('annual')) {
    return 'yearly';
  }
  if (id.includes('monthly') || type.includes('monthly')) {
    return 'monthly';
  }
  return null;
};

export const groupOfferingPackages = (packages = []) => {
  const grouped = {
    premium: { monthly: null, yearly: null },
    basic: { monthly: null, yearly: null },
  };

  for (const pkg of packages) {
    const tier = inferPackageTier(pkg);
    const period = inferPackagePeriod(pkg);
    if (tier && period && !grouped[tier][period]) {
      grouped[tier][period] = pkg;
    }
  }

  return grouped;
};

export const selectOfferingPackage = (packages, tier, period) => {
  const grouped = groupOfferingPackages(packages);
  return grouped[tier]?.[period] || null;
};

export const analyzeOfferings = (offerings) => {
  const currentOffering = getCurrentOffering(offerings);
  const packages = currentOffering?.availablePackages || [];
  const packagesWithStoreProduct = packages.filter((pkg) => pkg?.product?.identifier);

  return {
    currentOffering,
    packages,
    grouped: groupOfferingPackages(packages),
    hasOffering: Boolean(currentOffering),
    hasPackages: packages.length > 0,
    hasStoreProducts: packagesWithStoreProduct.length > 0,
    isEmpty: !currentOffering || packages.length === 0,
    diagnostics: {
      offeringId: currentOffering?.identifier || null,
      packageCount: packages.length,
      storeProductCount: packagesWithStoreProduct.length,
      packageSummaries: packages.map((pkg) => ({
        packageId: pkg.identifier,
        storeProductId: pkg.product?.identifier || null,
        price: pkg.product?.priceString || null,
        packageType: pkg.packageType,
      })),
      allOfferingIds: offerings?.all ? Object.keys(offerings.all) : [],
    },
  };
};

export const getOfferingsEmptyMessage = () => {
  if (Platform.OS === 'android') {
    return 'Plans could not be loaded from Google Play. Upload the app to Play Console internal testing, install from the Play Store test link, activate subscriptions, and add your Google account as a license tester.';
  }
  if (Platform.OS === 'ios') {
    return 'Plans could not be loaded from the App Store. Check App Store Connect products and RevenueCat offerings.';
  }
  return 'Subscription plans are not available on this device.';
};

export const getPurchaseUnavailableMessage = () => {
  if (Platform.OS === 'android') {
    return 'This plan is not available for purchase on this device. Install MediPing from the Play Store internal testing track using a license tester account.';
  }
  return 'This plan is not available for purchase on this device yet.';
};

export const isPackageActive = (pkg, activeProductId) => {
  if (!pkg?.product?.identifier || !activeProductId) {
    return false;
  }

  const storeId = pkg.product.identifier;
  const baseId = storeId.split(':')[0];
  return (
    storeId === activeProductId ||
    baseId === activeProductId ||
    storeId.includes(activeProductId) ||
    activeProductId.includes(baseId)
  );
};

export const getActiveSubscriptionDetails = (customerInfo, packages = []) => {
  const activeEntitlements = customerInfo?.entitlements?.active || {};
  const entitlement =
    activeEntitlements[ENTITLEMENTS.PREMIUM_ACCESS] ||
    activeEntitlements[ENTITLEMENTS.BASIC_ACCESS] ||
    Object.values(activeEntitlements)[0] ||
    null;

  if (!entitlement) {
    return null;
  }

  const productId = entitlement.productIdentifier || '';
  const matchedPackage =
    packages.find((pkg) => isPackageActive(pkg, productId)) || null;

  const tier =
    inferPackageTier(matchedPackage) ||
    (productId.includes('premium') ? 'premium' : productId.includes('basic') ? 'basic' : null);
  const period =
    inferPackagePeriod(matchedPackage) ||
    (productId.includes('yearly') || productId.includes('annual')
      ? 'yearly'
      : productId.includes('monthly')
        ? 'monthly'
        : null);

  const planLabel =
    tier === 'premium'
      ? 'MediPing Premium'
      : tier === 'basic'
        ? 'MediPing Basic'
        : 'Active plan';
  const periodLabel = period === 'yearly' ? 'Yearly' : period === 'monthly' ? 'Monthly' : null;

  return {
    planLabel,
    periodLabel,
    priceString: matchedPackage?.product?.priceString || null,
    productId,
    expirationDate: entitlement.expirationDate,
    willRenew: entitlement.willRenew,
    tier,
    matchedPackage,
  };
};

export const getActiveEntitlementIds = (customerInfo) => {
  if (!customerInfo?.entitlements?.active) {
    return [];
  }

  return Object.keys(customerInfo.entitlements.active);
};

export const hasEntitlement = (customerInfo, entitlementId) => {
  return Boolean(customerInfo?.entitlements?.active?.[entitlementId]);
};

export const getEntitlementSummary = (customerInfo) => ({
  basicAccess: hasEntitlement(customerInfo, ENTITLEMENTS.BASIC_ACCESS),
  premiumAccess: hasEntitlement(customerInfo, ENTITLEMENTS.PREMIUM_ACCESS),
  smsNotifications: hasEntitlement(customerInfo, ENTITLEMENTS.SMS_NOTIFICATIONS),
  voiceCalls: hasEntitlement(customerInfo, ENTITLEMENTS.VOICE_CALLS),
  caregiverAccess: hasEntitlement(customerInfo, ENTITLEMENTS.CAREGIVER_ACCESS),
});

export const purchasePackage = async (rcPackage) => {
  if (!configured || !rcPackage) {
    throw new Error('RevenueCat is not configured');
  }

  const { customerInfo } = await Purchases.purchasePackage(rcPackage);
  return customerInfo;
};

export const restorePurchases = async () => {
  if (!configured) {
    throw new Error('RevenueCat is not configured');
  }

  return Purchases.restorePurchases();
};

export const isPurchasesConfigured = () => configured;

export const isPurchasesSupported = () => isSupportedPlatform();

export const getPurchasesConfigError = () => validateApiKey(getApiKey());

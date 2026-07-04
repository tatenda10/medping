import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useSubscription } from '../context/SubscriptionContext';
import { useAuthCheck } from '../hooks/useAuthCheck';
import { navigationRef } from '../navigation/navigationRef';
import {
  getActiveSubscriptionDetails,
  selectOfferingPackage,
} from '../services/purchasesService';

const BLUE = '#90CDF4';
const BLUE_DARK = '#0284C7';
const BLUE_LIGHT = '#E0F2FE';

const PREMIUM_FEATURES = [
  {
    icon: 'sms',
    title: 'SMS caregiver alerts',
    subtitle: 'Instant text updates when doses are missed',
  },
  {
    icon: 'phone-in-talk',
    title: 'Voice call reminders',
    subtitle: 'Phone reminders for critical medications',
  },
  {
    icon: 'people',
    title: 'Caregiver access',
    subtitle: 'Invite family to help manage your schedule',
  },
  {
    icon: 'assessment',
    title: 'Health reports',
    subtitle: 'Export adherence and vitals summaries',
  },
];

const BASIC_FEATURES = [
  {
    icon: 'notifications-active',
    title: 'Push reminders',
    subtitle: 'Never miss a dose with smart alerts',
  },
  {
    icon: 'medication',
    title: 'Medication tracking',
    subtitle: 'Log doses and monitor adherence',
  },
  {
    icon: 'calendar-today',
    title: 'Calendar view',
    subtitle: 'See your full schedule at a glance',
  },
  {
    icon: 'favorite',
    title: 'Vitals tracking',
    subtitle: 'Record blood pressure, glucose, and more',
  },
];

const formatRenewalDate = (isoDate) => {
  if (!isoDate) {
    return null;
  }

  try {
    return new Date(isoDate).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return null;
  }
};

const getPerMonthPrice = (product) => {
  if (!product?.price || product.price <= 0) {
    return null;
  }
  const perMonth = (product.price / 12).toFixed(2);
  const currency = product.currencyCode ? `${product.currencyCode} ` : '';
  return `${currency}${perMonth}`;
};

const SubscriptionScreen = ({ navigation, onLogout }) => {
  const { isAuthenticated } = useAuthCheck();
  const {
    isLoading,
    isSupported,
    error,
    packages,
    customerInfo,
    activeEntitlementIds,
    hasPremiumAccess,
    hasBasicAccess,
    purchase,
    restore,
  } = useSubscription();

  const [planTier, setPlanTier] = useState('premium');
  const [billingPeriod, setBillingPeriod] = useState('yearly');
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const monthlyPackage = useMemo(
    () => selectOfferingPackage(packages, planTier, 'monthly'),
    [planTier, packages]
  );

  const yearlyPackage = useMemo(
    () => selectOfferingPackage(packages, planTier, 'yearly'),
    [planTier, packages]
  );

  const selectedPackage = billingPeriod === 'yearly' ? yearlyPackage : monthlyPackage;
  const features = planTier === 'premium' ? PREMIUM_FEATURES : BASIC_FEATURES;
  const isSubscribed = hasPremiumAccess || hasBasicAccess || activeEntitlementIds.length > 0;

  const activeSubscription = useMemo(
    () => getActiveSubscriptionDetails(customerInfo, packages),
    [customerInfo, packages]
  );

  const subscribedFeatures = useMemo(() => {
    if (hasPremiumAccess || activeSubscription?.tier === 'premium') {
      return PREMIUM_FEATURES;
    }
    return BASIC_FEATURES;
  }, [hasPremiumAccess, activeSubscription?.tier]);

  const savingsPercent = useMemo(() => {
    const monthly = monthlyPackage?.product?.price;
    const yearly = yearlyPackage?.product?.price;
    if (!monthly || !yearly || monthly <= 0) {
      return null;
    }
    const yearlyAsMonthly = yearly / 12;
    const saved = Math.round((1 - yearlyAsMonthly / monthly) * 100);
    return saved > 0 ? saved : null;
  }, [monthlyPackage, yearlyPackage]);

  const billingNote = useMemo(() => {
    const product = selectedPackage?.product;
    if (!product?.priceString) {
      return 'Subscription renews automatically. Cancel anytime in your app store settings.';
    }
    if (billingPeriod === 'yearly') {
      const perMonth = getPerMonthPrice(product);
      return perMonth
        ? `${perMonth} per month, billed yearly. Auto-renews until cancelled.`
        : `${product.priceString} billed yearly. Auto-renews until cancelled.`;
    }
    return `${product.priceString} per month. Auto-renews until cancelled.`;
  }, [selectedPackage, billingPeriod]);

  const handlePurchase = async () => {
    if (!isAuthenticated) {
      navigationRef.current?.navigate('Login');
      return;
    }

    if (!selectedPackage) {
      Alert.alert('Unavailable', 'This plan is not available yet. Check RevenueCat product setup.');
      return;
    }

    setPurchasing(true);
    try {
      await purchase(selectedPackage);
      Alert.alert('Success', 'Your subscription is now active.');
    } catch (purchaseError) {
      if (!purchaseError?.userCancelled) {
        Alert.alert('Purchase failed', purchaseError?.message || 'Could not complete purchase.');
      }
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      await restore();
      Alert.alert('Restored', 'Your purchases have been restored.');
    } catch (restoreError) {
      Alert.alert('Restore failed', restoreError?.message || 'Could not restore purchases.');
    } finally {
      setRestoring(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'You need an active plan to use MediPing with an account. Log out to return to the welcome screen.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: () => onLogout?.(),
        },
      ]
    );
  };

  const renderSmallToggle = (options, value, onChange) => (
    <View style={styles.smallToggle}>
      {options.map((option) => {
        const active = value === option.key;
        return (
          <TouchableOpacity
            key={option.key}
            style={[styles.smallToggleOption, active && styles.smallToggleOptionActive]}
            onPress={() => onChange(option.key)}
            activeOpacity={0.8}
          >
            <Text style={[styles.smallToggleText, active && styles.smallToggleTextActive]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderFeatureRow = (feature) => (
    <View key={feature.title} style={styles.featureRow}>
      <View style={styles.featureIconWrap}>
        <MaterialIcons name={feature.icon} size={20} color={BLUE_DARK} />
      </View>
      <View style={styles.featureTextWrap}>
        <Text style={styles.featureTitle}>{feature.title}</Text>
        <Text style={styles.featureSubtitle}>{feature.subtitle}</Text>
      </View>
      <View style={styles.checkWrap}>
        <Ionicons name="checkmark-circle" size={22} color={BLUE_DARK} />
      </View>
    </View>
  );

  const renderPricingCard = (period, pkg, isSelected) => {
    const product = pkg?.product;
    const label = period === 'yearly' ? 'Yearly' : 'Monthly';
    const perMonth = period === 'yearly' ? getPerMonthPrice(product) : null;

    return (
      <TouchableOpacity
        key={period}
        style={[styles.priceCard, isSelected && styles.priceCardSelected]}
        onPress={() => setBillingPeriod(period)}
        activeOpacity={0.85}
      >
        {period === 'yearly' && savingsPercent ? (
          <View style={styles.saveBadge}>
            <Text style={styles.saveBadgeText}>Save {savingsPercent}%</Text>
          </View>
        ) : null}
        <Text style={[styles.priceCardLabel, isSelected && styles.priceCardLabelSelected]}>
          {label}
        </Text>
        <Text style={[styles.priceCardAmount, isSelected && styles.priceCardAmountSelected]}>
          {product?.priceString || '—'}
        </Text>
        <Text style={styles.priceCardSub}>
          {period === 'yearly' && perMonth ? `${perMonth} / mo` : 'Billed monthly'}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderSubscribed = () => (
    <View style={styles.subscribedContent}>
      <View style={styles.subscribedHeader}>
        <MaterialIcons name="verified" size={40} color={BLUE_DARK} />
        <Text style={styles.subscribedTitle}>You&apos;re subscribed</Text>
      </View>

      <View style={styles.currentPlanSection}>
        <View style={styles.currentPlanRow}>
          <View style={styles.currentPlanInfo}>
            <Text style={styles.currentPlanName}>
              {activeSubscription?.planLabel ||
                (hasPremiumAccess
                  ? 'MediPing Premium'
                  : hasBasicAccess
                    ? 'MediPing Basic'
                    : 'Active plan')}
            </Text>
            {activeSubscription?.periodLabel ? (
              <Text style={styles.currentPlanPeriod}>{activeSubscription.periodLabel} billing</Text>
            ) : null}
            {activeSubscription?.expirationDate ? (
              <Text style={styles.currentPlanRenewal}>
                {activeSubscription.willRenew ? 'Renews' : 'Expires'}{' '}
                {formatRenewalDate(activeSubscription.expirationDate)}
              </Text>
            ) : null}
          </View>
          <Text style={styles.currentPlanPrice}>
            {activeSubscription?.priceString || '—'}
          </Text>
        </View>
      </View>

      <View style={styles.includedSection}>
        <Text style={styles.sectionLabel}>Included in your plan</Text>
        <View style={styles.includedFeaturesList}>
          {subscribedFeatures.map((feature) => (
            <View key={feature.title} style={styles.includedFeatureRow}>
              {renderFeatureRow(feature)}
            </View>
          ))}
        </View>
      </View>
    </View>
  );

  const renderPaywall = () => (
    <>
      <Text style={styles.headline}>
        {planTier === 'premium' ? 'Enable Premium Access' : 'Enable Basic Access'}
      </Text>

      <View style={styles.toggleRow}>
        {renderSmallToggle(
          [
            { key: 'premium', label: 'Premium' },
            { key: 'basic', label: 'Basic' },
          ],
          planTier,
          setPlanTier
        )}
      </View>

      <View style={styles.featuresCard}>{features.map(renderFeatureRow)}</View>

      <View style={styles.priceCardsRow}>
        {renderPricingCard('monthly', monthlyPackage, billingPeriod === 'monthly')}
        {renderPricingCard('yearly', yearlyPackage, billingPeriod === 'yearly')}
      </View>

      <Text style={styles.billingNote}>{billingNote}</Text>

      <TouchableOpacity
        style={[styles.primaryButton, purchasing && styles.primaryButtonDisabled]}
        onPress={handlePurchase}
        disabled={purchasing || isLoading}
        activeOpacity={0.85}
      >
        {purchasing ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.primaryButtonText}>Start My Plan</Text>
        )}
      </TouchableOpacity>
    </>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {isSubscribed ? (
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.doneText}>Done</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {!isSupported ? (
          <Text style={styles.errorText}>
            Subscriptions are available on iOS and Android devices only.
          </Text>
        ) : isLoading && packages.length === 0 ? (
          <ActivityIndicator color={BLUE_DARK} size="large" style={{ marginTop: 40 }} />
        ) : isSubscribed ? (
          renderSubscribed()
        ) : (
          renderPaywall()
        )}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {!isSubscribed && onLogout ? (
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutText}>Log out</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.footerLinks}>
          <TouchableOpacity onPress={() => Linking.openURL('https://mediping.website/terms-of-service')}>
            <Text style={styles.footerLink}>Terms of service</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Linking.openURL('https://mediping.website/privacy-policy')}>
            <Text style={styles.footerLink}>Privacy policy</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleRestore} disabled={restoring}>
            <Text style={styles.footerLink}>{restoring ? 'Restoring...' : 'Restore purchase'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  closeButton: {
    padding: 4,
  },
  doneText: {
    color: BLUE_DARK,
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexGrow: 1,
  },
  headline: {
    color: '#111827',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
    lineHeight: 26,
  },
  toggleRow: {
    alignItems: 'center',
    marginBottom: 16,
  },
  smallToggle: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    padding: 3,
  },
  smallToggleOption: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 18,
  },
  smallToggleOptionActive: {
    backgroundColor: BLUE,
  },
  smallToggleText: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '600',
  },
  smallToggleTextActive: {
    color: '#FFFFFF',
  },
  featuresCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  featureIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: BLUE_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  featureTextWrap: {
    flex: 1,
    paddingRight: 8,
  },
  featureTitle: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '700',
  },
  featureSubtitle: {
    color: '#6B7280',
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  checkWrap: {
    marginLeft: 4,
  },
  priceCardsRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  priceCard: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    padding: 16,
    paddingTop: 20,
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
    marginHorizontal: 6,
  },
  priceCardSelected: {
    backgroundColor: '#FFFFFF',
    borderColor: BLUE,
  },
  saveBadge: {
    position: 'absolute',
    top: -10,
    alignSelf: 'center',
    backgroundColor: BLUE_DARK,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  saveBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  priceCardLabel: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  priceCardLabelSelected: {
    color: '#111827',
  },
  priceCardAmount: {
    color: '#374151',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
  },
  priceCardAmountSelected: {
    color: '#111827',
  },
  priceCardSub: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  billingNote: {
    color: '#9CA3AF',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  primaryButton: {
    backgroundColor: BLUE_DARK,
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  subscribedContent: {
    paddingTop: 8,
    paddingBottom: 8,
  },
  subscribedHeader: {
    alignItems: 'center',
    marginBottom: 28,
  },
  subscribedTitle: {
    color: '#111827',
    fontSize: 24,
    fontWeight: '700',
    marginTop: 12,
  },
  sectionLabel: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 12,
  },
  currentPlanSection: {
    marginBottom: 28,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  currentPlanRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  currentPlanInfo: {
    flex: 1,
    paddingRight: 16,
  },
  currentPlanName: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '700',
  },
  currentPlanPeriod: {
    color: BLUE_DARK,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  currentPlanRenewal: {
    color: '#6B7280',
    fontSize: 13,
    marginTop: 6,
  },
  currentPlanPrice: {
    color: '#111827',
    fontSize: 22,
    fontWeight: '800',
  },
  includedSection: {
    marginBottom: 16,
  },
  includedFeaturesList: {
    marginTop: 4,
  },
  includedFeatureRow: {
    marginBottom: 0,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  footerLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 16,
  },
  footerLink: {
    color: BLUE_DARK,
    fontSize: 12,
    fontWeight: '600',
  },
  logoutButton: {
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 8,
  },
  logoutText: {
    color: '#9CA3AF',
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
});

export default SubscriptionScreen;

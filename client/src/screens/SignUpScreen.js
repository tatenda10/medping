import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useSSO, useSignUp } from '@clerk/expo';
import { useAuth } from '../context/AuthContext';
import onboardingService from '../services/onboardingService';
import firebaseService from '../services/firebaseService';
import { navigateAfterAuthentication } from '../navigation/postAuthNavigation';

WebBrowser.maybeCompleteAuthSession();

const BRAND = {
  ink: '#17324D',
  azure: '#90CDF4',
  mist: '#EBF8FF',
  peach: '#FFF2E6',
  cream: '#FFFDF9',
  line: '#C5E3F6',
  apple: '#101418',
  google: '#FFFFFF',
};

const getClerkErrorMessage = (error, fallback) => {
  if (error?.errors?.[0]?.longMessage) return error.errors[0].longMessage;
  if (error?.errors?.[0]?.message) return error.errors[0].message;
  if (error?.message) return error.message;
  return fallback;
};

const SignUpScreen = ({ onSignUpSuccess }) => {
  const navigation = useNavigation();
  const { isAuthenticated, userId, isLoaded: authLoaded } = useAuth();
  const { signUp, setActive, isLoaded } = useSignUp();
  const { startSSOFlow } = useSSO();
  const handledAuthRef = useRef(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [awaitingVerification, setAwaitingVerification] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState(null);

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;

    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);

  useEffect(() => {
    if (!authLoaded || !isAuthenticated || !userId || handledAuthRef.current) {
      return;
    }

    handledAuthRef.current = true;

    const finalizeSignUp = async () => {
      try {
        const hasGuestData = await onboardingService.hasGuestMedications();
        if (hasGuestData) {
          await onboardingService.migrateGuestDataToUser(userId, null);
        } else {
          await onboardingService.markOnboardingCompleted();
        }
      } catch (error) {
        console.error('Guest migration after Clerk sign-up failed:', error);
      }

      firebaseService.userSignedUp('clerk');

      if (onSignUpSuccess) {
        onSignUpSuccess();
      } else {
        await navigateAfterAuthentication();
      }
    };

    finalizeSignUp();
  }, [authLoaded, isAuthenticated, navigation, onSignUpSuccess, userId]);

  const redirectUrl = useMemo(
    () =>
      AuthSession.makeRedirectUri({
        scheme: 'mediping',
        path: 'sso-callback',
      }),
    []
  );

  const handleEmailSignUp = async () => {
    if (!isLoaded || !signUp) return;

    const normalizedEmail = emailAddress.trim().toLowerCase();
    if (!firstName.trim() || !lastName.trim() || !normalizedEmail || !password.trim()) {
      Alert.alert('Missing details', 'Fill in your name, email, and password to create an account.');
      return;
    }

    setLoadingProvider('email');
    try {
      await signUp.create({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        emailAddress: normalizedEmail,
        password,
      });

      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setAwaitingVerification(true);
    } catch (error) {
      Alert.alert('Could not create account', getClerkErrorMessage(error, 'Please try again.'));
    } finally {
      setLoadingProvider(null);
    }
  };

  const handleVerifyEmail = async () => {
    if (!signUp || !verificationCode.trim()) {
      Alert.alert('Code required', 'Enter the verification code from your email.');
      return;
    }

    setLoadingProvider('verify');
    try {
      const result = await signUp.attemptEmailAddressVerification({
        code: verificationCode.trim(),
      });

      if (result.status !== 'complete') {
        Alert.alert('Verification incomplete', 'Please try again.');
        return;
      }

      await setActive({ session: result.createdSessionId });
    } catch (error) {
      Alert.alert('Verification failed', getClerkErrorMessage(error, 'Please try the code again.'));
    } finally {
      setLoadingProvider(null);
    }
  };

  const completeSocialSession = async (result) => {
    if (result?.createdSessionId && result?.setActive) {
      await result.setActive({ session: result.createdSessionId });
      return;
    }

    if (result?.signUp?.status === 'missing_requirements') {
      Alert.alert('More details required', 'This social account still needs additional fields in Clerk before the sign-up can finish.');
      return;
    }

    Alert.alert('Sign up incomplete', 'The provider returned an incomplete sign-up. Check your Clerk configuration and try again.');
  };

  const handleGoogleSignUp = async () => {
    setLoadingProvider('google');
    try {
      const result = await startSSOFlow({
        strategy: 'oauth_google',
        redirectUrl,
      });
      await completeSocialSession(result);
    } catch (error) {
      if (error?.code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert('Google sign-up failed', getClerkErrorMessage(error, 'Check your Google and Clerk OAuth setup, then try again.'));
      }
    } finally {
      setLoadingProvider(null);
    }
  };

  const handleAppleSignUp = async () => {
    setLoadingProvider('apple');
    try {
      const result = await startSSOFlow({
        strategy: 'oauth_apple',
        redirectUrl,
      });
      await completeSocialSession(result);
    } catch (error) {
      if (error?.code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert('Apple sign-up failed', getClerkErrorMessage(error, 'Check your Apple and Clerk configuration, then try again.'));
      }
    } finally {
      setLoadingProvider(null);
    }
  };

  const isBusy = loadingProvider !== null;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 16 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={styles.logoShell}>
              <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="contain" />
            </View>
          </View>

          <View style={styles.card}>
            {!awaitingVerification ? (
              <>
                <Text style={styles.label}>First name</Text>
                <TextInput
                  style={styles.input}
                  value={firstName}
                  onChangeText={setFirstName}
                  autoCapitalize="words"
                  autoCorrect={false}
                  placeholder="First name"
                  placeholderTextColor="#7E94B2"
                />

                <Text style={styles.label}>Last name</Text>
                <TextInput
                  style={styles.input}
                  value={lastName}
                  onChangeText={setLastName}
                  autoCapitalize="words"
                  autoCorrect={false}
                  placeholder="Last name"
                  placeholderTextColor="#7E94B2"
                />

                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  value={emailAddress}
                  onChangeText={setEmailAddress}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  placeholder="name@example.com"
                  placeholderTextColor="#7E94B2"
                />

                <Text style={styles.label}>Password</Text>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                  placeholder="Create a password"
                  placeholderTextColor="#7E94B2"
                />

                <TouchableOpacity
                  style={[styles.primaryButton, isBusy && styles.primaryButtonDisabled]}
                  onPress={handleEmailSignUp}
                  disabled={isBusy}
                >
                  {loadingProvider === 'email' ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Text style={styles.primaryButtonText}>Create account</Text>
                      <MaterialIcons name="arrow-forward" size={18} color="#fff" />
                    </>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.notice}>
                  <MaterialIcons name="mark-email-read" size={20} color={BRAND.azure} />
                  <Text style={styles.noticeText}>
                    We sent a verification code to your email. Enter it below to finish creating your account.
                  </Text>
                </View>

                <Text style={styles.label}>Verification code</Text>
                <TextInput
                  style={styles.input}
                  value={verificationCode}
                  onChangeText={setVerificationCode}
                  keyboardType="number-pad"
                  placeholder="Enter code"
                  placeholderTextColor="#7E94B2"
                />

                <TouchableOpacity
                  style={[styles.primaryButton, isBusy && styles.primaryButtonDisabled]}
                  onPress={handleVerifyEmail}
                  disabled={isBusy}
                >
                  {loadingProvider === 'verify' ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Verify and continue</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.linkRow}
                  onPress={() => {
                    setAwaitingVerification(false);
                    setVerificationCode('');
                  }}
                >
                  <Text style={styles.secondaryLink}>Back to details</Text>
                </TouchableOpacity>
              </>
            )}

            <View style={styles.dividerRow}>
              <View style={styles.divider} />
              <Text style={styles.dividerLabel}>or use</Text>
              <View style={styles.divider} />
            </View>

            <TouchableOpacity
              style={[styles.socialButton, styles.googleButton]}
              onPress={handleGoogleSignUp}
              disabled={isBusy}
            >
              {loadingProvider === 'google' ? (
                <ActivityIndicator color={BRAND.ink} />
              ) : (
                <>
                  <View style={styles.googleBadge}>
                    <Text style={styles.googleBadgeText}>G</Text>
                  </View>
                  <Text style={styles.googleButtonText}>Continue with Google</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.socialButton, styles.appleButton]}
              onPress={handleAppleSignUp}
              disabled={isBusy}
            >
              {loadingProvider === 'apple' ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="logo-apple" size={20} color="#fff" />
                  <Text style={styles.appleButtonText}>Continue with Apple</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account?</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.footerLink}>Sign in</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND.cream,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 28,
  },
  glowTop: {
    position: 'absolute',
    top: -120,
    right: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: '#DCEFFB',
  },
  glowBottom: {
    position: 'absolute',
    bottom: -110,
    left: -70,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: '#FFE4CC',
  },
  hero: {
    alignItems: 'center',
    paddingTop: 6,
    marginBottom: 24,
  },
  logoShell: {
    width: 110,
    height: 110,
    borderRadius: 34,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logo: {
    width: 82,
    height: 82,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 20,
  },
  label: {
    color: BRAND.ink,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  input: {
    height: 54,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#D5E2F1',
    backgroundColor: '#F8FBFF',
    paddingHorizontal: 16,
    color: BRAND.ink,
    fontSize: 16,
    marginBottom: 14,
  },
  primaryButton: {
    height: 56,
    borderRadius: 4,
    backgroundColor: BRAND.azure,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  primaryButtonDisabled: {
    opacity: 0.65,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: BRAND.mist,
    borderRadius: 4,
    padding: 14,
    marginBottom: 14,
  },
  noticeText: {
    flex: 1,
    color: '#4D6788',
    fontSize: 13,
    lineHeight: 19,
  },
  linkRow: {
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 6,
  },
  secondaryLink: {
    color: BRAND.azure,
    fontWeight: '700',
    fontSize: 14,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
    gap: 10,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#E4ECF6',
  },
  dividerLabel: {
    color: '#7A8FAE',
    fontSize: 12,
    fontWeight: '600',
  },
  socialButton: {
    height: 56,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  googleButton: {
    backgroundColor: BRAND.google,
    borderWidth: 1,
    borderColor: BRAND.line,
  },
  googleBadge: {
    width: 28,
    height: 28,
    borderRadius: 4,
    backgroundColor: BRAND.mist,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleBadgeText: {
    color: BRAND.azure,
    fontWeight: '800',
    fontSize: 16,
  },
  googleButtonText: {
    color: BRAND.ink,
    fontSize: 16,
    fontWeight: '700',
  },
  appleButton: {
    backgroundColor: BRAND.apple,
    marginTop: 12,
  },
  appleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
    marginBottom: 8,
  },
  footerText: {
    color: '#5C7695',
    fontSize: 14,
  },
  footerLink: {
    color: BRAND.azure,
    fontWeight: '800',
    fontSize: 14,
  },
});

export default SignUpScreen;

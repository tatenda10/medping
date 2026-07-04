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
import { CommonActions, useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useSignIn, useSSO } from '@clerk/expo';
import { useAuth } from '../context/AuthContext';
import onboardingService from '../services/onboardingService';
import firebaseService from '../services/firebaseService';
import { navigationRef } from '../navigation/navigationRef';
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

const LoginScreen = ({ navigation: navProp, onLoginSuccess }) => {
  const navigation = navProp || useNavigation();
  const { isAuthenticated, userId, isLoaded: authLoaded } = useAuth();
  const { signIn, fetchStatus, errors } = useSignIn();
  const { startSSOFlow } = useSSO();
  const handledAuthRef = useRef(false);
  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [loadingProvider, setLoadingProvider] = useState(null);
  const [showClientTrust, setShowClientTrust] = useState(false);
  const [authMode, setAuthMode] = useState('sign-in');

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;

    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      handledAuthRef.current = false;
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!authLoaded || !isAuthenticated || !userId || handledAuthRef.current) {
      return;
    }

    handledAuthRef.current = true;

    const finalizeLogin = async () => {
      try {
        const hasGuestData = await onboardingService.hasGuestMedications();
        if (hasGuestData) {
          await onboardingService.migrateGuestDataToUser(userId, null);
        }
      } catch (error) {
        console.error('Guest migration after Clerk sign-in failed:', error);
      }

      firebaseService.userLoggedIn('clerk');

      if (onLoginSuccess) {
        await onLoginSuccess();
      } else {
        await navigateAfterAuthentication();
      }
    };

    finalizeLogin();
  }, [authLoaded, isAuthenticated, navigation, onLoginSuccess, userId]);

  const redirectUrl = useMemo(
    () =>
      AuthSession.makeRedirectUri({
        scheme: 'mediping',
        path: 'sso-callback',
      }),
    []
  );

  const activeError = useMemo(() => {
    if (errors?.fields?.identifier?.message) return errors.fields.identifier.message;
    if (errors?.fields?.emailAddress?.message) return errors.fields.emailAddress.message;
    if (errors?.fields?.password?.message) return errors.fields.password.message;
    if (errors?.fields?.code?.message) return errors.fields.code.message;
    return null;
  }, [errors]);

  const finalizeEmailSignIn = async () => {
    if (!signIn) return;

    if (signIn.status === 'complete') {
      await signIn.finalize({
        navigate: async ({ session }) => {
          if (session?.currentTask) {
            console.log('Pending Clerk session task:', session.currentTask);
          }
        },
      });
      return;
    }

    if (signIn.status === 'needs_client_trust') {
      const emailCodeFactor = signIn.supportedSecondFactors?.find(
        (factor) => factor.strategy === 'email_code'
      );

      if (emailCodeFactor) {
        await signIn.mfa.sendEmailCode();
        setShowClientTrust(true);
        return;
      }
    }

    if (signIn.status === 'needs_second_factor') {
      Alert.alert('Verification required', 'This account requires an additional sign-in factor that is not yet handled on this screen.');
      return;
    }

    Alert.alert('Sign in not complete', 'Please review your details and try again.');
  };

  const handleEmailSignIn = async () => {
    if (!signIn) return;

    const normalizedEmail = emailAddress.trim().toLowerCase();
    if (!normalizedEmail || !password.trim()) {
      Alert.alert('Missing details', 'Enter your email and password to continue.');
      return;
    }

    setLoadingProvider('email');
    try {
      const { error } = await signIn.password({
        emailAddress: normalizedEmail,
        password,
      });

      if (error) {
        Alert.alert('Could not sign in', getClerkErrorMessage(error, 'Please check your credentials and try again.'));
        return;
      }

      await finalizeEmailSignIn();
    } catch (error) {
      Alert.alert('Could not sign in', getClerkErrorMessage(error, 'Please try again.'));
    } finally {
      setLoadingProvider(null);
    }
  };

  const handleVerifyCode = async () => {
    if (!signIn || !verificationCode.trim()) {
      Alert.alert('Code required', 'Enter the verification code that was sent to your email.');
      return;
    }

    setLoadingProvider('verify');
    try {
      await signIn.mfa.verifyEmailCode({ code: verificationCode.trim() });
      await finalizeEmailSignIn();
    } catch (error) {
      Alert.alert('Verification failed', getClerkErrorMessage(error, 'Please try the code again.'));
    } finally {
      setLoadingProvider(null);
    }
  };

  const handleSendResetCode = async () => {
    if (!signIn) return;

    const normalizedEmail = emailAddress.trim().toLowerCase();
    if (!normalizedEmail) {
      Alert.alert('Email required', 'Enter your email address first.');
      return;
    }

    setLoadingProvider('reset-request');
    try {
      const { error: createError } = await signIn.create({
        identifier: normalizedEmail,
      });

      if (createError) {
        Alert.alert('Could not start reset', getClerkErrorMessage(createError, 'Please check your email and try again.'));
        return;
      }

      const { error: sendCodeError } = await signIn.resetPasswordEmailCode.sendCode();
      if (sendCodeError) {
        Alert.alert('Could not send code', getClerkErrorMessage(sendCodeError, 'Please try again.'));
        return;
      }

      setVerificationCode('');
      setResetPassword('');
      setAuthMode('forgot-verify');
    } catch (error) {
      Alert.alert('Could not send code', getClerkErrorMessage(error, 'Please try again.'));
    } finally {
      setLoadingProvider(null);
    }
  };

  const handleVerifyResetCode = async () => {
    if (!signIn || !verificationCode.trim()) {
      Alert.alert('Code required', 'Enter the reset code from your email.');
      return;
    }

    setLoadingProvider('reset-verify');
    try {
      const { error } = await signIn.resetPasswordEmailCode.verifyCode({
        code: verificationCode.trim(),
      });

      if (error) {
        Alert.alert('Verification failed', getClerkErrorMessage(error, 'Please try the code again.'));
        return;
      }

      setAuthMode('forgot-password');
    } catch (error) {
      Alert.alert('Verification failed', getClerkErrorMessage(error, 'Please try the code again.'));
    } finally {
      setLoadingProvider(null);
    }
  };

  const handleSubmitNewPassword = async () => {
    if (!signIn || !resetPassword.trim()) {
      Alert.alert('Password required', 'Enter your new password.');
      return;
    }

    setLoadingProvider('reset-submit');
    try {
      const { error } = await signIn.resetPasswordEmailCode.submitPassword({
        password: resetPassword,
        signOutOfOtherSessions: true,
      });

      if (error) {
        Alert.alert('Could not reset password', getClerkErrorMessage(error, 'Please try again.'));
        return;
      }

      if (signIn.status === 'complete') {
        await signIn.finalize({
          navigate: async ({ session }) => {
            if (session?.currentTask) {
              console.log('Pending Clerk session task:', session.currentTask);
            }
          },
        });
        return;
      }

      if (signIn.status === 'needs_second_factor') {
        Alert.alert('Verification required', 'This account requires another verification step after password reset.');
        return;
      }

      Alert.alert('Reset incomplete', 'Please try signing in again.');
    } catch (error) {
      Alert.alert('Could not reset password', getClerkErrorMessage(error, 'Please try again.'));
    } finally {
      setLoadingProvider(null);
    }
  };

  const completeSocialSession = async (result) => {
    if (result?.createdSessionId && result?.setActive) {
      await result.setActive({ session: result.createdSessionId });
      handledAuthRef.current = false;

      if (onLoginSuccess) {
        await onLoginSuccess();
        return;
      }

      return;
    }

    if (result?.signIn?.status === 'needs_second_factor') {
      Alert.alert('Verification required', 'This account requires an additional sign-in factor after social login.');
      return;
    }

    Alert.alert('Sign in incomplete', 'The provider returned an incomplete sign-in. Check your Clerk configuration and try again.');
  };

  const handleGoogleSignIn = async () => {
    setLoadingProvider('google');
    try {
      const result = await startSSOFlow({
        strategy: 'oauth_google',
        redirectUrl,
      });
      await completeSocialSession(result);
    } catch (error) {
      if (error?.code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert('Google sign-in failed', getClerkErrorMessage(error, 'Check your Google and Clerk OAuth setup, then try again.'));
      }
    } finally {
      setLoadingProvider(null);
    }
  };

  const handleAppleSignIn = async () => {
    setLoadingProvider('apple');
    try {
      const result = await startSSOFlow({
        strategy: 'oauth_apple',
        redirectUrl,
      });
      await completeSocialSession(result);
    } catch (error) {
      if (error?.code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert('Apple sign-in failed', getClerkErrorMessage(error, 'Check your Apple and Clerk configuration, then try again.'));
      }
    } finally {
      setLoadingProvider(null);
    }
  };

  const isBusy = fetchStatus === 'fetching' || loadingProvider !== null;

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
            {!showClientTrust && authMode === 'sign-in' ? (
              <>
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
                  placeholder="Your password"
                  placeholderTextColor="#7E94B2"
                />

                {activeError ? <Text style={styles.errorText}>{activeError}</Text> : null}

                <TouchableOpacity
                  style={styles.inlineLinkRow}
                  onPress={() => {
                    setAuthMode('forgot-request');
                    setVerificationCode('');
                    setResetPassword('');
                  }}
                >
                  <Text style={styles.secondaryLink}>Forgot password?</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.primaryButton, isBusy && styles.primaryButtonDisabled]}
                  onPress={handleEmailSignIn}
                  disabled={isBusy}
                >
                  {loadingProvider === 'email' ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Text style={styles.primaryButtonText}>Sign in</Text>
                      <MaterialIcons name="arrow-forward" size={18} color="#fff" />
                    </>
                  )}
                </TouchableOpacity>
              </>
            ) : null}

            {!showClientTrust && authMode === 'forgot-request' ? (
              <>
                <View style={styles.notice}>
                  <MaterialIcons name="lock-reset" size={20} color={BRAND.azure} />
                  <Text style={styles.noticeText}>
                    Enter your email and we’ll send a reset code.
                  </Text>
                </View>

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

                <TouchableOpacity
                  style={[styles.primaryButton, isBusy && styles.primaryButtonDisabled]}
                  onPress={handleSendResetCode}
                  disabled={isBusy}
                >
                  {loadingProvider === 'reset-request' ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Send reset code</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.linkRow}
                  onPress={() => {
                    setAuthMode('sign-in');
                    setVerificationCode('');
                    setResetPassword('');
                  }}
                >
                  <Text style={styles.secondaryLink}>Back to sign in</Text>
                </TouchableOpacity>
              </>
            ) : null}

            {!showClientTrust && authMode === 'forgot-verify' ? (
              <>
                <View style={styles.notice}>
                  <MaterialIcons name="mark-email-read" size={20} color={BRAND.azure} />
                  <Text style={styles.noticeText}>
                    Enter the reset code that was sent to your email.
                  </Text>
                </View>

                <Text style={styles.label}>Reset code</Text>
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
                  onPress={handleVerifyResetCode}
                  disabled={isBusy}
                >
                  {loadingProvider === 'reset-verify' ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Verify code</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : null}

            {!showClientTrust && authMode === 'forgot-password' ? (
              <>
                <View style={styles.notice}>
                  <MaterialIcons name="vpn-key" size={20} color={BRAND.azure} />
                  <Text style={styles.noticeText}>
                    Set a new password for your account.
                  </Text>
                </View>

                <Text style={styles.label}>New password</Text>
                <TextInput
                  style={styles.input}
                  value={resetPassword}
                  onChangeText={setResetPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                  placeholder="New password"
                  placeholderTextColor="#7E94B2"
                />

                <TouchableOpacity
                  style={[styles.primaryButton, isBusy && styles.primaryButtonDisabled]}
                  onPress={handleSubmitNewPassword}
                  disabled={isBusy}
                >
                  {loadingProvider === 'reset-submit' ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Update password</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : null}

            {showClientTrust ? (
              <>
                <View style={styles.notice}>
                  <MaterialIcons name="mark-email-read" size={20} color={BRAND.azure} />
                  <Text style={styles.noticeText}>
                    We sent a verification code to your email to finish this sign-in.
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

                {activeError ? <Text style={styles.errorText}>{activeError}</Text> : null}

                <TouchableOpacity
                  style={[styles.primaryButton, isBusy && styles.primaryButtonDisabled]}
                  onPress={handleVerifyCode}
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
                    setShowClientTrust(false);
                    setVerificationCode('');
                    signIn?.reset?.();
                  }}
                >
                  <Text style={styles.secondaryLink}>Start over</Text>
                </TouchableOpacity>
              </>
            ) : null}

            <View style={styles.dividerRow}>
              <View style={styles.divider} />
              <Text style={styles.dividerLabel}>or use</Text>
              <View style={styles.divider} />
            </View>

            <TouchableOpacity
              style={[styles.socialButton, styles.googleButton]}
              onPress={handleGoogleSignIn}
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
              onPress={handleAppleSignIn}
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
            <Text style={styles.footerText}>New to MediPing?</Text>
            <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
              <Text style={styles.footerLink}>Create your account</Text>
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
  errorText: {
    color: '#B94343',
    fontSize: 13,
    marginBottom: 12,
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
  inlineLinkRow: {
    alignItems: 'flex-end',
    marginBottom: 14,
  },
  secondaryLink: {
    color: BRAND.azure,
    fontWeight: '700',
    fontSize: 14,
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

export default LoginScreen;

import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, TextInput, Image, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useSignUp, useOAuth } from '@clerk/clerk-expo';
import { useAuth } from '../context/ClerkAuthContext';
import onboardingService from '../services/onboardingService';
import firebaseService from '../services/firebaseService';
import { clerkAxios } from '../utils/clerkAxios';

const SignUpScreen = ({ onSignUpSuccess }) => {
  const navigation = useNavigation();
  const scrollViewRef = useRef(null);
  const { signUp, setActive, isLoaded } = useSignUp();
  const { userId } = useAuth();
  const { startOAuthFlow: startGoogleOAuth } = useOAuth({ 
    strategy: 'oauth_google',
    redirectUrl: 'mediping://oauth-callback',
  });
  const { startOAuthFlow: startAppleOAuth } = useOAuth({ 
    strategy: 'oauth_apple',
    redirectUrl: 'mediping://oauth-callback',
  });
  const [loading, setLoading] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState(null); // 'google', 'apple', or 'email'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleGoogleSignUp = async () => {
    if (!isLoaded) return;
    
    setLoading(true);
    setLoadingProvider('google');
    
    try {
      // Start OAuth flow - this will open a browser/webview
      const { createdSessionId, setActive } = await startGoogleOAuth({
        redirectUrl: 'mediping://oauth-callback',
      });
      
      if (createdSessionId) {
        await setActive({ session: createdSessionId });
        
        // Track signup
        firebaseService.userSignedUp('google');
        
        // Call success callback
        // Migration will be handled automatically when user data is synced
        if (onSignUpSuccess) {
          onSignUpSuccess();
        }
      }
    } catch (error) {
      console.error('Google sign up error:', error);
      // Check if it's the origin error - might be a Clerk internal issue
      if (error.message?.includes('origin') || error.message?.includes('undefined')) {
        Alert.alert(
          'OAuth Error', 
          'There was an issue with the OAuth configuration. Please ensure Clerk is properly configured in your dashboard.'
        );
      } else {
        Alert.alert('Sign Up Failed', error.message || 'Failed to sign up with Google');
      }
    } finally {
      setLoading(false);
      setLoadingProvider(null);
    }
  };

  const handleAppleSignUp = async () => {
    if (!isLoaded) return;
    
    setLoading(true);
    setLoadingProvider('apple');
    
    try {
      // Start OAuth flow - this will open a browser/webview
      const { createdSessionId, setActive } = await startAppleOAuth({
        redirectUrl: 'mediping://oauth-callback',
      });
      
      if (createdSessionId) {
        await setActive({ session: createdSessionId });
        
        // Track signup
        firebaseService.userSignedUp('apple');
        
        // Call success callback
        // Migration will be handled automatically when user data is synced
        if (onSignUpSuccess) {
          onSignUpSuccess();
        }
      }
    } catch (error) {
      console.error('Apple sign up error:', error);
      // Check if it's the origin error - might be a Clerk internal issue
      if (error.message?.includes('origin') || error.message?.includes('undefined')) {
        Alert.alert(
          'OAuth Error', 
          'There was an issue with the OAuth configuration. Please ensure Clerk is properly configured in your dashboard.'
        );
      } else {
        Alert.alert('Sign Up Failed', error.message || 'Failed to sign up with Apple');
      }
    } finally {
      setLoading(false);
      setLoadingProvider(null);
    }
  };

  const handleEmailSignUp = async () => {
    if (!name.trim() || !email.trim() || !password.trim() || !confirmPassword.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    if (!isLoaded) return;

    setLoading(true);
    setLoadingProvider('email');
    
    try {
      // Create user with Clerk
      const result = await signUp.create({
        emailAddress: email,
        password: password,
        firstName: name.split(' ')[0] || name,
        lastName: name.split(' ').slice(1).join(' ') || '',
      });

      // Complete sign up (verify email if required)
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        
        // Create user record on server with Clerk userId
        // The server will automatically create the user on first authenticated request
        // So we don't need to call a separate endpoint here
        
        // Migrate guest data (medications, questionnaire) to user account
        try {
          const migrationResult = await onboardingService.migrateGuestDataToUser(
            result.id, // Use Clerk userId
            null // No token needed, using Clerk
          );
          
          if (migrationResult.medicationsMigrated > 0) {
            Alert.alert(
              'Success!',
              `Your account has been created and ${migrationResult.medicationsMigrated} medication(s) have been saved!`,
              [{ text: 'OK' }]
            );
          }
        } catch (migrationError) {
          console.error('Migration error:', migrationError);
          // Don't block signup if migration fails
        }
        
        // Track signup
        firebaseService.userSignedUp('email');
        
        // Call success callback
        if (onSignUpSuccess) {
          onSignUpSuccess();
        }
      } else {
        // Email verification required
        Alert.alert(
          'Verification Required',
          'Please check your email to verify your account before signing in.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Email sign up error:', error);
      const errorMessage = error.errors?.[0]?.message || error.message || 'Failed to create account';
      
      // Handle email already exists
      if (errorMessage.includes('already exists') || errorMessage.includes('already registered')) {
        Alert.alert(
          'Email Already Registered',
          'This email is already registered. Would you like to log in instead?',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Log In', 
              onPress: () => navigation.navigate('Login')
            }
          ]
        );
      } else {
        Alert.alert('Sign Up Failed', errorMessage);
      }
    } finally {
      setLoading(false);
      setLoadingProvider(null);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
        <View style={styles.logoContainer}>
          <Image 
            source={require('../../assets/logo.png')} 
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <Text style={styles.subtitle}>Create your account</Text>

        <View style={styles.formContainer}>
          <TextInput
            style={styles.input}
            placeholder="Full Name"
            placeholderTextColor="#999"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="next"
          />

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#999"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#999"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
          />

          <TextInput
            style={styles.input}
            placeholder="Confirm Password"
            placeholderTextColor="#999"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
          />

          <TouchableOpacity
            style={[styles.button, styles.emailButton]}
            onPress={handleEmailSignUp}
            disabled={loading || !isLoaded}
          >
            {loading && loadingProvider === 'email' ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Sign Up</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.dividerContainer}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.divider} />
        </View>

        <View style={styles.socialContainer}>
          <TouchableOpacity
            style={[styles.button, styles.googleButton]}
            onPress={handleGoogleSignUp}
            disabled={loading || !isLoaded}
          >
            {loading && loadingProvider === 'google' ? (
              <ActivityIndicator color="#4285F4" />
            ) : (
              <View style={styles.socialButtonContent}>
                <Image
                  source={require('../../assets/Google__G__logo.svg.webp')}
                  style={styles.socialIcon}
                  resizeMode="contain"
                />
                <Text style={styles.googleButtonText}>Sign up with Google</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.appleButton]}
            onPress={handleAppleSignUp}
            disabled={loading || !isLoaded}
          >
            {loading && loadingProvider === 'apple' ? (
              <ActivityIndicator color="#000" />
            ) : (
              <View style={styles.socialButtonContent}>
                <Image
                  source={require('../../assets/apple logo.png')}
                  style={styles.appleIcon}
                  resizeMode="contain"
                />
                <Text style={styles.appleButtonText}>Sign up with Apple</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.loginContainer}>
          <Text style={styles.loginText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.loginLink}>Sign in</Text>
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
    backgroundColor: '#fff',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 20,
    paddingBottom: 10,
  },
  logo: {
    width: 150,
    height: 150,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  formContainer: {
    width: '100%',
    marginBottom: 20,
  },
  input: {
    width: '100%',
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 15,
    fontSize: 16,
    backgroundColor: '#fff',
    marginBottom: 15,
  },
  button: {
    width: '100%',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  emailButton: {
    backgroundColor: '#4285F4',
    marginTop: 10,
  },
  googleButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 15,
  },
  appleButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  socialButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialIcon: {
    width: 20,
    height: 20,
    marginRight: 10,
  },
  appleIcon: {
    width: 28,
    height: 28,
    marginRight: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  googleButtonText: {
    color: '#4285F4',
    fontSize: 16,
    fontWeight: '600',
  },
  appleButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#ddd',
  },
  dividerText: {
    marginHorizontal: 15,
    fontSize: 14,
    color: '#999',
  },
  socialContainer: {
    width: '100%',
    marginBottom: 20,
  },
  loginContainer: {
    flexDirection: 'row',
    marginTop: 10,
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginText: {
    fontSize: 14,
    color: '#666',
  },
  loginLink: {
    fontSize: 14,
    color: '#4285F4',
    fontWeight: '600',
  },
});

export default SignUpScreen;

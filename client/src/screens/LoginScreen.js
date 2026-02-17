import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, TextInput, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useSignIn, useOAuth } from '@clerk/clerk-expo';
import { useAuth } from '../context/ClerkAuthContext';
import onboardingService from '../services/onboardingService';
import firebaseService from '../services/firebaseService';

const LoginScreen = ({ navigation: navProp, onLoginSuccess }) => {
  const navigation = navProp || useNavigation();
  const { signIn, setActive, isLoaded } = useSignIn();
  const { user, isAuthenticated, userId, isLoaded: authLoaded } = useAuth();
  
  // If user is already authenticated, navigate away from login screen
  useEffect(() => {
    if (authLoaded && isAuthenticated && userId) {
      console.log('🟢 User already authenticated, navigating away from login screen');
      // Call the success callback to trigger navigation
      if (onLoginSuccess) {
        onLoginSuccess();
      } else {
        // Fallback: navigate to onboarding or main app
        navigation.replace('Onboarding');
      }
    }
  }, [authLoaded, isAuthenticated, userId, onLoginSuccess, navigation]);
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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleGoogleLogin = async () => {
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
        
        // Track login
        firebaseService.userLoggedIn('google');
        
        // Call success callback
        if (onLoginSuccess) {
          onLoginSuccess();
        }
      }
    } catch (error) {
      console.error('Google login error:', error);
      // Check if it's the origin error - might be a Clerk internal issue
      if (error.message?.includes('origin') || error.message?.includes('undefined')) {
        Alert.alert(
          'OAuth Error', 
          'There was an issue with the OAuth configuration. Please ensure Clerk is properly configured in your dashboard.'
        );
      } else {
        Alert.alert('Login Failed', error.message || 'Failed to sign in with Google');
      }
    } finally {
      setLoading(false);
      setLoadingProvider(null);
    }
  };

  const handleAppleLogin = async () => {
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
        
        // Track login
        firebaseService.userLoggedIn('apple');
        
        // Call success callback
        if (onLoginSuccess) {
          onLoginSuccess();
        }
      }
    } catch (error) {
      console.error('Apple login error:', error);
      // Check if it's the origin error - might be a Clerk internal issue
      if (error.message?.includes('origin') || error.message?.includes('undefined')) {
        Alert.alert(
          'OAuth Error', 
          'There was an issue with the OAuth configuration. Please ensure Clerk is properly configured in your dashboard.'
        );
      } else {
        Alert.alert('Login Failed', error.message || 'Failed to sign in with Apple');
      }
    } finally {
      setLoading(false);
      setLoadingProvider(null);
    }
  };

  const handleEmailLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }

    if (!isLoaded) return;

    setLoading(true);
    setLoadingProvider('email');
    
    try {
      const result = await signIn.create({
        identifier: email,
        password: password,
      });

      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        
        // Track login
        firebaseService.userLoggedIn('email');
        
        // Call success callback
        if (onLoginSuccess) {
          onLoginSuccess();
        }
      } else {
        Alert.alert('Login Failed', 'Please check your email and password');
      }
    } catch (error) {
      console.error('Email login error:', error);
      Alert.alert('Login Failed', error.errors?.[0]?.message || error.message || 'Failed to sign in');
    } finally {
      setLoading(false);
      setLoadingProvider(null);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.logoContainer}>
        <Image 
          source={require('../../assets/logo.png')} 
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      <Text style={styles.subtitle}>Sign in to continue</Text>

      <View style={styles.formContainer}>
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#999"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
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
        />

        <TouchableOpacity
          style={[styles.button, styles.emailButton]}
          onPress={handleEmailLogin}
          disabled={loading || !isLoaded}
        >
          {loading && loadingProvider === 'email' ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Sign In</Text>
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
          onPress={handleGoogleLogin}
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
              <Text style={styles.googleButtonText}>Sign in with Google</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.appleButton]}
          onPress={handleAppleLogin}
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
              <Text style={styles.appleButtonText}>Sign in with Apple</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.createAccountContainer}>
        <Text style={styles.createAccountText}>Don't have an account? </Text>
        <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
          <Text style={styles.createAccountLink}>Create account</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
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
  createAccountContainer: {
    flexDirection: 'row',
    marginTop: 10,
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createAccountText: {
    fontSize: 14,
    color: '#666',
  },
  createAccountLink: {
    fontSize: 14,
    color: '#4285F4',
    fontWeight: '600',
  },
});

export default LoginScreen;

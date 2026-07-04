import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth as useClerkAuth, useClerk, useUser } from '@clerk/expo';
import { setClerkTokenGetter, setUnauthorizedHandler } from '../utils/clerkAxios';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [authToken, setAuthToken] = useState(null);
  const { isLoaded, isSignedIn, userId, getToken } = useClerkAuth({
    treatPendingAsSignedOut: false,
  });
  const { user: clerkUser } = useUser();
  const { signOut } = useClerk();

  const user = useMemo(() => {
    if (!clerkUser || !userId) {
      return null;
    }

    return {
      id: userId,
      email: clerkUser.primaryEmailAddress?.emailAddress || clerkUser.emailAddresses?.[0]?.emailAddress || null,
      name: clerkUser.fullName || clerkUser.username || clerkUser.firstName || 'User',
      first_name: clerkUser.firstName || null,
      last_name: clerkUser.lastName || null,
      profile_image_url: clerkUser.imageUrl || null,
      auth_provider: 'clerk',
      is_verified: true,
    };
  }, [clerkUser, userId]);

  useEffect(() => {
    let cancelled = false;

    const syncCompatibilityState = async () => {
      if (!isLoaded) {
        return;
      }

      if (!isSignedIn || !userId) {
        setAuthToken(null);
        await AsyncStorage.removeItem('userData');
        return;
      }

      try {
        const token = await getToken();
        if (!cancelled) {
          setAuthToken(token || null);
        }

        if (user) {
          await AsyncStorage.setItem('userData', JSON.stringify(user));
        }
      } catch (error) {
        console.error('Error syncing Clerk auth state:', error);
        if (!cancelled) {
          setAuthToken(null);
        }
      }
    };

    syncCompatibilityState();

    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn, user, userId]);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    setClerkTokenGetter(async () => {
      if (!isSignedIn) {
        return null;
      }

      return (await getToken()) || null;
    });

    setUnauthorizedHandler(async () => {
      console.warn('Session expired or unauthorized — signing out');
      await signOut();
      setAuthToken(null);
      await AsyncStorage.removeItem('userData');
    });

    return () => {
      setClerkTokenGetter(null);
      setUnauthorizedHandler(null);
    };
  }, [getToken, isLoaded, isSignedIn, signOut]);

  const updateAuth = async () => {
    if (!isSignedIn) {
      setAuthToken(null);
      await AsyncStorage.removeItem('userData');
      return null;
    }

    const token = await getToken();
    setAuthToken(token || null);

    if (user) {
      await AsyncStorage.setItem('userData', JSON.stringify(user));
    }

    return token || null;
  };

  const clearAuth = async () => {
    try {
      await signOut();
    } catch (error) {
      console.warn('Clerk signOut error:', error?.message);
    }
    setAuthToken(null);
    await AsyncStorage.multiRemove(['userData', 'authToken']);
  };

  const refreshAuth = async () => {
    return updateAuth();
  };

  const isAuthSync = () => {
    return isLoaded && isSignedIn === true;
  };

  const value = {
    isAuthenticated: isSignedIn === true,
    isChecking: !isLoaded,
    isLoaded,
    authToken,
    user,
    userId: userId || null,
    updateAuth,
    clearAuth,
    refreshAuth,
    isAuthSync,
    getToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

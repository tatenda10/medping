import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [authToken, setAuthToken] = useState(null);
  const authCacheRef = useRef({ token: null, timestamp: 0 });
  const CACHE_DURATION = 5000; // 5 seconds cache

  // Fast synchronous check using cache
  const getCachedAuth = () => {
    const now = Date.now();
    if (authCacheRef.current.token !== null && (now - authCacheRef.current.timestamp) < CACHE_DURATION) {
      return authCacheRef.current.token;
    }
    return null;
  };

  // Fast check - tries cache first, then async
  const checkAuthFast = async () => {
    // Try cache first
    const cachedToken = getCachedAuth();
    if (cachedToken !== null) {
      setIsAuthenticated(true);
      setAuthToken(cachedToken);
      setIsChecking(false);
      return cachedToken;
    }

    // If no cache, do async check
    try {
      const token = await AsyncStorage.getItem('authToken');
      const hasToken = !!token;
      
      // Update cache
      authCacheRef.current = {
        token: token,
        timestamp: Date.now(),
      };
      
      setIsAuthenticated(hasToken);
      setAuthToken(token);
      setIsChecking(false);
      return token;
    } catch (error) {
      console.error('Error checking auth:', error);
      setIsAuthenticated(false);
      setAuthToken(null);
      authCacheRef.current = { token: null, timestamp: 0 };
      setIsChecking(false);
      return null;
    }
  };

  // Initial check on mount
  useEffect(() => {
    checkAuthFast();
  }, []);

  // Update auth state
  const updateAuth = async (token) => {
    if (token) {
      await AsyncStorage.setItem('authToken', token);
      authCacheRef.current = {
        token: token,
        timestamp: Date.now(),
      };
      setIsAuthenticated(true);
      setAuthToken(token);
    } else {
      await AsyncStorage.removeItem('authToken');
      authCacheRef.current = { token: null, timestamp: 0 };
      setIsAuthenticated(false);
      setAuthToken(null);
    }
    setIsChecking(false);
  };

  // Clear auth
  const clearAuth = async () => {
    await AsyncStorage.removeItem('authToken');
    authCacheRef.current = { token: null, timestamp: 0 };
    setIsAuthenticated(false);
    setAuthToken(null);
    setIsChecking(false);
  };

  // Refresh auth check
  const refreshAuth = async () => {
    setIsChecking(true);
    await checkAuthFast();
  };

  // Synchronous check (uses cache and state)
  const isAuthSync = () => {
    // First check cache for immediate response
    const cachedToken = getCachedAuth();
    if (cachedToken !== null) {
      return true;
    }
    // Fallback to state if cache is empty/expired but state says authenticated
    // This handles cases where cache expired but user is still logged in
    return isAuthenticated;
  };

  const value = {
    isAuthenticated,
    isChecking,
    authToken,
    updateAuth,
    clearAuth,
    refreshAuth,
    isAuthSync, // Fast synchronous check
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


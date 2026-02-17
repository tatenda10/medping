import React, { createContext, useContext, useEffect } from 'react';
import { useAuth as useClerkAuthHook, useUser as useClerkUser } from '@clerk/clerk-expo';
import { setClerkTokenGetter } from '../utils/clerkAxios';

/**
 * ClerkAuthContext - Wrapper around Clerk's auth hooks
 * Provides a similar interface to the old AuthContext for easier migration
 */
const ClerkAuthContext = createContext(null);

export const ClerkAuthProvider = ({ children }) => {
  const { isSignedIn, getToken, userId, isLoaded } = useClerkAuthHook();
  const { user, isLoaded: userLoaded } = useClerkUser();

  // Set up token getter for axios interceptor
  useEffect(() => {
    if (isLoaded) {
      setClerkTokenGetter(async () => {
        try {
          if (isSignedIn) {
            return await getToken();
          }
          return null;
        } catch (error) {
          console.error('Error getting Clerk token:', error);
          return null;
        }
      });
    }
  }, [isSignedIn, isLoaded, getToken]);

  // Get auth token (for API calls)
  const getAuthToken = async () => {
    try {
      if (isSignedIn) {
        return await getToken();
      }
      return null;
    } catch (error) {
      console.error('Error getting Clerk token:', error);
      return null;
    }
  };

  // Check if authenticated (synchronous)
  const isAuthSync = () => {
    return isSignedIn === true && isLoaded === true;
  };

  // Clear auth (sign out) - compatibility method
  const clearAuth = async () => {
    // Clerk handles sign out through its own methods
    // This is kept for compatibility
  };

  const value = {
    // Clerk-specific
    isSignedIn,
    userId,
    user,
    getToken: getAuthToken,
    isLoaded: isLoaded && userLoaded,
    
    // Compatibility with old AuthContext
    isAuthenticated: isSignedIn,
    isChecking: !isLoaded || !userLoaded,
    authToken: null, // Use getToken() instead
    updateAuth: () => {}, // Not needed with Clerk
    clearAuth,
    refreshAuth: async () => {
      // Clerk automatically refreshes tokens
      return await getAuthToken();
    },
    isAuthSync,
  };

  return (
    <ClerkAuthContext.Provider value={value}>
      {children}
    </ClerkAuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(ClerkAuthContext);
  if (!context) {
    throw new Error('useAuth must be used within ClerkAuthProvider');
  }
  return context;
};


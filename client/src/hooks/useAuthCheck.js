import { useAuth } from '../context/ClerkAuthContext';

// Legacy hook - now uses AuthContext for consistency
export const useAuthCheck = () => {
  const { isAuthenticated, isChecking, refreshAuth } = useAuth();
  
  return { 
    isAuthenticated, 
    isChecking, 
    checkAuth: refreshAuth,
    requireAuth: (callback) => {
      if (!isAuthenticated) {
        return false;
      }
      if (callback) callback();
      return true;
    }
  };
};


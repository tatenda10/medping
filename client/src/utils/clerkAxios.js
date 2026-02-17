import axios from 'axios';
import BASE_URL from '../context/Api';

/**
 * Creates an axios instance with Clerk token automatically added to requests
 * Use this instead of regular axios for authenticated API calls
 */
let getTokenFunction = null;

export const setClerkTokenGetter = (getTokenFn) => {
  getTokenFunction = getTokenFn;
};

/**
 * Get axios instance with Clerk token interceptor
 * This automatically adds the Authorization header with Clerk token
 */
export const getAuthenticatedAxios = async () => {
  const instance = axios.create({
    baseURL: BASE_URL,
  });

  // Add request interceptor to include Clerk token
  instance.interceptors.request.use(
    async (config) => {
      if (getTokenFunction) {
        try {
          const token = await getTokenFunction();
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        } catch (error) {
          console.error('Error getting Clerk token for request:', error);
        }
      }
      // Log the request URL for debugging
      console.log(`🌐 Making request to: ${config.baseURL}${config.url}`);
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // Add response interceptor for better error logging
  instance.interceptors.response.use(
    (response) => {
      return response;
    },
    (error) => {
      // Better error logging
      if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
        console.error(`❌ Network Error: Cannot reach server at ${error.config?.baseURL}${error.config?.url}`);
        console.error(`   This usually means:`);
        console.error(`   1. Server is not running or not accessible`);
        console.error(`   2. IP address has changed (check if ${BASE_URL} is correct)`);
        console.error(`   3. Firewall is blocking the connection`);
        console.error(`   4. Client and server are on different networks`);
      } else if (error.response) {
        // Server responded with error status
        console.error(`❌ Server Error: ${error.response.status} - ${error.response.statusText}`);
        console.error(`   URL: ${error.config?.baseURL}${error.config?.url}`);
      } else {
        console.error(`❌ Request Error:`, error.message || error);
      }
      return Promise.reject(error);
    }
  );

  return instance;
};

/**
 * Check if user is authenticated by trying to get a token
 */
export const checkAuthentication = async () => {
  try {
    if (!getTokenFunction) {
      return false;
    }
    const token = await getTokenFunction();
    return !!token;
  } catch (error) {
    return false;
  }
};

/**
 * Helper function to make authenticated API calls
 * Usage: const response = await clerkAxios.get('/medications');
 */
export const clerkAxios = {
  get: async (url, config = {}) => {
    const instance = await getAuthenticatedAxios();
    return instance.get(url, config);
  },
  post: async (url, data, config = {}) => {
    const instance = await getAuthenticatedAxios();
    return instance.post(url, data, config);
  },
  put: async (url, data, config = {}) => {
    const instance = await getAuthenticatedAxios();
    return instance.put(url, data, config);
  },
  patch: async (url, data, config = {}) => {
    const instance = await getAuthenticatedAxios();
    return instance.patch(url, data, config);
  },
  delete: async (url, config = {}) => {
    const instance = await getAuthenticatedAxios();
    return instance.delete(url, config);
  },
};


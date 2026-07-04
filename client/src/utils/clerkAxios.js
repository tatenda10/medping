import axios from 'axios';
import { getClerkInstance } from '@clerk/expo';
import BASE_URL from '../context/Api';

const authenticatedAxios = axios.create({
  baseURL: BASE_URL,
});

let clerkTokenGetter = null;
let unauthorizedHandler = null;
let handlingUnauthorized = false;

export const setClerkTokenGetter = (getter) => {
  clerkTokenGetter = typeof getter === 'function' ? getter : null;
};

export const setUnauthorizedHandler = (handler) => {
  unauthorizedHandler = typeof handler === 'function' ? handler : null;
};

export const getAuthToken = async () => {
  if (clerkTokenGetter) {
    try {
      const token = await clerkTokenGetter();
      if (token) {
        return token;
      }
    } catch (error) {
      console.error('Error getting Clerk token from auth context:', error);
    }
  }

  try {
    const clerk = getClerkInstance();
    return (await clerk.session?.getToken()) || null;
  } catch (error) {
    console.error('Error getting Clerk token from Clerk instance:', error);
    return null;
  }
};

export const getAuthHeaders = async (headers = {}) => {
  const token = await getAuthToken();
  if (!token) {
    return headers;
  }

  return {
    ...headers,
    Authorization: `Bearer ${token}`,
  };
};

authenticatedAxios.interceptors.request.use(
  async (config) => {
    try {
      const token = await getAuthToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      } else {
        console.warn(`No Clerk token available for request to: ${config.baseURL}${config.url}`);
      }
    } catch (error) {
      console.error('Error getting Clerk token for request:', error);
    }

    console.log(`Making request to: ${config.baseURL}${config.url}`);
    return config;
  },
  (error) => Promise.reject(error)
);

authenticatedAxios.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
      console.error(`Network Error: Cannot reach server at ${error.config?.baseURL}${error.config?.url}`);
    } else if (error.response) {
      const serverMessage = error.response.data?.message || error.response.data?.error;
      console.error(`Server Error: ${error.response.status} - ${serverMessage || error.response.statusText}`);
      console.error(`URL: ${error.config?.baseURL}${error.config?.url}`);

      if (error.response.status === 401 && unauthorizedHandler && !handlingUnauthorized) {
        handlingUnauthorized = true;
        try {
          await unauthorizedHandler();
        } catch (logoutError) {
          console.error('Error during unauthorized logout:', logoutError);
        } finally {
          handlingUnauthorized = false;
        }
      }
    } else {
      console.error('Request Error:', error.message || error);
    }

    return Promise.reject(error);
  }
);

export const checkAuthentication = async () => {
  try {
    const token = await getAuthToken();
    return !!token;
  } catch (error) {
    return false;
  }
};

export const clerkAxios = {
  get: async (url, config = {}) => authenticatedAxios.get(url, config),
  post: async (url, data, config = {}) => authenticatedAxios.post(url, data, config),
  put: async (url, data, config = {}) => authenticatedAxios.put(url, data, config),
  patch: async (url, data, config = {}) => authenticatedAxios.patch(url, data, config),
  delete: async (url, config = {}) => authenticatedAxios.delete(url, config),
};

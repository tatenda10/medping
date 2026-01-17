import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import BASE_URL from '../context/Api';
import axios from 'axios';

// Configure WebBrowser for OAuth
WebBrowser.maybeCompleteAuthSession();

class AuthService {
  /**
   * Register a new user with email and password
   */
  async register(name, email, password) {
    try {
      const response = await axios.post(`${BASE_URL}/user-auth/register`, {
        name,
        email,
        password,
      });

      return {
        success: true,
        user: response.data.user,
        token: response.data.token,
      };
    } catch (error) {
      console.error('Registration error:', error);
      
      // Handle 409 Conflict (email already exists)
      if (error.response?.status === 409) {
        return {
          success: false,
          error: 'This email is already registered. Please try logging in instead.',
          statusCode: 409,
        };
      }
      
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Registration failed',
        statusCode: error.response?.status,
      };
    }
  }

  /**
   * Login with email and password
   */
  async login(email, password) {
    try {
      const response = await axios.post(`${BASE_URL}/user-auth/login`, {
        email,
        password,
      });

      return {
        success: true,
        user: response.data.user,
        token: response.data.token,
      };
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Login failed',
      };
    }
  }

  /**
   * Sign in with Google using server-side OAuth flow
   * Flow: Client -> Server -> Google -> Server -> Client (with JWT)
   */
  async signInWithGoogle() {
    try {
      // OAuth endpoint is under /user-auth
      const oauthInitiateUrl = `${BASE_URL}/user-auth/oauth/google`;

      console.log('🚀 Initiating Google OAuth via server:', oauthInitiateUrl);

      // Set up deep link listener BEFORE opening OAuth
      const deepLinkPromise = new Promise((resolve, reject) => {
        const subscription = Linking.addEventListener('url', (event) => {
          console.log('📱 Deep link received:', event.url);
          subscription.remove();

          try {
            const url = new URL(event.url);
            const params = new URLSearchParams(url.search);

            const error = params.get('error');
            if (error) {
              reject(new Error(decodeURIComponent(error)));
              return;
            }

            const token = params.get('token');
            const userJson = params.get('user');

            if (!token || !userJson) {
              reject(new Error('Missing token or user data in callback'));
              return;
            }

            const user = JSON.parse(decodeURIComponent(userJson));

            resolve({
              success: true,
              user,
              token: decodeURIComponent(token),
            });
          } catch (parseError) {
            console.error('Error parsing deep link:', parseError);
            reject(new Error('Failed to parse callback data'));
          }
        });

        // Timeout after 5 minutes
        setTimeout(() => {
          subscription.remove();
          reject(new Error('OAuth callback timeout'));
        }, 5 * 60 * 1000);
      });

      // Open server's OAuth initiation endpoint
      // Server will redirect to Google, then back to server, then to app with JWT
      await WebBrowser.openBrowserAsync(oauthInitiateUrl);

      // Wait for deep link callback from server
      console.log('⏳ Waiting for OAuth callback...');
      return await deepLinkPromise;
    } catch (error) {
      console.error('Google login error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Sign in with Apple using server-side OAuth flow
   * Flow: Client -> Server -> Apple -> Server -> Client (with JWT)
   */
  async signInWithApple() {
    try {
      // OAuth endpoint is at root, not under /api
      const oauthInitiateUrl = `${BASE_URL}/user-auth/oauth/apple`;

      console.log('🚀 Initiating Apple OAuth via server:', oauthInitiateUrl);

      // Set up deep link listener BEFORE opening OAuth
      const deepLinkPromise = new Promise((resolve, reject) => {
        const subscription = Linking.addEventListener('url', (event) => {
          console.log('📱 Deep link received:', event.url);
          subscription.remove();

          try {
            const url = new URL(event.url);
            const params = new URLSearchParams(url.search);

            const error = params.get('error');
            const provider = params.get('provider');

            if (error && provider === 'apple') {
              reject(new Error(decodeURIComponent(error)));
              return;
            }

            const token = params.get('token');
            const onboardingCompleted = params.get('onboarding_completed') === 'true';
            const hasSelectedCompanion = params.get('has_selected_companion') === 'true';

            if (!token) {
              reject(new Error('Missing token in callback'));
              return;
            }

            // Fetch user data from backend
            fetch(`${BASE_URL}/user/me`, {
              headers: {
                'Authorization': `Bearer ${decodeURIComponent(token)}`,
              },
            })
              .then(response => response.json())
              .then(data => {
                resolve({
                  success: true,
                  user: {
                    ...data.user,
                    onboarding_completed: onboardingCompleted,
                    has_selected_companion: hasSelectedCompanion,
                  },
                  token: decodeURIComponent(token),
                });
              })
              .catch(err => {
                reject(new Error('Failed to fetch user data'));
              });
          } catch (parseError) {
            console.error('Error parsing deep link:', parseError);
            reject(new Error('Failed to parse callback data'));
          }
        });

        // Timeout after 5 minutes
        setTimeout(() => {
          subscription.remove();
          reject(new Error('OAuth callback timeout'));
        }, 5 * 60 * 1000);
      });

      // Open server's OAuth initiation endpoint
      await WebBrowser.openBrowserAsync(oauthInitiateUrl);

      // Wait for deep link callback from server
      console.log('⏳ Waiting for Apple OAuth callback...');
      return await deepLinkPromise;
    } catch (error) {
      console.error('Apple login error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

export default new AuthService();

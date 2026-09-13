import axios from 'axios';
import CryptoJS from 'crypto-js';

const apiBaseURL = import.meta.env.VITE_API_URL || '/api';
const encryptionKey = import.meta.env.VITE_API_RESPONSE_ENCRYPTION_KEY || '12345678901234567890123456789012';
let refreshPromise = null;

export const apiClient = axios.create({
  baseURL: apiBaseURL,
});

apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('mips-access-token');
    // If there is no access token, avoid sending protected requests that will 401.
    // Redirect to login for user to re-authenticate.
    const url = config.url || '';
    const isAuthEndpoint = url.includes('/auth/') || url.includes('/public/') || url.includes('/health');
    if (!token && !isAuthEndpoint) {
      // Redirect to login and cancel the request to prevent server 401 logs.
      try {
        window.location.href = '/login';
      } catch (e) {}
      return Promise.reject(new Error('No access token available'));
    }

    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => {
    const payload = response?.data;
    if (payload && payload.encrypted === true && payload.encryptedData && payload.iv) {
      try {
        const key = CryptoJS.enc.Utf8.parse(encryptionKey.padEnd(32, '0').slice(0, 32));
        const iv = CryptoJS.enc.Base64.parse(payload.iv);
        const decrypted = CryptoJS.AES.decrypt(payload.encryptedData, key, {
          iv,
          mode: CryptoJS.mode.CBC,
          padding: CryptoJS.pad.Pkcs7,
        });

        const decryptedText = decrypted.toString(CryptoJS.enc.Utf8);
        if (!decryptedText) {
          throw new Error('Empty decrypted response');
        }

        response.data = JSON.parse(decryptedText);
      } catch (decryptError) {
        console.error('API response decryption failed:', decryptError);
        response.data = {
          status: 'error',
          message: 'Encrypted API response could not be decrypted.'
        };
      }
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    const isRefreshRequest = originalRequest?.url?.includes('/auth/refresh');
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry && !isRefreshRequest) {
      originalRequest._retry = true;
      try {
        if (!refreshPromise) {
          const refreshToken = localStorage.getItem('mips-refresh-token');
          if (!refreshToken) throw new Error('No refresh token');
          refreshPromise = axios
            .post(`${apiBaseURL}/auth/refresh`, { refresh_token: refreshToken })
            .then(({ data }) => data?.data?.accessToken)
            .finally(() => {
              refreshPromise = null;
            });
        }

        const newAccessToken = await refreshPromise;
        if (!newAccessToken) throw new Error('Token refresh failed');

        localStorage.setItem('mips-access-token', newAccessToken);
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

        return apiClient(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem('mips-access-token');
        localStorage.removeItem('mips-refresh-token');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

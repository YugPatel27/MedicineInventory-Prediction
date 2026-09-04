import axios from 'axios';

const apiBaseURL = import.meta.env.VITE_API_URL || '/api';
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
  (response) => response,
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

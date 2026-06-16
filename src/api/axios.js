import axios from 'axios';

const apiBaseURL = import.meta.env.VITE_API_URL || 'http://localhost:5002/api';

export const apiClient = axios.create({
  baseURL: apiBaseURL,
});

apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('mips-access-token');
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
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = localStorage.getItem('mips-refresh-token');
        if (!refreshToken) throw new Error('No refresh token');

        const { data } = await axios.post(`${apiBaseURL}/auth/refresh`, { refresh_token: refreshToken });
        const newAccessToken = data?.data?.accessToken;
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

import { createSlice } from '@reduxjs/toolkit';

const storageAvailable = typeof window !== 'undefined' && window.localStorage;
const storedAccessToken = storageAvailable ? localStorage.getItem('mips-access-token') : null;
const storedRefreshToken = storageAvailable ? localStorage.getItem('mips-refresh-token') : null;
const storedUser = storageAvailable ? localStorage.getItem('mips-user') : null;

const initialState = {
  user: storedUser ? JSON.parse(storedUser) : null,
  isAuthenticated: Boolean(storedAccessToken && storedRefreshToken),
  isLoading: false,
};

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (state, action) => {
      const { user, accessToken, refreshToken } = action.payload;
      state.user = user;
      state.isAuthenticated = true;
      if (typeof window !== 'undefined') {
        localStorage.setItem('mips-user', JSON.stringify(user));
        localStorage.setItem('mips-access-token', accessToken);
        localStorage.setItem('mips-refresh-token', refreshToken);
      }
    },
    logout: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      if (typeof window !== 'undefined') {
        localStorage.removeItem('mips-user');
        localStorage.removeItem('mips-access-token');
        localStorage.removeItem('mips-refresh-token');
      }
    },
  },
});

export const { setCredentials, logout } = authSlice.actions;
export default authSlice.reducer;

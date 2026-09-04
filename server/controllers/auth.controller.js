import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User.js';
import { recordAudit } from '../utils/audit.js';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'access_secret';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresh_secret';
const MAX_LOGIN_ATTEMPTS = Number(process.env.MAX_LOGIN_ATTEMPTS) || 5;
const LOCK_TIME_MINUTES = Number(process.env.ACCOUNT_LOCK_MINUTES) || 30;

const signAccess = (user) => jwt.sign({ id: user._id, role: user.role }, ACCESS_SECRET, { expiresIn: '15m' });
const signRefresh = (user) => jwt.sign({ id: user._id }, REFRESH_SECRET, { expiresIn: '7d' });

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user) return res.status(401).json({ status: 'error', message: 'Invalid email or password' });

    if (user.lockedUntil && new Date() < user.lockedUntil) {
      return res.status(423).json({ status: 'error', message: 'Account locked due to multiple failed login attempts. Try later.' });
    }

    if (!(await user.comparePassword(password))) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      if (user.failedLoginAttempts >= MAX_LOGIN_ATTEMPTS) {
        user.lockedUntil = new Date(Date.now() + LOCK_TIME_MINUTES * 60 * 1000);
      }
      await user.save();
      return res.status(401).json({ status: 'error', message: 'Invalid email or password' });
    }

    // successful login
    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
    const refreshToken = signRefresh(user);
    user.refreshTokens = user.refreshTokens || [];
    user.refreshTokens.push(refreshToken);
    await user.save();

    const accessToken = signAccess(user);

    res.status(200).json({
      status: 'success',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          permissions: user.permissions || [],
          emailVerified: user.emailVerified || false,
        },
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    res.status(500).json({ status: 'error', message });
  }
};

export const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ status: 'error', message: 'User already exists' });
    }

    const emailVerificationToken = crypto.randomBytes(20).toString('hex');

    const user = new User({
      name,
      email,
      password,
      role: role || 'Customer',
      permissions: [],
      emailVerificationToken,
    });
    await user.save();

    try {
      await recordAudit({ req, action: 'register_user', target: user.email, details: { name: user.name, email: user.email } });
    } catch (e) {
      console.warn('audit failed', e);
    }

    // In production send verification email. For now return token in response for dev.
    res.status(201).json({ status: 'success', message: 'User registered successfully', data: { emailVerificationToken } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    res.status(500).json({ status: 'error', message });
  }
};

export const refresh = async (req, res) => {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) {
      return res.status(400).json({ status: 'error', message: 'Refresh token is required' });
    }

    let decoded;
    try {
      decoded = jwt.verify(refresh_token, REFRESH_SECRET);
    } catch (e) {
      return res.status(401).json({ status: 'error', message: 'Invalid refresh token' });
    }

    if (typeof decoded !== 'object' || decoded === null || !('id' in decoded)) {
      return res.status(401).json({ status: 'error', message: 'Invalid refresh token' });
    }

    const user = await User.findById(String(decoded.id));
    if (!user) {
      return res.status(401).json({ status: 'error', message: 'User not found' });
    }

    // ensure refresh token is still active for the user
    if (!Array.isArray(user.refreshTokens) || !user.refreshTokens.includes(refresh_token)) {
      return res.status(401).json({ status: 'error', message: 'Refresh token revoked' });
    }

    const accessToken = signAccess(user);
    res.status(200).json({ status: 'success', data: { accessToken } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid refresh token';
    res.status(401).json({ status: 'error', message });
  }
};

export const logout = async (req, res) => {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) return res.status(400).json({ status: 'error', message: 'Refresh token required' });

    let decoded;
    try { decoded = jwt.verify(refresh_token, REFRESH_SECRET); } catch (e) { decoded = null; }

    if (!decoded || !decoded.id) return res.status(200).json({ status: 'success', message: 'Logged out' });

    const user = await User.findById(String(decoded.id));
    if (!user) return res.status(200).json({ status: 'success', message: 'Logged out' });

    user.refreshTokens = (user.refreshTokens || []).filter((t) => t !== refresh_token);
    await user.save();

    res.status(200).json({ status: 'success', message: 'Logged out' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error instanceof Error ? error.message : 'Internal error' });
  }
};

export const logoutAll = async (req, res) => {
  try {
    const userId = req.body.userId || (req.user && String(req.user._id));
    if (!userId) return res.status(400).json({ status: 'error', message: 'User id required' });
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ status: 'error', message: 'User not found' });
    user.refreshTokens = [];
    await user.save();
    res.status(200).json({ status: 'success', message: 'Logged out from all sessions' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error instanceof Error ? error.message : 'Internal error' });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ status: 'error', message: 'Email required' });
    const user = await User.findOne({ email });
    if (!user) return res.status(200).json({ status: 'success', message: 'If the email exists, a reset token has been generated.' });

    const token = crypto.randomBytes(20).toString('hex');
    const hashed = crypto.createHash('sha256').update(token).digest('hex');
    user.passwordResetToken = hashed;
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    // In production: email the plain token. For development return it in response.
    res.status(200).json({ status: 'success', message: 'Password reset token generated', data: { token } });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error instanceof Error ? error.message : 'Internal error' });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ status: 'error', message: 'Token and new password required' });
    const hashed = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({ passwordResetToken: hashed, passwordResetExpires: { $gt: new Date() } });
    if (!user) return res.status(400).json({ status: 'error', message: 'Invalid or expired token' });

    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.refreshTokens = [];
    await user.save();

    res.status(200).json({ status: 'success', message: 'Password has been reset' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error instanceof Error ? error.message : 'Internal error' });
  }
};

export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ status: 'error', message: 'Token required' });
    const user = await User.findOne({ emailVerificationToken: token });
    if (!user) return res.status(400).json({ status: 'error', message: 'Invalid token' });
    user.emailVerified = true;
    user.emailVerificationToken = undefined;
    await user.save();
    res.status(200).json({ status: 'success', message: 'Email verified' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error instanceof Error ? error.message : 'Internal error' });
  }
};

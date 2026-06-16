import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { recordAudit } from '../utils/audit.js';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'access_secret';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresh_secret';

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ status: 'error', message: 'Invalid email or password' });
    }

    const accessToken = jwt.sign({ id: user._id, role: user.role }, ACCESS_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ id: user._id }, REFRESH_SECRET, { expiresIn: '7d' });

    res.status(200).json({
      status: 'success',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          permissions: user.permissions || [],
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

    const user = new User({
      name,
      email,
      password,
      role: role || 'User',
      permissions: [],
    });
    await user.save();

    try {
      await recordAudit({ req, action: 'register_user', target: user.email, details: { name: user.name, email: user.email } });
    } catch (e) {
      console.warn('audit failed', e);
    }

    res.status(201).json({ status: 'success', message: 'User registered successfully' });
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

    const decoded = jwt.verify(refresh_token, REFRESH_SECRET);
    if (typeof decoded !== 'object' || decoded === null || !('id' in decoded)) {
      return res.status(401).json({ status: 'error', message: 'Invalid refresh token' });
    }

    const user = await User.findById(String(decoded.id));
    if (!user) {
      return res.status(401).json({ status: 'error', message: 'User not found' });
    }

    const accessToken = jwt.sign({ id: user._id, role: user.role }, ACCESS_SECRET, { expiresIn: '15m' });
    res.status(200).json({ status: 'success', data: { accessToken } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid refresh token';
    res.status(401).json({ status: 'error', message });
  }
};

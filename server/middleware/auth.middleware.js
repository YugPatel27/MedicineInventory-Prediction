import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'access_secret';

export const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ status: 'error', message: 'Authorization header missing' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, ACCESS_SECRET);
    if (!decoded || typeof decoded !== 'object' || !decoded.id) {
      return res.status(401).json({ status: 'error', message: 'Invalid token' });
    }
    const user = await User.findById(decoded.id).select('name email role');
    if (!user) {
      return res.status(401).json({ status: 'error', message: 'User not found' });
    }
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ status: 'error', message: 'Invalid or expired token' });
  }
};

export const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'Admin') {
    return res.status(403).json({ status: 'error', message: 'Admin access required' });
  }
  next();
};

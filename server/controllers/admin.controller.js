import AuditLog from '../models/AuditLog.js';
import User from '../models/User.js';
import { recordAudit } from '../utils/audit.js';

const INVENTORY_PERMISSION = 'view_inventory';

export const getUsers = async (req, res) => {
  try {
    const users = await User.find().select('name email role permissions emailVerified createdAt').sort({ createdAt: -1 }).lean();
    res.status(200).json({ status: 'success', data: users });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error instanceof Error ? error.message : 'Internal Server Error' });
  }
};

export const setInventoryAccess = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ status: 'error', message: 'User not found' });
    if (user.role === 'Admin' || user.role === 'Manager') {
      return res.status(400).json({ status: 'error', message: 'Admins and managers already have inventory access' });
    }

    const granted = Boolean(req.body?.granted);
    const permissions = new Set(user.permissions || []);
    if (granted) permissions.add(INVENTORY_PERMISSION);
    else permissions.delete(INVENTORY_PERMISSION);
    user.permissions = [...permissions];
    await user.save();

    try {
      await recordAudit({ req, action: granted ? 'grant_inventory_access' : 'revoke_inventory_access', target: user.email, details: { granted } });
    } catch (auditError) {
      console.warn('audit failed', auditError);
    }

    res.status(200).json({ status: 'success', data: { userId: user._id, granted } });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error instanceof Error ? error.message : 'Internal Server Error' });
  }
};

export const getAuditLogs = async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const logs = await AuditLog.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('user', 'name email role')
      .lean();

    res.status(200).json({ status: 'success', data: logs });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    res.status(500).json({ status: 'error', message });
  }
};

export const deleteAuditLog = async (req, res) => {
  try {
    const id = req.params.id;
    const log = await AuditLog.findByIdAndDelete(id);
    if (!log) return res.status(404).json({ status: 'error', message: 'Log not found' });
    res.status(200).json({ status: 'success', message: 'Log deleted' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    res.status(500).json({ status: 'error', message });
  }
};

export const clearAuditLogs = async (req, res) => {
  try {
    await AuditLog.deleteMany({});
    res.status(200).json({ status: 'success', message: 'All logs cleared' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    res.status(500).json({ status: 'error', message });
  }
};

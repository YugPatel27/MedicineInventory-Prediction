import jwt from 'jsonwebtoken';
import AuditLog from '../models/AuditLog.js';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'access_secret';

export async function recordAudit({ req, action, target, details = {} }) {
  let userId = req.user?._id || req.user?.id || null;
  let userRole = req.user?.role || 'unknown';
  let userEmail = req.user?.email || '';

  if (!userId) {
    const authHeader = req.headers?.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = jwt.verify(token, ACCESS_SECRET);
        if (decoded && typeof decoded === 'object') {
          userId = decoded.id || null;
          userRole = decoded.role || userRole;
        }
      } catch {
        // ignore invalid token for audit records
      }
    }
  }

  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip || 'unknown';
  const userAgent = req.headers['user-agent'] || '';

  const log = new AuditLog({
    user: userId,
    userEmail: userEmail || undefined,
    userRole,
    action,
    target,
    details,
    ip,
    userAgent,
  });

  await log.save();
}

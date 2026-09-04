import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    userEmail: { type: String },
    userRole: { type: String, default: 'unknown' },
    action: { type: String, required: true },
    target: { type: String },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
    ip: { type: String },
    userAgent: { type: String },
    timestamp: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

const AuditLog = mongoose.model('AuditLog', auditLogSchema);
export default AuditLog;

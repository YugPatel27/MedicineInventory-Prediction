import mongoose from 'mongoose';

const { Schema } = mongoose;

const AuditLogSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: false },
    userEmail: { type: String, required: false },
    userRole: { type: String, required: false },
    action: { type: String, required: true },
    target: { type: String, required: false },
    details: { type: Schema.Types.Mixed, default: {} },
    ip: { type: String, default: 'unknown' },
    userAgent: { type: String, default: '' },
  },
  { timestamps: true }
);

export default mongoose.model('AuditLog', AuditLogSchema);

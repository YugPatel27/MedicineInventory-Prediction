import AuditLog from '../models/AuditLog.js';

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

import { Router } from 'express';
import { verifyToken } from '../middleware/auth.middleware.js';
import Medicine from '../models/Medicine.js';
import { recordAudit } from '../utils/audit.js';

const router = Router();

router.use(verifyToken);

router.post('/', async (req, res) => {
  try {
    const { medicine_id, quantity } = req.body;
    if (!medicine_id || !quantity || quantity <= 0) {
      return res.status(400).json({ status: 'error', message: 'Invalid medicine ID or quantity' });
    }

    const medicine = await Medicine.findOne({ medicine_id });
    if (!medicine) {
      return res.status(404).json({ status: 'error', message: 'Medicine not found' });
    }

    // Record an audit log for the reorder request
    try {
      await recordAudit({
        req,
        action: 'reorder_medicine',
        target: medicine_id,
        details: {
          medicine_name: medicine.medicine_name,
          quantity,
          current_stock: medicine.stock_quantity,
          minimum_stock: medicine.minimum_stock
        }
      });
    } catch (auditErr) {
      console.warn('Reorder audit logging failed', auditErr);
    }

    res.status(200).json({
      status: 'success',
      message: 'Reorder request submitted successfully',
      data: {
        medicine_id,
        quantity,
        medicine_name: medicine.medicine_name
      }
    });
  } catch (error) {
    console.error('Reorder request failed:', error);
    res.status(500).json({ status: 'error', message: 'Internal Server Error' });
  }
});

export default router;

import { Router } from 'express';
import { verifyToken, requireAdmin } from '../middleware/auth.middleware.js';
import Medicine from '../models/Medicine.js';
import { recordAudit } from '../utils/audit.js';
import { hasInventoryAccess } from '../utils/inventoryAccess.js';
import * as orderController from '../controllers/order.controller.js';

const router = Router();

router.use(verifyToken);

// Billing / cart orders -----------------------------------------------------
router.post('/', orderController.createOrder);
router.get('/', orderController.listOrders);
router.get('/meta/statuses', orderController.orderStatusOptions);
router.get('/:id', orderController.getOrderById);
router.patch('/:id/status', requireAdmin, orderController.updateOrderStatus);
router.patch('/:id', requireAdmin, orderController.updateOrder);

// Supplier reorder request (kept as-is for the Purchases workflow) ---------
router.post('/reorder', async (req, res) => {
  try {
    if (!hasInventoryAccess(req.user)) {
      return res.status(403).json({ status: 'error', message: 'Inventory access has not been granted by an administrator' });
    }
    const { medicine_id, quantity } = req.body;
    if (!medicine_id || !quantity || quantity <= 0) {
      return res.status(400).json({ status: 'error', message: 'Invalid medicine ID or quantity' });
    }

    const medicine = await Medicine.findOne({ medicine_id });
    if (!medicine) {
      return res.status(404).json({ status: 'error', message: 'Medicine not found' });
    }

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

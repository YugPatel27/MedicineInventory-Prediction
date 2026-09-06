import { Router } from 'express';
import * as medicineController from '../controllers/medicine.controller.js';
import { verifyToken } from '../middleware/auth.middleware.js';

const router = Router();

const requireAdminOrManager = (req, res, next) => {
  if (!req.user || !['Admin', 'Manager'].includes(req.user.role)) {
    return res.status(403).json({ status: 'error', message: 'Admin or Manager access required' });
  }
  next();
};

router.use(verifyToken);
router.post('/', requireAdminOrManager, medicineController.createMedicine);
router.put('/:id', requireAdminOrManager, medicineController.updateMedicine);
router.delete('/:id', requireAdminOrManager, medicineController.deleteMedicine);
router.get('/summary', medicineController.getSummary);
router.get('/alerts', medicineController.getAlerts);
router.post('/backfill-prices', requireAdminOrManager, medicineController.backfillPricesFromReference);
router.get('/', medicineController.getAllMedicines);
router.get('/:id', medicineController.getMedicineById);
router.post('/:id/transaction', requireAdminOrManager, medicineController.processStockTransaction);

export default router;

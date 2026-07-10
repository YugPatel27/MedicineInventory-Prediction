import { Router } from 'express';
import * as medicineController from '../controllers/medicine.controller.js';
import { verifyToken } from '../middleware/auth.middleware.js';

const router = Router();

router.use(verifyToken);
router.get('/summary', medicineController.getSummary);
router.get('/alerts', medicineController.getAlerts);
router.get('/', medicineController.getAllMedicines);
router.get('/:id', medicineController.getMedicineById);
router.post('/', medicineController.createMedicine);
router.put('/:id', medicineController.updateMedicine);
router.delete('/:id', medicineController.deleteMedicine);
router.post('/:id/transaction', medicineController.processStockTransaction);

export default router;

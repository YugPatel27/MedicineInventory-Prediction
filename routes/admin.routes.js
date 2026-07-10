import { Router } from 'express';
import * as adminController from '../controllers/admin.controller.js';
import { verifyToken, requireAdmin } from '../middleware/auth.middleware.js';

const router = Router();

router.use(verifyToken, requireAdmin);

router.get('/logs', adminController.getAuditLogs);
router.delete('/logs/:id', adminController.deleteAuditLog);
router.delete('/logs', adminController.clearAuditLogs);

export default router;

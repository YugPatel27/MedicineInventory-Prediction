import { Router } from 'express';
import * as predictionController from '../controllers/prediction.controller.js';
import { verifyToken } from '../middleware/auth.middleware.js';

const router = Router();
router.use(verifyToken);

router.post('/run', predictionController.runForecasting);

export default router;

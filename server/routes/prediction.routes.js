import { Router } from 'express';
import * as predictionController from '../controllers/prediction.controller.js';

const router = Router();

router.post('/run', predictionController.runForecasting);

export default router;

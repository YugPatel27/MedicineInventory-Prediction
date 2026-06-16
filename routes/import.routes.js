import { Router } from 'express';
import multer from 'multer';
import * as importController from '../controllers/import.controller.js';

const router = Router();
const upload = multer({ dest: 'uploads/' });

router.post('/bulk-insert', upload.single('file'), importController.bulkInsert);

export default router;

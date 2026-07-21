import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import * as importController from '../controllers/import.controller.js';

const router = Router();
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const safeName = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${safeName}`;
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

router.post('/bulk-insert', upload.single('file'), importController.bulkInsert);
router.post('/store-upload', upload.single('file'), importController.storeUpload);
router.get('/uploads/latest', importController.getLatestUpload);
router.delete('/uploads/:filename', importController.deleteStoredUpload);
router.post('/process-upload', importController.processStoredUpload);

export default router;

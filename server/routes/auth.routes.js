import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';

const router = Router();

router.post('/login', authController.login);
router.post('/register', authController.register);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.post('/logout-all', authController.logoutAll);
router.post('/forgot', authController.forgotPassword);
router.post('/reset', authController.resetPassword);
router.post('/verify-email', authController.verifyEmail);

export default router;

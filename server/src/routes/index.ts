import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { authRouter } from './authRoutes';

export const router = Router();

router.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

router.use('/auth', authRouter);

router.get('/me', authMiddleware, (req, res) => {
  res.status(200).json({ user: req.user });
});

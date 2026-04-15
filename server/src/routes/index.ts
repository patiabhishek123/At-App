import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { authorizeRoles } from '../middleware/roleMiddleware';
import { authRouter } from './authRoutes';
import { sessionRouter } from './sessionRoutes';

export const router = Router();

router.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

router.use('/auth', authRouter);
router.use('/sessions', sessionRouter);

router.get('/me', authMiddleware, (req, res) => {
  res.status(200).json({ user: req.user });
});

router.get('/student/dashboard', authMiddleware, authorizeRoles('student'), (_req, res) => {
  res.status(200).json({ message: 'Student route accessed' });
});

router.get('/teacher/dashboard', authMiddleware, authorizeRoles('teacher'), (_req, res) => {
  res.status(200).json({ message: 'Teacher route accessed' });
});

router.get('/admin/dashboard', authMiddleware, authorizeRoles('admin'), (_req, res) => {
  res.status(200).json({ message: 'Admin route accessed' });
});

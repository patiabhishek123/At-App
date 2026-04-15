import { Router } from 'express';
import { startSessionController } from '../controllers/sessionController';
import { authMiddleware } from '../middleware/authMiddleware';
import { authorizeRoles } from '../middleware/roleMiddleware';

export const sessionRouter = Router();

sessionRouter.post('/start', authMiddleware, authorizeRoles('teacher'), startSessionController);

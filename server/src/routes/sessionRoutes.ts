import { Router } from 'express';
import { getSessionAttendanceController, startSessionController } from '../controllers/sessionController';
import {
	endSessionByBodyController,
	endSessionController,
	getSessionAttendanceCsvController,
	getSessionAttendanceSummaryController
} from '../controllers/dashboardController';
import { authMiddleware } from '../middleware/authMiddleware';
import { authorizeRoles } from '../middleware/roleMiddleware';

export const sessionRouter = Router();

sessionRouter.post('/start', authMiddleware, authorizeRoles('teacher'), startSessionController);
sessionRouter.post('/end', authMiddleware, authorizeRoles('teacher', 'admin'), endSessionByBodyController);
sessionRouter.post('/:id/end', authMiddleware, authorizeRoles('teacher', 'admin'), endSessionController);
sessionRouter.get('/:id/attendance', authMiddleware, authorizeRoles('teacher', 'admin'), getSessionAttendanceController);
sessionRouter.get('/:id/attendance/summary', authMiddleware, authorizeRoles('teacher', 'admin'), getSessionAttendanceSummaryController);
sessionRouter.get('/:id/attendance/csv', authMiddleware, authorizeRoles('teacher', 'admin'), getSessionAttendanceCsvController);

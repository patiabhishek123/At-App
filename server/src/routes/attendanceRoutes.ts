import { Router } from 'express';
import { markAttendanceController } from '../controllers/attendanceController';
import { authMiddleware } from '../middleware/authMiddleware';
import { authorizeRoles } from '../middleware/roleMiddleware';

export const attendanceRouter = Router();

attendanceRouter.post('/mark', authMiddleware, authorizeRoles('student'), markAttendanceController);

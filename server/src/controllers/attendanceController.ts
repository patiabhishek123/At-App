import { NextFunction, Request, Response } from 'express';
import { markAttendance } from '../services/attendanceService';

export async function markAttendanceController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const studentId = req.user?.id;
    const { session_token: sessionToken } = req.body as { session_token?: string };

    if (!studentId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    if (!sessionToken) {
      res.status(400).json({ success: false, message: 'session_token is required' });
      return;
    }

    const attendance = await markAttendance(studentId, sessionToken);

    res.status(201).json({
      success: true,
      attendance
    });
  } catch (error) {
    next(error);
  }
}

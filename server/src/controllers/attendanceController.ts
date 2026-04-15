import { NextFunction, Request, Response } from 'express';
import { markAttendance } from '../services/attendanceService';

function resolveRequestIp(req: Request): string | null {
  const forwarded = req.headers['x-forwarded-for'];

  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }

  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].split(',')[0].trim();
  }

  return req.socket.remoteAddress ?? null;
}

export async function markAttendanceController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const studentId = req.user?.id;
    const { session_token: sessionToken } = req.body as { session_token?: string };
    const studentIp = resolveRequestIp(req);

    if (!studentId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    if (!sessionToken) {
      res.status(400).json({ success: false, message: 'session_token is required' });
      return;
    }

    if (!studentIp) {
      res.status(400).json({ success: false, message: 'Unable to determine student IP' });
      return;
    }

    const result = await markAttendance(studentId, sessionToken, studentIp);

    res.status(result.alreadyMarked ? 200 : 201).json({
      success: true,
      message: result.message,
      already_marked: result.alreadyMarked,
      attendance: result.attendance
    });
  } catch (error) {
    next(error);
  }
}

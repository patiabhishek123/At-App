import { NextFunction, Request, Response } from 'express';
import { getSessionAttendance, startClassSession } from '../services/sessionService';

export async function startSessionController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const teacherId = req.user?.id;
    const { subject_id: subjectId } = req.body as { subject_id?: string | number };

    if (!teacherId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    if (!subjectId) {
      res.status(400).json({ message: 'subject_id is required' });
      return;
    }

    const session = await startClassSession(teacherId, String(subjectId));
    res.status(201).json({ session });
  } catch (error) {
    next(error);
  }
}

export async function getSessionAttendanceController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const requesterId = req.user?.id;
    const requesterRole = req.user?.role;
    const { id: sessionId } = req.params as { id?: string };

    if (!requesterId || !requesterRole) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    if (!sessionId) {
      res.status(400).json({ success: false, message: 'session id is required' });
      return;
    }

    const result = await getSessionAttendance(sessionId, requesterId, requesterRole);

    res.status(200).json({
      success: true,
      session: result.session,
      students: result.students
    });
  } catch (error) {
    next(error);
  }
}

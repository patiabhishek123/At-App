import { NextFunction, Request, Response } from 'express';
import { startClassSession } from '../services/sessionService';

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

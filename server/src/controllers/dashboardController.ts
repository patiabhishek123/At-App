import { NextFunction, Request, Response } from 'express';
import {
  addTeacherSubject,
  endSession,
  getAttendanceCsv,
  getSessionAttendanceWithSummary,
  getStudentHistory,
  getStudentStats,
  getTeacherSubjects
} from '../services/dashboardService';

export async function getStudentStatsController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const studentId = req.user?.id;
    if (!studentId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const stats = await getStudentStats(studentId);
    res.status(200).json({ success: true, stats });
  } catch (error) {
    next(error);
  }
}

export async function getStudentHistoryController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const studentId = req.user?.id;
    if (!studentId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const history = await getStudentHistory(studentId);
    res.status(200).json({ success: true, history });
  } catch (error) {
    next(error);
  }
}

export async function getTeacherSubjectsController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const teacherId = req.user?.id;
    if (!teacherId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const subjects = await getTeacherSubjects(teacherId);
    res.status(200).json({ success: true, subjects });
  } catch (error) {
    next(error);
  }
}

export async function addTeacherSubjectController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const teacherId = req.user?.id;
    if (!teacherId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const {
      subject_name: subjectName,
      branch_id: branchId,
      year_id: yearId
    } = req.body as {
      subject_name?: string;
      branch_id?: string;
      year_id?: string;
    };

    if (!subjectName || !branchId || !yearId) {
      res.status(400).json({ success: false, message: 'subject_name, branch_id and year_id are required' });
      return;
    }

    const subject = await addTeacherSubject(teacherId, subjectName, branchId, yearId);
    res.status(201).json({ success: true, subject });
  } catch (error) {
    next(error);
  }
}

export async function endSessionController(req: Request, res: Response, next: NextFunction): Promise<void> {
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

    const session = await endSession(sessionId, requesterId, requesterRole);
    res.status(200).json({ success: true, session });
  } catch (error) {
    next(error);
  }
}

export async function endSessionByBodyController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const requesterId = req.user?.id;
    const requesterRole = req.user?.role;
    const { session_id: sessionId } = req.body as { session_id?: string };

    if (!requesterId || !requesterRole) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    if (!sessionId) {
      res.status(400).json({ success: false, message: 'session_id is required' });
      return;
    }

    const session = await endSession(sessionId, requesterId, requesterRole);
    res.status(200).json({ success: true, session });
  } catch (error) {
    next(error);
  }
}

export async function getSessionAttendanceSummaryController(req: Request, res: Response, next: NextFunction): Promise<void> {
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

    const result = await getSessionAttendanceWithSummary(sessionId, requesterId, requesterRole);

    res.status(200).json({
      success: true,
      session: result.session,
      summary: result.summary,
      students: result.students
    });
  } catch (error) {
    next(error);
  }
}

export async function getSessionAttendanceCsvController(req: Request, res: Response, next: NextFunction): Promise<void> {
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

    const csv = await getAttendanceCsv(sessionId, requesterId, requesterRole);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="session-${sessionId}-attendance.csv"`);
    res.status(200).send(csv);
  } catch (error) {
    next(error);
  }
}

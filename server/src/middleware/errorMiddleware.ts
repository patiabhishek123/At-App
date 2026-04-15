import { Request, Response, NextFunction } from 'express';

export function errorMiddleware(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  const message = err instanceof Error ? err.message : 'Internal server error';

  if (message === 'Student already exists') {
    res.status(409).json({ success: false, message });
    return;
  }

  if (message === 'Invalid credentials') {
    res.status(401).json({ success: false, message });
    return;
  }

  if (message === 'Teacher not found') {
    res.status(404).json({ success: false, message });
    return;
  }

  if (message === 'Subject not assigned to teacher') {
    res.status(403).json({ success: false, message });
    return;
  }

  if (message === 'Forbidden session access') {
    res.status(403).json({ success: false, message });
    return;
  }

  if (message === 'Session not found') {
    res.status(404).json({ success: false, message });
    return;
  }

  if (message === 'Session is not active' || message === 'Session expired') {
    res.status(400).json({ success: false, message });
    return;
  }

  if (message === 'Attendance already marked') {
    res.status(409).json({ success: false, message });
    return;
  }

  if (message === 'Invalid student IP' || message === 'Subnet mismatch') {
    res.status(400).json({ success: false, message });
    return;
  }

  res.status(500).json({ success: false, message });
}

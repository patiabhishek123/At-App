import { Request, Response, NextFunction } from 'express';

export function errorMiddleware(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  const message = err instanceof Error ? err.message : 'Internal server error';

  if (message === 'Student already exists') {
    res.status(409).json({ message });
    return;
  }

  if (message === 'Invalid credentials') {
    res.status(401).json({ message });
    return;
  }

  res.status(500).json({ message });
}

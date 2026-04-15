declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        rollNo?: string;
        role: 'student' | 'teacher' | 'admin';
      };
    }
  }
}

export {};

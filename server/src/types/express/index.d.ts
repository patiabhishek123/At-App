declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        rollNo: string;
      };
    }
  }
}

export {};

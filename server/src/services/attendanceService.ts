import { env } from '../config/env';
import {
  AttendanceRecord,
  createAttendanceRecord,
  deactivateSession,
  findSessionByToken
} from '../models/sessionModel';

export async function markAttendance(studentId: string, sessionToken: string): Promise<AttendanceRecord> {
  const session = await findSessionByToken(sessionToken);

  if (!session) {
    throw new Error('Session not found');
  }

  if (!session.is_active) {
    throw new Error('Session is not active');
  }

  if (session.elapsed_seconds > env.sessionValiditySeconds) {
    await deactivateSession(session.id);
    throw new Error('Session expired');
  }

  const record = await createAttendanceRecord(session.id, studentId, 'present');
  if (!record) {
    throw new Error('Attendance already marked');
  }

  return record;
}

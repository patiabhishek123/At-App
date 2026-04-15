import { randomUUID } from 'crypto';
import { env } from '../config/env';
import {
  createSession,
  deactivateSession,
  findSessionById,
  findTeacherById,
  isSubjectAssignedToTeacher,
  listSessionAttendance,
  Session
} from '../models/sessionModel';
import { broadcastSessionTokenToStudents } from '../ws/socketServer';
import { UserRole } from '../middleware/roleMiddleware';

function scheduleSessionExpiry(sessionId: string): void {
  const timeoutMs = env.sessionValiditySeconds * 1000;

  const timer = setTimeout(() => {
    void deactivateSession(sessionId);
  }, timeoutMs);

  timer.unref();
}

export async function startClassSession(teacherId: string, subjectId: string): Promise<Session> {
  const teacherExists = await findTeacherById(teacherId);
  if (!teacherExists) {
    throw new Error('Teacher not found');
  }

  const subjectAssigned = await isSubjectAssignedToTeacher(subjectId, teacherId);
  if (!subjectAssigned) {
    throw new Error('Subject not assigned to teacher');
  }

  const sessionToken = randomUUID();
  const session = await createSession(subjectId, teacherId, sessionToken);
  scheduleSessionExpiry(session.id);
  broadcastSessionTokenToStudents(session.session_token, session.id);

  return session;
}

export async function getSessionAttendance(
  sessionId: string,
  requesterId: string,
  requesterRole: UserRole
): Promise<{
  session: Pick<Session, 'id' | 'subject_id' | 'teacher_id' | 'start_time' | 'end_time' | 'is_active'>;
  students: Awaited<ReturnType<typeof listSessionAttendance>>;
}> {
  const session = await findSessionById(sessionId);

  if (!session) {
    throw new Error('Session not found');
  }

  if (requesterRole === 'teacher' && session.teacher_id !== requesterId) {
    throw new Error('Forbidden session access');
  }

  const students = await listSessionAttendance(sessionId);

  return {
    session: {
      id: session.id,
      subject_id: session.subject_id,
      teacher_id: session.teacher_id,
      start_time: session.start_time,
      end_time: session.end_time,
      is_active: session.is_active
    },
    students
  };
}

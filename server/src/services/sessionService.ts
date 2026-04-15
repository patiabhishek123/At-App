import { randomUUID } from 'crypto';
import { env } from '../config/env';
import {
  createSession,
  deactivateSession,
  findTeacherById,
  isSubjectAssignedToTeacher,
  Session
} from '../models/sessionModel';

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

  return session;
}

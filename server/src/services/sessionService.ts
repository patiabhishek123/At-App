import { randomUUID } from 'crypto';
import { createSession, findTeacherById, isSubjectAssignedToTeacher, Session } from '../models/sessionModel';

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
  return createSession(subjectId, teacherId, sessionToken);
}

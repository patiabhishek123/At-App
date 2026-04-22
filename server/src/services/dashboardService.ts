import {
  countEligibleStudentsForSession,
  getSessionAttendanceForCsv,
  getSessionAttendanceForSummary,
  getStudentHistoryById,
  getStudentStatsById
} from '../models/dashboardModel';
import {
  deactivateSession,
  findSessionById,
  getTeacherAssignedSubjects,
  Session
} from '../models/sessionModel';
import { UserRole } from '../middleware/roleMiddleware';
import { broadcastSessionEnded } from '../ws/socketServer';

export async function getStudentStats(studentId: string) {
  return getStudentStatsById(studentId);
}

export async function getStudentHistory(studentId: string) {
  return getStudentHistoryById(studentId, 5);
}

export async function getTeacherSubjects(teacherId: string) {
  return getTeacherAssignedSubjects(teacherId);
}

export async function endSession(
  sessionId: string,
  requesterId: string,
  requesterRole: UserRole
) {
  const session = await findSessionById(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }

  if (requesterRole === 'teacher' && session.created_by_teacher_id !== requesterId) {
    throw new Error('Forbidden session access');
  }

  const deactivated = await deactivateSession(sessionId);

  broadcastSessionEnded(session.id);

  return deactivated ?? session;
}

export async function getSessionAttendanceWithSummary(
  sessionId: string,
  requesterId: string,
  requesterRole: UserRole
) {
  const session = await findSessionById(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }

  if (requesterRole === 'teacher' && session.created_by_teacher_id !== requesterId) {
    throw new Error('Forbidden session access');
  }

  const students = await getSessionAttendanceForSummary(sessionId);
  const eligibleStudents = await countEligibleStudentsForSession(sessionId);
  const presentCount = students.filter((item) => item.status === 'present').length;

  return {
    session: session as Session,
    students,
    summary: {
      eligible_students: eligibleStudents,
      present_students: presentCount
    }
  };
}

export async function getAttendanceCsv(
  sessionId: string,
  requesterId: string,
  requesterRole: UserRole
): Promise<string> {
  const session = await findSessionById(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }

  if (requesterRole === 'teacher' && session.created_by_teacher_id !== requesterId) {
    throw new Error('Forbidden session access');
  }

  const rows = await getSessionAttendanceForCsv(sessionId);

  const header = 'student_name,roll_no,status,timestamp';
  const lines = rows.map((row) => {
    const safeName = `"${row.student_name.replace(/"/g, '""')}"`;
    const safeRoll = `"${row.roll_no.replace(/"/g, '""')}"`;
    const safeStatus = row.status;
    const safeTimestamp = row.timestamp ? row.timestamp.toISOString() : '';
    return `${safeName},${safeRoll},${safeStatus},${safeTimestamp}`;
  });

  return [header, ...lines].join('\n');
}

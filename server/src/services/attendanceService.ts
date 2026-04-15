import { isIP } from 'node:net';
import { env } from '../config/env';
import {
  AttendanceRecord,
  checkStudentEligibility,
  countMarkedAttendanceBySession,
  createAttendanceRecord,
  deactivateSession,
  findAttendanceBySessionAndStudent,
  findSessionAttendanceSubnet,
  findStudentById,
  findSessionByToken,
  getSubjectWithHierarchy
} from '../models/sessionModel';
import { broadcastAttendanceUpdateToTeachers } from '../ws/socketServer';

export type MarkAttendanceResult = {
  attendance: AttendanceRecord;
  alreadyMarked: boolean;
  message: string;
};

function normalizeIp(ip: string): string {
  if (ip === '::1') {
    return '127.0.0.1';
  }

  if (ip.startsWith('::ffff:')) {
    return ip.slice(7);
  }

  return ip;
}

function deriveSubnet(ip: string): string {
  const version = isIP(ip);

  if (version === 4) {
    const parts = ip.split('.');
    return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
  }

  if (version === 6) {
    const head = ip.toLowerCase().split('::')[0];
    const groups = head.split(':').filter(Boolean);

    while (groups.length < 4) {
      groups.push('0');
    }

    return `${groups.slice(0, 4).join(':')}::/64`;
  }

  throw new Error('Invalid student IP');
}

export async function markAttendance(
  studentId: string,
  sessionToken: string,
  rawStudentIp: string
): Promise<MarkAttendanceResult> {
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

  // Check student eligibility based on branch and year
  const eligibility = await checkStudentEligibility(studentId, session.subject_id);
  if (!eligibility.eligible) {
    throw new Error(eligibility.reason || 'Student not eligible for this session');
  }

  const studentIp = normalizeIp(rawStudentIp.trim());
  const subnet = deriveSubnet(studentIp);

  const expectedSubnet = await findSessionAttendanceSubnet(session.id);
  if (expectedSubnet && expectedSubnet !== subnet) {
    throw new Error('Subnet mismatch');
  }

  const record = await createAttendanceRecord(session.id, studentId, 'present', studentIp, subnet);
  if (!record) {
    const existing = await findAttendanceBySessionAndStudent(session.id, studentId);
    if (!existing) {
      throw new Error('Attendance already marked');
    }

    return {
      attendance: existing,
      alreadyMarked: true,
      message: 'Already marked'
    };
  }

  const student = await findStudentById(studentId);
  if (student) {
    const attendanceCount = await countMarkedAttendanceBySession(session.id);
    broadcastAttendanceUpdateToTeachers({
      sessionId: session.id,
      attendanceCount,
      student
    });
  }

  return {
    attendance: record,
    alreadyMarked: false,
    message: 'Attendance marked'
  };
}

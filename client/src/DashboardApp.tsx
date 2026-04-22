import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from './components/ui/Button'
import { Card } from './components/ui/Card'
import { Skeleton } from './components/ui/Skeleton'
import { Table } from './components/ui/Table'
import { Toast } from './components/ui/Toast'
import { apiGet, apiGetCsv, apiPost } from './services/api'
import { createWsClient } from './services/wsClient'

const WS_BASE_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:8000'

type Role = 'student' | 'teacher' | 'admin'

type SessionAuth = {
  token: string
  role: Role
  userId?: string
  rollNo?: string
  student?: {
    id: string
    name: string
    roll_no: string
    branch_name: string
    year_number: number
  }
}

type ToastState = {
  message: string
  type: 'success' | 'error'
}

type StudentStats = {
  classes_attended: number
  total_sessions: number
  attendance_percentage: number
}

type StudentHistoryItem = {
  session_id: string
  date: string
  subject: string
  status: 'present' | 'absent' | 'late' | 'excused'
  timestamp: string | null
}

type TeacherSubject = {
  id: string
  name: string
  branch_name: string
  year_number: number
}

type AttendanceRow = {
  student_id: string
  name: string
  roll_no: string
  status: 'present' | 'absent' | 'late' | 'excused'
  marked_at: string | null
}

type SessionEventPayload = {
  type: 'session.started' | 'session.ended'
  sessionId?: string
  sessionToken?: string
  session_token?: string
  validitySeconds?: number
}

type AttendanceRealtimePayload = {
  type: 'attendance.marked'
  sessionId: string
  attendanceCount: number
  student: {
    id: string
    name: string
    roll_no: string
  }
}

type LoginResponse = {
  success: boolean
  token: string
  student?: SessionAuth['student']
  message?: string
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) {
      return null
    }

    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(base64)) as Record<string, unknown>
  } catch {
    return null
  }
}

function parseSessionEvent(payload: unknown): SessionEventPayload | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const candidate = payload as Record<string, unknown>
  if (candidate.type !== 'session.started' && candidate.type !== 'session.ended') {
    return null
  }

  return {
    type: candidate.type,
    sessionId: typeof candidate.sessionId === 'string' ? candidate.sessionId : undefined,
    sessionToken: typeof candidate.sessionToken === 'string' ? candidate.sessionToken : undefined,
    session_token: typeof candidate.session_token === 'string' ? candidate.session_token : undefined,
    validitySeconds: typeof candidate.validitySeconds === 'number' ? candidate.validitySeconds : undefined
  }
}

function parseAttendanceRealtimeEvent(payload: unknown): AttendanceRealtimePayload | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const candidate = payload as Record<string, unknown>
  if (candidate.type !== 'attendance.marked') {
    return null
  }

  if (
    typeof candidate.sessionId !== 'string' ||
    typeof candidate.attendanceCount !== 'number' ||
    !candidate.student ||
    typeof candidate.student !== 'object'
  ) {
    return null
  }

  const student = candidate.student as Record<string, unknown>
  if (typeof student.id !== 'string' || typeof student.name !== 'string' || typeof student.roll_no !== 'string') {
    return null
  }

  return {
    type: 'attendance.marked',
    sessionId: candidate.sessionId,
    attendanceCount: candidate.attendanceCount,
    student: {
      id: student.id,
      name: student.name,
      roll_no: student.roll_no
    }
  }
}

function DashboardApp() {
  const [role, setRole] = useState<Role>('student')
  const [rollNo, setRollNo] = useState('')
  const [password, setPassword] = useState('')
  const [tokenInput, setTokenInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  const [session, setSession] = useState<SessionAuth | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)

  const [socketState, setSocketState] = useState<'connecting' | 'open' | 'closed'>('closed')

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [activeSessionToken, setActiveSessionToken] = useState<string | null>(null)
  const [sessionExpiresAt, setSessionExpiresAt] = useState<number | null>(null)
  const [countdown, setCountdown] = useState(0)

  const [markingAttendance, setMarkingAttendance] = useState(false)
  const [attendanceLocked, setAttendanceLocked] = useState(false)
  const [attendanceMessage, setAttendanceMessage] = useState<string>('')

  const [studentStats, setStudentStats] = useState<StudentStats | null>(null)
  const [studentHistory, setStudentHistory] = useState<StudentHistoryItem[]>([])
  const [loadingStats, setLoadingStats] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)

  const [teacherSubjects, setTeacherSubjects] = useState<TeacherSubject[]>([])
  const [selectedSubjectId, setSelectedSubjectId] = useState('')
  const [loadingSubjects, setLoadingSubjects] = useState(false)

  const [teacherSessionId, setTeacherSessionId] = useState<string | null>(null)
  const [startingSession, setStartingSession] = useState(false)
  const [endingSession, setEndingSession] = useState(false)
  const [eligibleStudents, setEligibleStudents] = useState(0)
  const [presentStudents, setPresentStudents] = useState(0)
  const [attendanceRows, setAttendanceRows] = useState<AttendanceRow[]>([])
  const [loadingAttendanceTable, setLoadingAttendanceTable] = useState(false)

  const studentName = session?.student?.name ?? 'Student'
  const studentBranch = session?.student?.branch_name ?? 'N/A'
  const studentYear = session?.student?.year_number ?? 'N/A'

  useEffect(() => {
    if (!session) {
      setSocketState('closed')
      return
    }

    setSocketState('connecting')

    const wsClient = createWsClient({
      baseUrl: WS_BASE_URL,
      token: session.token,
      role: session.role,
      onOpen: () => setSocketState('open'),
      onClose: () => setSocketState('closed'),
      onMessage: (message) => {
        const sessionEvent = parseSessionEvent(message.payload)
        if (sessionEvent?.type === 'session.started') {
          const token = sessionEvent.sessionToken ?? sessionEvent.session_token
          if (token) {
            setActiveSessionToken(token)
            setActiveSessionId(sessionEvent.sessionId ?? null)
            setAttendanceLocked(false)
            setAttendanceMessage('')
            const validity = sessionEvent.validitySeconds ?? 30
            const expiresAt = Date.now() + validity * 1000
            setSessionExpiresAt(expiresAt)
            setCountdown(validity)
          }
          return
        }

        if (sessionEvent?.type === 'session.ended') {
          if (sessionEvent.sessionId && sessionEvent.sessionId === activeSessionId) {
            setActiveSessionToken(null)
            setActiveSessionId(null)
            setSessionExpiresAt(null)
            setCountdown(0)
            setAttendanceLocked(true)
            setAttendanceMessage('Session ended by teacher')
          }

          if (sessionEvent.sessionId && sessionEvent.sessionId === teacherSessionId) {
            setTeacherSessionId(null)
          }

          return
        }

        const attendanceEvent = parseAttendanceRealtimeEvent(message.payload)
        if (attendanceEvent && attendanceEvent.sessionId === teacherSessionId) {
          setPresentStudents(attendanceEvent.attendanceCount)
          setAttendanceRows((current) =>
            current.map((row) =>
              row.student_id === attendanceEvent.student.id
                ? {
                    ...row,
                    status: 'present',
                    marked_at: new Date().toISOString()
                  }
                : row
            )
          )
        }
      }
    })

    return () => wsClient.disconnect()
  }, [session, activeSessionId, teacherSessionId])

  useEffect(() => {
    if (!sessionExpiresAt) {
      setCountdown(0)
      return
    }

    const timer = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((sessionExpiresAt - Date.now()) / 1000))
      setCountdown(left)
      if (left <= 0) {
        setActiveSessionToken(null)
        setActiveSessionId(null)
        setSessionExpiresAt(null)
        setAttendanceLocked(true)
        setAttendanceMessage('Session expired')
      }
    }, 1000)

    return () => window.clearInterval(timer)
  }, [sessionExpiresAt])

  useEffect(() => {
    async function loadStudentData() {
      if (!session || session.role !== 'student') {
        return
      }

      setLoadingStats(true)
      setLoadingHistory(true)

      try {
        const statsResponse = await apiGet<{ success: boolean; stats: StudentStats }>('/student/stats', session.token)
        setStudentStats(statsResponse.stats)
      } catch (error) {
        setToast({ message: error instanceof Error ? error.message : 'Failed to load student stats', type: 'error' })
      } finally {
        setLoadingStats(false)
      }

      try {
        const historyResponse = await apiGet<{ success: boolean; history: StudentHistoryItem[] }>(
          '/student/history',
          session.token
        )
        setStudentHistory(historyResponse.history)
      } catch (error) {
        setToast({ message: error instanceof Error ? error.message : 'Failed to load history', type: 'error' })
      } finally {
        setLoadingHistory(false)
      }
    }

    void loadStudentData()
  }, [session])

  useEffect(() => {
    async function loadTeacherSubjects() {
      if (!session || session.role !== 'teacher') {
        return
      }

      setLoadingSubjects(true)
      try {
        const response = await apiGet<{ success: boolean; subjects: TeacherSubject[] }>('/teacher/subjects', session.token)
        setTeacherSubjects(response.subjects)
        if (response.subjects.length > 0) {
          setSelectedSubjectId(response.subjects[0].id)
        }
      } catch (error) {
        setToast({ message: error instanceof Error ? error.message : 'Failed to load subjects', type: 'error' })
      } finally {
        setLoadingSubjects(false)
      }
    }

    void loadTeacherSubjects()
  }, [session])

  async function refreshTeacherAttendance(sessionId: string, token: string): Promise<void> {
    setLoadingAttendanceTable(true)
    try {
      const response = await apiGet<{
        success: boolean
        summary: { eligible_students: number; present_students: number }
        students: AttendanceRow[]
      }>(`/sessions/${sessionId}/attendance/summary`, token)

      setEligibleStudents(response.summary.eligible_students)
      setPresentStudents(response.summary.present_students)
      setAttendanceRows(response.students)
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : 'Failed to load attendance summary', type: 'error' })
    } finally {
      setLoadingAttendanceTable(false)
    }
  }

  async function handleCredentialLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setAuthError('')

    try {
      const data = await apiPost<LoginResponse>('/auth/login', { roll_no: rollNo, password })
      const payload = decodeJwtPayload(data.token)
      const userRole = (payload?.role as Role | undefined) ?? role

      setSession({
        token: data.token,
        role: userRole,
        userId: (payload?.studentId as string | undefined) ?? (payload?.userId as string | undefined),
        rollNo: (payload?.rollNo as string | undefined) ?? rollNo,
        student: data.student
      })
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  function handleTokenLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAuthError('')

    if (!tokenInput.trim()) {
      setAuthError('Token is required')
      return
    }

    const payload = decodeJwtPayload(tokenInput.trim())
    const userRole = (payload?.role as Role | undefined) ?? role

    setSession({
      token: tokenInput.trim(),
      role: userRole,
      userId: (payload?.studentId as string | undefined) ?? (payload?.userId as string | undefined),
      rollNo: payload?.rollNo as string | undefined
    })
  }

  function logout() {
    setSession(null)
    setTokenInput('')
    setPassword('')
    setRollNo('')
    setActiveSessionId(null)
    setActiveSessionToken(null)
    setSessionExpiresAt(null)
    setCountdown(0)
    setAttendanceLocked(false)
    setAttendanceMessage('')
    setTeacherSessionId(null)
    setPresentStudents(0)
    setEligibleStudents(0)
    setAttendanceRows([])
  }

  async function handleStartSession() {
    if (!session || !selectedSubjectId) {
      setToast({ message: 'Select a subject first', type: 'error' })
      return
    }

    setStartingSession(true)
    try {
      const response = await apiPost<{ session: { id: string } }>('/sessions/start', { subject_id: selectedSubjectId }, session.token)
      setTeacherSessionId(response.session.id)
      await refreshTeacherAttendance(response.session.id, session.token)
      setToast({ message: 'Session started successfully', type: 'success' })
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : 'Unable to start session', type: 'error' })
    } finally {
      setStartingSession(false)
    }
  }

  async function handleEndSession() {
    if (!session || !teacherSessionId) {
      return
    }

    setEndingSession(true)
    try {
      await apiPost('/sessions/end', { session_id: teacherSessionId }, session.token)
      setTeacherSessionId(null)
      setToast({ message: 'Session ended', type: 'success' })
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : 'Unable to end session', type: 'error' })
    } finally {
      setEndingSession(false)
    }
  }

  async function handleMarkAttendance() {
    if (!session || !activeSessionToken || attendanceLocked) {
      return
    }

    setMarkingAttendance(true)
    try {
      const response = await apiPost<{ message?: string; already_marked?: boolean }>(
        '/attendance/mark',
        { session_token: activeSessionToken },
        session.token
      )

      const message = response.message ?? 'Attendance marked'
      setAttendanceMessage(message)
      setAttendanceLocked(true)
      setToast({ message, type: 'success' })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to mark attendance'
      setAttendanceMessage(message)
      if (message.toLowerCase().includes('already')) {
        setAttendanceLocked(true)
      }
      setToast({ message, type: 'error' })
    } finally {
      setMarkingAttendance(false)
    }
  }

  async function handleDownloadCsv() {
    if (!session || !teacherSessionId) {
      return
    }

    try {
      const csvText = await apiGetCsv(`/sessions/${teacherSessionId}/attendance/csv`, session.token)
      const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `session-${teacherSessionId}-attendance.csv`
      link.click()
      URL.revokeObjectURL(url)
      setToast({ message: 'CSV downloaded', type: 'success' })
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : 'Failed to download CSV', type: 'error' })
    }
  }

  const attendancePercent = useMemo(() => {
    if (!studentStats) {
      return '0.00'
    }
    return studentStats.attendance_percentage.toFixed(2)
  }, [studentStats])

  if (!session) {
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-3xl space-y-6">
          <Card title="Attendance System" subtitle="Sign in to continue">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-700">Role</label>
                <select
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  value={role}
                  onChange={(event) => setRole(event.target.value as Role)}
                >
                  <option value="student">Student</option>
                  <option value="teacher">Teacher</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card title="Login with Credentials">
              <form className="space-y-3" onSubmit={handleCredentialLogin}>
                <input
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  placeholder="Roll No"
                  value={rollNo}
                  onChange={(event) => setRollNo(event.target.value)}
                  required
                />
                <input
                  type="password"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  placeholder="Password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
                <Button type="submit" fullWidth disabled={loading}>
                  {loading ? 'Signing in...' : 'Sign in'}
                </Button>
              </form>
            </Card>

            <Card title="Login with JWT Token">
              <form className="space-y-3" onSubmit={handleTokenLogin}>
                <textarea
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  rows={5}
                  placeholder="Paste JWT token"
                  value={tokenInput}
                  onChange={(event) => setTokenInput(event.target.value)}
                />
                <Button type="submit" variant="secondary" fullWidth>
                  Use Token
                </Button>
              </form>
            </Card>
          </div>

          {authError && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{authError}</p>}
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <nav className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Attendance System</h1>
            <p className="text-sm text-gray-500">Socket: {socketState}</p>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="rounded-full bg-gray-100 px-3 py-1 font-medium text-gray-700">{session.role}</span>
            <Button variant="secondary" onClick={logout}>
              Logout
            </Button>
          </div>
        </div>
      </nav>

      <section className="mx-auto grid w-full max-w-6xl gap-6 p-6">
        {session.role === 'student' && (
          <>
            <Card title={`Welcome, ${studentName}`} subtitle={`Branch: ${studentBranch} | Year: ${studentYear}`} />

            <Card title="Attendance Stats">
              {loadingStats ? (
                <div className="grid gap-3 md:grid-cols-3">
                  <Skeleton className="h-14" />
                  <Skeleton className="h-14" />
                  <Skeleton className="h-14" />
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-lg border border-gray-200 p-4">
                    <p className="text-xs uppercase text-gray-500">Classes Attended</p>
                    <p className="mt-1 text-xl font-semibold text-gray-900">{studentStats?.classes_attended ?? 0}</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-4">
                    <p className="text-xs uppercase text-gray-500">Total Sessions</p>
                    <p className="mt-1 text-xl font-semibold text-gray-900">{studentStats?.total_sessions ?? 0}</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-4">
                    <p className="text-xs uppercase text-gray-500">Attendance %</p>
                    <p className="mt-1 text-xl font-semibold text-gray-900">{attendancePercent}%</p>
                  </div>
                </div>
              )}
            </Card>

            <Card title="Live Session">
              {!activeSessionToken ? (
                <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-600">
                  No active class
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-sm text-gray-600">
                    Session ID: <span className="font-medium text-gray-900">{activeSessionId ?? '—'}</span>
                  </div>
                  <div className="text-sm text-gray-600">
                    Time left: <span className="font-semibold text-gray-900">{countdown}s</span>
                  </div>
                  <Button fullWidth className="py-3 text-base" onClick={handleMarkAttendance} disabled={markingAttendance || attendanceLocked || countdown <= 0}>
                    {markingAttendance ? 'Marking...' : 'Mark Present'}
                  </Button>
                  {attendanceMessage && (
                    <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">{attendanceMessage}</p>
                  )}
                </div>
              )}
            </Card>

            <Card title="Attendance History" subtitle="Last 5 sessions">
              {loadingHistory ? (
                <div className="space-y-2">
                  <Skeleton className="h-10" />
                  <Skeleton className="h-10" />
                  <Skeleton className="h-10" />
                </div>
              ) : (
                <Table
                  rows={studentHistory}
                  columns={[
                    {
                      key: 'date',
                      header: 'Date',
                      render: (row) => new Date(row.date).toLocaleString()
                    },
                    {
                      key: 'subject',
                      header: 'Subject',
                      render: (row) => row.subject
                    },
                    {
                      key: 'status',
                      header: 'Status',
                      render: (row) => (
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-medium ${
                            row.status === 'present' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {row.status}
                        </span>
                      )
                    }
                  ]}
                />
              )}
            </Card>
          </>
        )}

        {session.role === 'teacher' && (
          <>
            <Card title="Teacher Dashboard" subtitle="Manage class sessions and monitor live attendance" />

            <Card title="Session Controls">
              {loadingSubjects ? (
                <Skeleton className="h-11 w-full" />
              ) : (
                <div className="space-y-4">
                  <select
                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
                    value={selectedSubjectId}
                    onChange={(event) => setSelectedSubjectId(event.target.value)}
                  >
                    {teacherSubjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.name} ({subject.branch_name} - Year {subject.year_number})
                      </option>
                    ))}
                    {teacherSubjects.length === 0 && <option value="">No subjects assigned</option>}
                  </select>

                  <div className="grid gap-3 md:grid-cols-2">
                    <Button onClick={handleStartSession} disabled={startingSession || !selectedSubjectId}>
                      {startingSession ? 'Starting...' : 'Start Session'}
                    </Button>
                    <Button variant="danger" onClick={handleEndSession} disabled={endingSession || !teacherSessionId}>
                      {endingSession ? 'Ending...' : 'End Session'}
                    </Button>
                  </div>
                </div>
              )}
            </Card>

            <Card title="Live Attendance Panel">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border border-gray-200 p-4">
                  <p className="text-xs uppercase text-gray-500">Active Session</p>
                  <p className="mt-1 text-base font-semibold text-gray-900">{teacherSessionId ?? 'None'}</p>
                </div>
                <div className="rounded-lg border border-gray-200 p-4">
                  <p className="text-xs uppercase text-gray-500">Total Students Eligible</p>
                  <p className="mt-1 text-xl font-semibold text-gray-900">{eligibleStudents}</p>
                </div>
                <div className="rounded-lg border border-gray-200 p-4">
                  <p className="text-xs uppercase text-gray-500">Marked Present</p>
                  <p className="mt-1 text-xl font-semibold text-gray-900">{presentStudents}</p>
                </div>
              </div>
            </Card>

            <Card
              title="Attendance List"
              subtitle="Live session attendance"
              right={
                <Button variant="secondary" onClick={handleDownloadCsv} disabled={!teacherSessionId}>
                  Download Attendance CSV
                </Button>
              }
            >
              {loadingAttendanceTable ? (
                <div className="space-y-2">
                  <Skeleton className="h-10" />
                  <Skeleton className="h-10" />
                  <Skeleton className="h-10" />
                </div>
              ) : (
                <Table
                  rows={attendanceRows}
                  columns={[
                    { key: 'name', header: 'Student Name', render: (row) => row.name },
                    { key: 'roll', header: 'Roll No', render: (row) => row.roll_no },
                    {
                      key: 'status',
                      header: 'Status',
                      render: (row) => (
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-medium ${
                            row.status === 'present' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {row.status}
                        </span>
                      )
                    },
                    {
                      key: 'time',
                      header: 'Timestamp',
                      render: (row) => (row.marked_at ? new Date(row.marked_at).toLocaleString() : '—')
                    }
                  ]}
                />
              )}
            </Card>
          </>
        )}

        {session.role === 'admin' && (
          <Card title="Admin Dashboard" subtitle="Admin role is authenticated. Additional admin views can be added here." />
        )}
      </section>
    </main>
  )
}

export default DashboardApp

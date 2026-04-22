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

type BranchOption = {
  id: string
  name: string
}

type YearOption = {
  id: string
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

type DemoTeacherTokenResponse = {
  success: boolean
  token: string
  teacher: {
    id: string
    name: string
  }
  subject: {
    id: string
    name: string
    branch_name: string
    year_number: number
  }
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
  const [loadingDemoTeacher, setLoadingDemoTeacher] = useState(false)
  const [authError, setAuthError] = useState('')
  const [showTokenLogin, setShowTokenLogin] = useState(false)
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
  const [subjectNameInput, setSubjectNameInput] = useState('')
  const [branchOptions, setBranchOptions] = useState<BranchOption[]>([])
  const [yearOptions, setYearOptions] = useState<YearOption[]>([])
  const [selectedBranchId, setSelectedBranchId] = useState('')
  const [selectedYearId, setSelectedYearId] = useState('')
  const [addingSubject, setAddingSubject] = useState(false)
  const [studentNameInput, setStudentNameInput] = useState('')
  const [studentRollNoInput, setStudentRollNoInput] = useState('')
  const [studentPasswordInput, setStudentPasswordInput] = useState('')
  const [studentBranchId, setStudentBranchId] = useState('')
  const [studentYearId, setStudentYearId] = useState('')
  const [addingStudent, setAddingStudent] = useState(false)

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

  useEffect(() => {
    async function loadAcademicOptions() {
      if (!session || session.role !== 'teacher') {
        return
      }

      try {
        const [branchesRes, yearsRes] = await Promise.all([
          apiGet<{ success: boolean; branches: BranchOption[] }>('/auth/branches'),
          apiGet<{ success: boolean; years: YearOption[] }>('/auth/years')
        ])

        setBranchOptions(branchesRes.branches)
        setYearOptions(yearsRes.years)

        if (branchesRes.branches.length > 0) {
          setSelectedBranchId(branchesRes.branches[0].id)
          setStudentBranchId(branchesRes.branches[0].id)
        }

        if (yearsRes.years.length > 0) {
          setSelectedYearId(yearsRes.years[0].id)
          setStudentYearId(yearsRes.years[0].id)
        }
      } catch (error) {
        setToast({ message: error instanceof Error ? error.message : 'Failed to load branch/year options', type: 'error' })
      }
    }

    void loadAcademicOptions()
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

  async function handleDemoTeacherLogin() {
    setAuthError('')
    setLoadingDemoTeacher(true)

    try {
      const data = await apiPost<DemoTeacherTokenResponse>('/auth/teacher/demo-token', {})
      const payload = decodeJwtPayload(data.token)

      setRole('teacher')
      setTokenInput(data.token)
      setSession({
        token: data.token,
        role: 'teacher',
        userId: (payload?.studentId as string | undefined) ?? (payload?.userId as string | undefined),
        rollNo: payload?.rollNo as string | undefined
      })
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Unable to start demo teacher login')
    } finally {
      setLoadingDemoTeacher(false)
    }
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

  async function handleAddSubject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!session || session.role !== 'teacher') {
      return
    }

    const trimmedName = subjectNameInput.trim()
    if (!trimmedName || !selectedBranchId || !selectedYearId) {
      setToast({ message: 'Subject name, branch and year are required', type: 'error' })
      return
    }

    setAddingSubject(true)
    try {
      const response = await apiPost<{ success: boolean; subject: { id: string } }>(
        '/teacher/subjects',
        {
          subject_name: trimmedName,
          branch_id: selectedBranchId,
          year_id: selectedYearId
        },
        session.token
      )

      const refreshed = await apiGet<{ success: boolean; subjects: TeacherSubject[] }>('/teacher/subjects', session.token)
      setTeacherSubjects(refreshed.subjects)
      if (response.subject?.id) {
        setSelectedSubjectId(response.subject.id)
      }
      setSubjectNameInput('')
      setToast({ message: 'Subject added successfully', type: 'success' })
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : 'Failed to add subject', type: 'error' })
    } finally {
      setAddingSubject(false)
    }
  }

  async function handleAddStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const name = studentNameInput.trim()
    const roll = studentRollNoInput.trim()
    const pwd = studentPasswordInput.trim()

    if (!name || !roll || !pwd || !studentBranchId || !studentYearId) {
      setToast({ message: 'Name, roll no, password, branch and year are required', type: 'error' })
      return
    }

    setAddingStudent(true)
    try {
      await apiPost('/auth/register', {
        name,
        roll_no: roll,
        password: pwd,
        branch_id: studentBranchId,
        year_id: studentYearId
      })

      setStudentNameInput('')
      setStudentRollNoInput('')
      setStudentPasswordInput('')
      setToast({ message: 'Student added successfully', type: 'success' })
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : 'Failed to add student', type: 'error' })
    } finally {
      setAddingStudent(false)
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
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-blue-50 p-6">
        <div className="grid w-full max-w-[900px] gap-8 rounded-2xl border border-gray-100 bg-white p-6 shadow-lg md:grid-cols-[1.05fr_0.95fr] md:p-8">
          <section className="flex flex-col justify-center rounded-2xl border border-gray-100 bg-gradient-to-br from-white via-indigo-50/50 to-blue-50/70 p-6 shadow-lg">
            <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 text-2xl shadow-sm">
              🎓
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Smart Attendance System</h1>
            <p className="mt-3 text-base leading-7 text-gray-600">
              Fast, secure, real-time attendance tracking for students and faculty.
            </p>

            <div className="mt-8 grid gap-4">
              <div className="rounded-2xl border border-gray-100 bg-white/80 p-4 shadow-lg">
                <p className="text-sm font-semibold text-gray-900">Real-time session updates</p>
                <p className="mt-1 text-sm text-gray-600">Students receive class availability instantly via live socket updates.</p>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-white/80 p-4 shadow-lg">
                <p className="text-sm font-semibold text-gray-900">Accurate attendance insights</p>
                <p className="mt-1 text-sm text-gray-600">Track attendance history, percentages, and session-level exports with ease.</p>
              </div>
            </div>
          </section>

          <section className="animate-fade-in rounded-2xl border border-gray-100 bg-white p-1 shadow-lg">
            <div className="rounded-2xl bg-white p-5 md:p-6">
              <div className="mb-6">
                <h2 className="text-2xl font-semibold text-gray-900">Welcome back</h2>
                <p className="mt-2 text-sm text-gray-500">Sign in to access your attendance dashboard.</p>
              </div>

              <Button type="button" variant="secondary" fullWidth className="mb-4" onClick={handleDemoTeacherLogin} disabled={loadingDemoTeacher}>
                {loadingDemoTeacher ? 'Preparing demo teacher...' : 'Use Demo Teacher (Auto Token)'}
              </Button>

              <form className="space-y-5" onSubmit={handleCredentialLogin}>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Select Role</label>
                  <div className="grid grid-cols-3 gap-2 rounded-xl bg-gray-100 p-1">
                    {(['student', 'teacher', 'admin'] as Role[]).map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setRole(option)}
                        className={`rounded-lg px-3 py-2 text-sm font-medium capitalize transition ${
                          role === option
                            ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-indigo-200'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Roll No</label>
                    <input
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-base text-gray-900 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-300"
                      placeholder="Enter your roll number"
                      value={rollNo}
                      onChange={(event) => setRollNo(event.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Password</label>
                    <input
                      type="password"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-base text-gray-900 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-300"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                    />
                  </div>
                </div>

                {authError && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{authError}</p>}

                <Button type="submit" fullWidth disabled={loading} className="bg-indigo-600 hover:bg-indigo-700">
                  {loading ? 'Signing in...' : 'Login'}
                </Button>
              </form>

              <div className="mt-6 border-t border-gray-100 pt-5">
                <button
                  type="button"
                  onClick={() => setShowTokenLogin((current) => !current)}
                  className="text-sm font-medium text-indigo-600 transition hover:text-indigo-700"
                >
                  {showTokenLogin ? 'Hide token login' : 'Have a token? Paste here'}
                </button>

                {showTokenLogin && (
                  <form className="mt-4 space-y-3" onSubmit={handleTokenLogin}>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">JWT Token</label>
                      <textarea
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-300"
                        rows={4}
                        placeholder="Paste your access token"
                        value={tokenInput}
                        onChange={(event) => setTokenInput(event.target.value)}
                      />
                    </div>
                    <Button type="submit" variant="secondary" fullWidth>
                      Continue with token
                    </Button>
                  </form>
                )}
              </div>
            </div>
          </section>
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
                  <form className="grid gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4 md:grid-cols-4" onSubmit={handleAddSubject}>
                    <input
                      className="md:col-span-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
                      placeholder="New subject name"
                      value={subjectNameInput}
                      onChange={(event) => setSubjectNameInput(event.target.value)}
                    />
                    <select
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
                      value={selectedBranchId}
                      onChange={(event) => setSelectedBranchId(event.target.value)}
                    >
                      {branchOptions.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <select
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
                        value={selectedYearId}
                        onChange={(event) => setSelectedYearId(event.target.value)}
                      >
                        {yearOptions.map((year) => (
                          <option key={year.id} value={year.id}>
                            Year {year.year_number}
                          </option>
                        ))}
                      </select>
                      <Button type="submit" disabled={addingSubject}>
                        {addingSubject ? 'Adding...' : 'Add Subject'}
                      </Button>
                    </div>
                  </form>

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

            <Card title="Add Student" subtitle="Register student for branch and year">
              <form className="grid gap-3 md:grid-cols-2" onSubmit={handleAddStudent}>
                <input
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  placeholder="Student name"
                  value={studentNameInput}
                  onChange={(event) => setStudentNameInput(event.target.value)}
                />
                <input
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  placeholder="Roll number"
                  value={studentRollNoInput}
                  onChange={(event) => setStudentRollNoInput(event.target.value)}
                />
                <input
                  type="password"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  placeholder="Password"
                  value={studentPasswordInput}
                  onChange={(event) => setStudentPasswordInput(event.target.value)}
                />
                <select
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  value={studentBranchId}
                  onChange={(event) => setStudentBranchId(event.target.value)}
                >
                  {branchOptions.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
                <select
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  value={studentYearId}
                  onChange={(event) => setStudentYearId(event.target.value)}
                >
                  {yearOptions.map((year) => (
                    <option key={year.id} value={year.id}>
                      Year {year.year_number}
                    </option>
                  ))}
                </select>
                <Button type="submit" disabled={addingStudent}>
                  {addingStudent ? 'Adding...' : 'Add Student'}
                </Button>
              </form>
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

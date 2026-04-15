# Academic Hierarchy Refactoring Guide

## Overview
This document describes the refactoring of the attendance system to support academic hierarchy (branches, years, and subject-specific student groups).

## Database Schema Changes

### New Tables

#### 1. **branches**
```sql
CREATE TABLE branches (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE
);
```
- Stores branch names (e.g., "CSE", "IT", "ECE")
- Each branch is unique

#### 2. **years**
```sql
CREATE TABLE years (
  id BIGSERIAL PRIMARY KEY,
  year_number SMALLINT NOT NULL UNIQUE,
  CONSTRAINT chk_year_range CHECK (year_number >= 1 AND year_number <= 4)
);
```
- Stores academic years (1-4)
- Year numbers must be between 1 and 4

### Updated Tables

#### 3. **students** (Modified)
**New Columns:**
- `branch_id` BIGINT (FK → branches.id)
- `year_id` BIGINT (FK → years.id)

**Removed Columns:**
- `id` changed from UUID to BIGSERIAL
- (No longer referencing a single subject field)

**Constraints:**
```sql
CONSTRAINT fk_students_branch
  FOREIGN KEY (branch_id) REFERENCES branches(id) 
  ON UPDATE CASCADE ON DELETE RESTRICT

CONSTRAINT fk_students_year
  FOREIGN KEY (year_id) REFERENCES years(id) 
  ON UPDATE CASCADE ON DELETE RESTRICT
```

**Indexes:**
```sql
CREATE INDEX idx_students_branch_year ON students(branch_id, year_id)
```

#### 4. **subjects** (Modified)
**New Columns:**
- `branch_id` BIGINT (FK → branches.id)
- `year_id` BIGINT (FK → years.id)

**Removed Columns:**
- `teacher_id` (now managed via `teacher_subjects` mapping table)

**Constraints:**
```sql
CONSTRAINT fk_subjects_branch
  FOREIGN KEY (branch_id) REFERENCES branches(id)
  ON UPDATE CASCADE ON DELETE RESTRICT

CONSTRAINT fk_subjects_year
  FOREIGN KEY (year_id) REFERENCES years(id)
  ON UPDATE CASCADE ON DELETE RESTRICT

CONSTRAINT uq_subject_branch_year_name UNIQUE (branch_id, year_id, name)
```

**Indexes:**
```sql
CREATE INDEX idx_subjects_branch_year ON subjects(branch_id, year_id)
```

#### 5. **teachers** (Modified)
**Changes:**
- Removed `subject` VARCHAR column
- Now managed through `teacher_subjects` mapping table

#### 6. **sessions** (Modified)
**Column Changes:**
- `teacher_id` → `created_by_teacher_id` (BIGINT FK → teachers.id)
  - Indicates who created the session
  - Teacher must have `teacher_subjects` entry for the subject

**Indexes:**
```sql
CREATE INDEX idx_sessions_created_by_teacher_id ON sessions(created_by_teacher_id)
```

#### 7. **attendance** (Enhanced)
**New Columns:**
- `student_ip` INET (for IP tracking, already present)
- `subnet` VARCHAR(50) (for subnet validation, already present)

---

## New Mapping Table

### **teacher_subjects**
```sql
CREATE TABLE teacher_subjects (
  id BIGSERIAL PRIMARY KEY,
  teacher_id BIGINT NOT NULL REFERENCES teachers(id) ON CASCADE,
  subject_id BIGINT NOT NULL REFERENCES subjects(id) ON CASCADE,
  CONSTRAINT uq_teacher_subject UNIQUE (teacher_id, subject_id)
);
```

**Purpose:** Many-to-many relationship allowing teachers to teach multiple subjects

**Indexes:**
```sql
CREATE INDEX idx_teacher_subjects_teacher_id ON teacher_subjects(teacher_id)
CREATE INDEX idx_teacher_subjects_subject_id ON teacher_subjects(subject_id)
```

---

## API Changes

### Authentication Endpoints

#### **POST /api/auth/register**

**OLD Request:**
```json
{
  "name": "John Doe",
  "roll_no": "CSE001",
  "password": "pass123"
}
```

**OLD Response:**
```json
{
  "token": "eyJhbGc..."
}
```

**NEW Request:**
```json
{
  "name": "John Doe",
  "roll_no": "CSE001",
  "password": "pass123",
  "branch_id": "1",
  "year_id": "2"
}
```

**NEW Response:**
```json
{
  "success": true,
  "token": "eyJhbGc...",
  "student": {
    "id": "12345",
    "name": "John Doe",
    "roll_no": "CSE001",
    "branch_name": "CSE",
    "year_number": 2
  }
}
```

**Required Fields:**
- `name` - Student name
- `roll_no` - Unique roll number
- `password` - Student password
- `branch_id` - Branch ID (get from GET /api/auth/branches)
- `year_id` - Year ID (get from GET /api/auth/years)

---

#### **POST /api/auth/login**

**Request:**
```json
{
  "roll_no": "CSE001",
  "password": "pass123"
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGc...",
  "student": {
    "id": "12345",
    "name": "John Doe",
    "roll_no": "CSE001",
    "branch_name": "CSE",
    "year_number": 2
  }
}
```

---

#### **GET /api/auth/branches**

**Response:**
```json
{
  "success": true,
  "branches": [
    { "id": "1", "name": "CSE" },
    { "id": "2", "name": "IT" },
    { "id": "3", "name": "ECE" }
  ]
}
```

---

#### **GET /api/auth/years**

**Response:**
```json
{
  "success": true,
  "years": [
    { "id": "1", "year_number": 1 },
    { "id": "2", "year_number": 2 },
    { "id": "3", "year_number": 3 },
    { "id": "4", "year_number": 4 }
  ]
}
```

---

### Session Endpoints

#### **POST /api/sessions/start**

**Request:**
```json
{
  "subject_id": "5"
}
```

**Response:**
```json
{
  "session": {
    "id": "42",
    "subject_id": "5",
    "created_by_teacher_id": "3",
    "start_time": "2026-04-16T10:30:00Z",
    "end_time": null,
    "is_active": true,
    "session_token": "550e8400-e29b-41d4-a716-446655440000",
    "branch_name": "CSE",
    "year_number": 2
  }
}
```

**Validation:**
- Teacher must be assigned to this subject (via `teacher_subjects` table)
- Subject must exist and have valid `branch_id` and `year_id`

**Error Responses:**
- `400 Bad Request` - "subject_id is required"
- `401 Unauthorized` - Missing teacher token
- `404 Not Found` - "Subject not assigned to teacher"
- `404 Not Found` - "Subject not found"

---

#### **GET /api/sessions/:id/attendance**

**Response:**
```json
{
  "success": true,
  "session": {
    "id": "42",
    "subject_id": "5",
    "created_by_teacher_id": "3",
    "start_time": "2026-04-16T10:30:00Z",
    "end_time": null,
    "is_active": true
  },
  "students": [
    {
      "student_id": "1",
      "name": "John Doe",
      "roll_no": "CSE001",
      "status": "present",
      "marked_at": "2026-04-16T10:31:15Z"
    },
    {
      "student_id": "2",
      "name": "Jane Smith",
      "roll_no": "CSE002",
      "status": "absent",
      "marked_at": null
    }
  ]
}
```

**Authorization:**
- Teachers can only view sessions they created
- Admins can view any session

---

### Attendance Endpoints

#### **POST /api/attendance/mark**

**Request:**
```json
{
  "session_token": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response (First Mark):**
```json
{
  "success": true,
  "message": "Attendance marked",
  "already_marked": false,
  "attendance": {
    "id": "100",
    "session_id": "42",
    "student_id": "1",
    "timestamp": "2026-04-16T10:31:15Z",
    "status": "present",
    "student_ip": "192.168.1.100",
    "subnet": "192.168.1.0/24"
  }
}
```

**Response (Already Marked - Idempotent):**
```json
{
  "success": true,
  "message": "Already marked",
  "already_marked": true,
  "attendance": {
    "id": "100",
    "session_id": "42",
    "student_id": "1",
    "timestamp": "2026-04-16T10:31:15Z",
    "status": "present",
    "student_ip": "192.168.1.100",
    "subnet": "192.168.1.0/24"
  }
}
```

**Validation Added:**
1. **Session Validation**
   - Session token must exist
   - Session must be active
   - Session must not be expired

2. **Eligibility Validation (NEW)**
   - Student's `branch_id` must match session's subject's `branch_id`
   - Student's `year_id` must match session's subject's `year_id`
   - If not eligible: `400 Bad Request` - "Student branch/year does not match session subject"

3. **IP Validation**
   - First student's IP determines the subnet for the session
   - Subsequent students must have IPs in the same subnet

**Error Responses:**
- `400 Bad Request` - "Session not found"
- `400 Bad Request` - "Session is not active"
- `400 Bad Request` - "Session expired"
- `400 Bad Request` - "Student branch/year does not match session subject" (NEW)
- `400 Bad Request` - "Subnet mismatch"
- `409 Conflict` - "Attendance already marked" (rare, usually returns 200 with already_marked=true)

---

## Backend Model Functions (New/Updated)

### sessionModel.ts

#### **getSubjectWithHierarchy(subjectId: string)**
Returns subject details with branch and year information.

```typescript
interface SubjectWithHierarchy {
  id: string;
  name: string;
  branch_id: string;
  year_id: string;
  branch_name: string;
  year_number: number;
}
```

#### **checkStudentEligibility(studentId: string, sessionSubjectId: string)**
Validates if a student is eligible to mark attendance for a session.

```typescript
interface StudentEligibility {
  eligible: boolean;
  reason?: string;
}
```

Returns:
- `{ eligible: true }` - Student can mark attendance
- `{ eligible: false, reason: "..." }` - Student not eligible

#### **getTeacherAssignedSubjects(teacherId: string)**
Fetches all subjects assigned to a teacher.

```typescript
SubjectWithHierarchy[] // Sorted by branch name, year number, subject name
```

---

## Frontend Changes Required

### 1. **Registration Form**

**Add Fields:**
- Branch dropdown (fetch from GET /api/auth/branches)
- Year dropdown (fetch from GET /api/auth/years)

**Registration Request:**
```typescript
const response = await fetch('/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: formData.name,
    roll_no: formData.rollNo,
    password: formData.password,
    branch_id: formData.branchId,
    year_id: formData.yearId
  })
});
```

**Response Handling:**
```typescript
const data = await response.json();
if (data.success) {
  // Store token and student info
  localStorage.setItem('token', data.token);
  localStorage.setItem('student', JSON.stringify(data.student));
  // Show: "Welcome, John Doe (CSE - Year 2)"
}
```

---

### 2. **Student Dashboard**

**Display Student Info:**
```typescript
// Show branch and year
<div>
  {student.branch_name} - Year {student.year_number}
</div>
```

**Automatic Eligibility:**
- Student will only see sessions from their branch and year
- If they try to mark attendance for a mismatched session, backend will reject with clear error

---

### 3. **Teacher Dashboard**

**Add Subject Selector:**
- Fetch assigned subjects from backend (or add GET /api/teachers/me/subjects endpoint)
- Display: "CSE: Data Structures (Year 2)" format
- Start session must send `subject_id` (not just subject name)

**Subject Dropdown:**
```typescript
const [assignedSubjects, setAssignedSubjects] = useState([]);

useEffect(() => {
  fetch('/api/teachers/subjects', {
    headers: { Authorization: `Bearer ${token}` }
  })
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        setAssignedSubjects(data.subjects);
      }
    });
}, [token]);
```

**Start Class Button:**
```typescript
const handleStartClass = async (subjectId) => {
  const response = await fetch('/api/sessions/start', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ subject_id: subjectId })
  });

  const data = await response.json();
  if (data.session) {
    // Display: "Session started for CSE - Year 2"
    // Broadcast session token to students
  }
};
```

---

## Backward Compatibility & Migration

### Breaking Changes ⚠️

1. **Student Registration**
   - Now requires `branch_id` and `year_id`
   - Old registrations without these fields will fail

2. **Session Creation**
   - Teachers must be assigned via `teacher_subjects` table
   - The old `subjects.teacher_id` FK is removed

3. **Student Primary Key**
   - Changed from `UUID` to `BIGSERIAL`
   - Any client storing student IDs must be prepared for integer IDs

### Migration Path

If migrating from old schema:

```sql
-- 1. Create new tables
CREATE TABLE branches (...);
CREATE TABLE years (...);

-- 2. Populate with data
INSERT INTO branches (name) VALUES ('CSE'), ('IT'), ('ECE');
INSERT INTO years (year_number) VALUES (1), (2), (3), (4);

-- 3. Add columns to students
ALTER TABLE students ADD COLUMN branch_id BIGINT;
ALTER TABLE students ADD COLUMN year_id BIGINT;

-- 4. Populate default values (if needed)
UPDATE students SET branch_id = 1, year_id = 1 WHERE branch_id IS NULL;

-- 5. Add constraints
ALTER TABLE students ADD CONSTRAINT fk_students_branch
  FOREIGN KEY (branch_id) REFERENCES branches(id);
ALTER TABLE students ADD CONSTRAINT fk_students_year
  FOREIGN KEY (year_id) REFERENCES years(id);

-- 6. Create teacher_subjects mapping
CREATE TABLE teacher_subjects (...);
INSERT INTO teacher_subjects (teacher_id, subject_id)
  SELECT DISTINCT teacher_id, id FROM subjects;

-- 7. Drop old teacher_id from subjects and update sessions
ALTER TABLE subjects DROP COLUMN teacher_id;
ALTER TABLE sessions RENAME COLUMN teacher_id TO created_by_teacher_id;
```

---

## Testing Checklist

- [ ] Register student with branch and year
- [ ] Student can log in and see their branch/year info
- [ ] Teacher can view assigned subjects
- [ ] Teacher can start session for assigned subject
- [ ] Student receives session token via WebSocket
- [ ] Student can mark attendance (only if branch/year matches)
- [ ] Student from different branch/year cannot mark attendance
- [ ] Attendance shows only eligible students (same branch/year)
- [ ] IP subnet validation still works
- [ ] Idempotent attendance marking (duplicate calls return 200)
- [ ] Both `npm run build` commands pass without errors

---

## Summary of Key Improvements

✅ **No Data Duplication:** Branch and year stored once, referenced via FKs

✅ **Proper Hierarchy:** Students belong to branch+year, subjects belong to branch+year

✅ **Flexible Teacher Assignment:** Teachers can teach multiple subjects, managed via mapping table

✅ **Automatic Eligibility:** Students can only mark attendance for sessions from their branch+year

✅ **Clean Constraints:** UNIQUE constraints enforce data integrity (e.g., same subject can't exist twice in same branch+year)

✅ **Efficient Queries:** Indexes on (branch_id, year_id) pairs enable fast lookups

✅ **Backward Compatible Approach:** Clear migration path for existing data

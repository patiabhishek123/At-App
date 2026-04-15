# Quick Reference: Academic Hierarchy Refactoring

## What Changed?

### Database
- ➕ Added `branches` table (CSE, IT, ECE, etc.)
- ➕ Added `years` table (1, 2, 3, 4)
- ➕ Added `teacher_subjects` mapping table
- 🔄 Updated `students` - added branch_id, year_id
- 🔄 Updated `subjects` - added branch_id, year_id
- 🔄 Updated `sessions` - renamed teacher_id → created_by_teacher_id
- 🔄 Updated `teachers` - removed subject field

### API Endpoints

#### New Endpoints
```
GET  /api/auth/branches          → List branches
GET  /api/auth/years             → List years
```

#### Updated Endpoints
```
POST /api/auth/register          → Now requires branch_id, year_id
POST /api/auth/login             → Returns student branch/year info
POST /api/sessions/start         → Validates teacher assignment via teacher_subjects
POST /api/attendance/mark        → NEW: Validates student branch/year eligibility
```

### Validation Logic

#### New: Student Eligibility Check
When marking attendance, the API now validates:
```
✅ Student's branch_id == Subject's branch_id
✅ Student's year_id == Subject's year_id
```

If validation fails:
```json
{
  "success": false,
  "message": "Student branch/year does not match session subject"
}
```

---

## Key Files Modified

### Backend
| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Complete schema rewrite |
| `db/attendance_schema.sql` | SQL schema updated |
| `models/sessionModel.ts` | +3 functions, updated interfaces |
| `models/userModel.ts` | +3 functions, updated Student interface |
| `services/attendanceService.ts` | Added eligibility check |
| `services/sessionService.ts` | Updated for new schema |
| `services/authService.ts` | Updated register/login |
| `controllers/authController.ts` | +2 new endpoints |
| `routes/authRoutes.ts` | Added new routes |

### Frontend
- ✨ No changes needed for compilation
- 🔄 Future: Add branch/year dropdowns to registration form

---

## New Functions (Backend)

### sessionModel.ts
```typescript
// Get subject with branch and year details
getSubjectWithHierarchy(subjectId: string): SubjectWithHierarchy

// Check if student can mark attendance for this session
checkStudentEligibility(studentId: string, sessionSubjectId: string): StudentEligibility

// Get all subjects taught by a teacher
getTeacherAssignedSubjects(teacherId: string): SubjectWithHierarchy[]
```

### userModel.ts
```typescript
// Get all branches
getBranches(): Promise<Branch[]>

// Get all years
getYears(): Promise<Year[]>

// Get student with branch/year details
findStudentWithDetailsByRollNo(rollNo: string): StudentWithDetails
```

---

## Updated Function Signatures

### Before → After

#### authService.register()
```typescript
// BEFORE
register(name, rollNo, password) → string (token)

// AFTER
register(name, rollNo, password, branchId, yearId) → AuthTokenWithDetails {
  token: string,
  student: { id, name, roll_no, branch_name, year_number }
}
```

#### authService.login()
```typescript
// BEFORE
login(rollNo, password) → string (token)

// AFTER
login(rollNo, password) → AuthTokenWithDetails {
  token: string,
  student: { id, name, roll_no, branch_name, year_number }
}
```

#### userModel.createStudent()
```typescript
// BEFORE
createStudent(name, rollNo, passwordHash) → Student

// AFTER
createStudent(name, rollNo, passwordHash, branchId, yearId) → Student
```

---

## Database Relationships

```
┌─────────────┐         ┌───────┐
│  branches   │←────┬───│students│
└─────────────┘     │   └───────┘
                    │
                    └───→┌────────┐
                        │ subjects│←──┐
                        └────────┘   │
                            ↑        │
                            │    ┌─────────────────┐
                            └────│teacher_subjects │
                                 └─────────────────┘
                                      ↓
                                  ┌─────────┐
                                  │teachers │
                                  └─────────┘

┌──────────┐         ┌─────────┐
│  years   │←────┬───│students │
└──────────┘     │   └─────────┘
                 │
                 └───→┌────────┐
                     │subjects │
                     └────────┘
                         ↑
                         │
                     ┌─────────┐
                     │sessions │
                     └─────────┘
                         ↓
                     ┌──────────┐
                     │attendance│
                     └──────────┘
```

---

## Testing the Changes

### 1. Check Compilation
```bash
cd server && npm run build
cd ../client && npm run build
```
✅ Both should compile with 0 errors

### 2. Test API Endpoints
```bash
# Get available branches
curl http://localhost:5000/api/auth/branches

# Get available years
curl http://localhost:5000/api/auth/years

# Register new student (requires branch_id, year_id)
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "roll_no": "CSE001",
    "password": "test123",
    "branch_id": "1",
    "year_id": "2"
  }'

# Login (returns branch/year info)
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "roll_no": "CSE001",
    "password": "test123"
  }'
```

### 3. Test Eligibility
```bash
# Start session with CSE branch, Year 2 subject
curl -X POST http://localhost:5000/api/sessions/start \
  -H "Authorization: Bearer <teacher_token>" \
  -H "Content-Type: application/json" \
  -d '{"subject_id": "5"}'

# Try to mark attendance with student from IT branch, Year 1
# → Should fail with "Student branch/year does not match"

# Try with eligible student from CSE branch, Year 2
# → Should succeed
```

---

## Error Messages

### Registration Errors
| Message | Cause | Fix |
|---------|-------|-----|
| "Name, roll_no, password, branch_id, and year_id are required" | Missing fields | Add all required fields |
| "Student already exists" | Roll number taken | Use different roll_no |

### Session Errors
| Message | Cause | Fix |
|---------|-------|-----|
| "Subject not assigned to teacher" | Teacher doesn't teach this subject | Add via teacher_subjects table |
| "Subject not found" | Invalid subject_id | Verify subject exists |

### Attendance Errors
| Message | Cause | Fix |
|---------|-------|-----|
| "Student branch/year does not match session subject" | Student not eligible | Enroll in correct branch/year |
| "Subnet mismatch" | Different subnet than first attendee | Connect from same network |
| "Session expired" | 30+ seconds since session start | Start new session |

---

## Migration Path for Existing Data

See [DATABASE_MIGRATION.md](DATABASE_MIGRATION.md) for detailed steps.

**Quick Overview:**
1. Create branches, years tables
2. Add branch_id, year_id to students
3. Add branch_id, year_id to subjects
4. Create teacher_subjects mapping
5. Rename teacher_id → created_by_teacher_id in sessions
6. Test referential integrity

---

## Frontend Integration (Next Steps)

### 1. Registration Form
```jsx
// Before: just name, roll_no, password
// After: add branch dropdown + year dropdown

const branches = await fetch('/api/auth/branches').then(r => r.json());
const years = await fetch('/api/auth/years').then(r => r.json());

<select name="branch_id" onChange={...}>
  {branches.map(b => <option value={b.id}>{b.name}</option>)}
</select>

<select name="year_id" onChange={...}>
  {years.map(y => <option value={y.id}>Year {y.year_number}</option>)}
</select>
```

### 2. Student Dashboard
```jsx
// Display student's branch and year
<div>
  {student.branch_name} - Year {student.year_number}
</div>
```

### 3. Teacher Dashboard
```jsx
// Replace text input with subject selector
const subjects = await fetch('/api/teachers/subjects').then(r => r.json());

<select onChange={(e) => setSelectedSubject(e.target.value)}>
  {subjects.map(s => (
    <option value={s.id}>
      {s.branch_name}: {s.name} (Year {s.year_number})
    </option>
  ))}
</select>
```

---

## Performance Notes

✅ Strategic indexes on (branch_id, year_id) pairs enable fast lookups

✅ Reduced query complexity with proper foreign keys

✅ No data duplication across tables

✅ Teacher-subject mapping is normalized (N:M relationship)

---

## Summary

| Aspect | Before | After |
|--------|--------|-------|
| **Student-Subject Relationship** | Via teacher | Via branch + year |
| **Teacher Assignment** | Single subject per teacher | Multiple subjects via mapping |
| **Eligibility Validation** | None | Automatic branch+year check |
| **Tables** | 5 | 8 (added branches, years, teacher_subjects) |
| **API Endpoints** | 6 | 8 (added /branches, /years) |
| **Code Lines** | ~500 | ~800 (added validation) |
| **Compilation Errors** | None | None (✅ 0 errors) |

---

## Documentation Files

1. **[REFACTORING_GUIDE.md](REFACTORING_GUIDE.md)** - Comprehensive guide
   - Database schema details
   - API endpoint specifications
   - Validation logic explanations
   - Frontend integration requirements

2. **[DATABASE_MIGRATION.md](DATABASE_MIGRATION.md)** - Migration instructions
   - Step-by-step SQL migration
   - Common scenarios
   - Rollback procedures
   - Troubleshooting

3. **[IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)** - What was done
   - Files modified
   - Functions added/updated
   - Compilation status
   - Testing checklist

---

## Next Steps

1. ✅ Review this quick reference
2. ✅ Read [REFACTORING_GUIDE.md](REFACTORING_GUIDE.md) for details
3. ✅ Migrate database using [DATABASE_MIGRATION.md](DATABASE_MIGRATION.md)
4. 🔄 Update frontend (registration, dashboards)
5. 🔄 Test end-to-end
6. 🚀 Deploy

---

**Status:** ✨ Backend implementation complete, ready for frontend integration

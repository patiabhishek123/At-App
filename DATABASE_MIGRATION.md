# Database Migration Guide

## Migrating from Old Schema to Academic Hierarchy Schema

### Prerequisites
- PostgreSQL 12+ running
- Current database backed up
- Application stopped

### Step-by-Step Migration

#### Step 1: Backup Current Database
```bash
pg_dump attendance_db > backup_$(date +%Y%m%d_%H%M%S).sql
```

#### Step 2: Create New Hierarchy Tables

Run these SQL commands in sequence:

```sql
-- Create branches table
CREATE TABLE IF NOT EXISTS branches (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL UNIQUE
);

-- Create years table
CREATE TABLE IF NOT EXISTS years (
    id BIGSERIAL PRIMARY KEY,
    year_number SMALLINT NOT NULL UNIQUE,
    CONSTRAINT chk_year_range CHECK (year_number >= 1 AND year_number <= 4)
);

-- Populate initial data
INSERT INTO branches (name) VALUES ('CSE'), ('IT'), ('ECE'), ('CIVIL'), ('MECHANICAL');
INSERT INTO years (year_number) VALUES (1), (2), (3), (4);

-- Verify inserts
SELECT * FROM branches;
SELECT * FROM years;
```

#### Step 3: Migrate Students Table

```sql
-- Add new columns to existing students table
ALTER TABLE students 
  ADD COLUMN branch_id BIGINT,
  ADD COLUMN year_id BIGINT;

-- Set default values for existing students (optional - customize as needed)
-- This example assigns all existing students to CSE, Year 1
UPDATE students 
  SET branch_id = (SELECT id FROM branches WHERE name = 'CSE'),
      year_id = (SELECT id FROM years WHERE year_number = 1)
  WHERE branch_id IS NULL;

-- Make columns NOT NULL after assigning values
ALTER TABLE students 
  ALTER COLUMN branch_id SET NOT NULL,
  ALTER COLUMN year_id SET NOT NULL;

-- Add foreign key constraints
ALTER TABLE students 
  ADD CONSTRAINT fk_students_branch
    FOREIGN KEY (branch_id) REFERENCES branches(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  ADD CONSTRAINT fk_students_year
    FOREIGN KEY (year_id) REFERENCES years(id)
    ON UPDATE CASCADE ON DELETE RESTRICT;

-- Create index for faster queries
CREATE INDEX idx_students_branch_year ON students(branch_id, year_id);
```

#### Step 4: Migrate Subjects Table

```sql
-- Add new columns
ALTER TABLE subjects 
  ADD COLUMN branch_id BIGINT,
  ADD COLUMN year_id BIGINT;

-- Set default values based on teacher's subjects
-- This example: assume all subjects belong to CSE, Year 1
UPDATE subjects 
  SET branch_id = (SELECT id FROM branches WHERE name = 'CSE'),
      year_id = (SELECT id FROM years WHERE year_number = 1)
  WHERE branch_id IS NULL;

-- Make columns NOT NULL
ALTER TABLE subjects 
  ALTER COLUMN branch_id SET NOT NULL,
  ALTER COLUMN year_id SET NOT NULL;

-- Add foreign key constraints
ALTER TABLE subjects 
  ADD CONSTRAINT fk_subjects_branch
    FOREIGN KEY (branch_id) REFERENCES branches(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  ADD CONSTRAINT fk_subjects_year
    FOREIGN KEY (year_id) REFERENCES years(id)
    ON UPDATE CASCADE ON DELETE RESTRICT;

-- Add unique constraint
ALTER TABLE subjects 
  ADD CONSTRAINT uq_subject_branch_year_name 
    UNIQUE (branch_id, year_id, name);

-- Create index
CREATE INDEX idx_subjects_branch_year ON subjects(branch_id, year_id);
```

#### Step 5: Create Teacher-Subjects Mapping Table

```sql
-- Create mapping table
CREATE TABLE IF NOT EXISTS teacher_subjects (
    id BIGSERIAL PRIMARY KEY,
    teacher_id BIGINT NOT NULL REFERENCES teachers(id) ON UPDATE CASCADE ON DELETE CASCADE,
    subject_id BIGINT NOT NULL REFERENCES subjects(id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT uq_teacher_subject UNIQUE (teacher_id, subject_id)
);

-- Migrate existing teacher-subject relationships
-- This copies from the old subjects.teacher_id FK
INSERT INTO teacher_subjects (teacher_id, subject_id)
  SELECT teacher_id, id FROM subjects
  ON CONFLICT (teacher_id, subject_id) DO NOTHING;

-- Verify migration
SELECT COUNT(*) as teacher_subject_count FROM teacher_subjects;

-- Create indexes
CREATE INDEX idx_teacher_subjects_teacher_id ON teacher_subjects(teacher_id);
CREATE INDEX idx_teacher_subjects_subject_id ON teacher_subjects(subject_id);
```

#### Step 6: Update Sessions Table

```sql
-- Rename column to match new schema
ALTER TABLE sessions 
  RENAME COLUMN teacher_id TO created_by_teacher_id;

-- Update the foreign key constraint (if exists)
ALTER TABLE sessions 
  DROP CONSTRAINT IF EXISTS fk_sessions_teacher;

ALTER TABLE sessions 
  ADD CONSTRAINT fk_sessions_created_by_teacher
    FOREIGN KEY (created_by_teacher_id) REFERENCES teachers(id)
    ON UPDATE CASCADE ON DELETE RESTRICT;

-- Create index
CREATE INDEX idx_sessions_created_by_teacher_id ON sessions(created_by_teacher_id);
```

#### Step 7: Verify Attendance Table

```sql
-- Check if attendance table has the required columns
-- (These should already exist, but verify)
-- The columns student_ip and subnet should already be present

-- If they don't exist, add them:
-- ALTER TABLE attendance ADD COLUMN IF NOT EXISTS student_ip INET;
-- ALTER TABLE attendance ADD COLUMN IF NOT EXISTS subnet VARCHAR(50);

-- Verify structure
\d attendance;
```

#### Step 8: Remove Old Columns from Teachers Table

```sql
-- Remove the old subject field if it exists
ALTER TABLE teachers 
  DROP COLUMN IF EXISTS subject;

-- Verify structure
\d teachers;
```

#### Step 9: Verify Referential Integrity

```sql
-- Check for orphaned records (should return no results)
SELECT s.id, s.roll_no FROM students s
  WHERE NOT EXISTS (SELECT 1 FROM branches WHERE id = s.branch_id)
     OR NOT EXISTS (SELECT 1 FROM years WHERE id = s.year_id);

SELECT su.id, su.name FROM subjects su
  WHERE NOT EXISTS (SELECT 1 FROM branches WHERE id = su.branch_id)
     OR NOT EXISTS (SELECT 1 FROM years WHERE id = su.year_id)
     OR NOT EXISTS (SELECT 1 FROM teacher_subjects WHERE subject_id = su.id);

-- Check sessions referential integrity
SELECT s.id FROM sessions s
  WHERE NOT EXISTS (SELECT 1 FROM subjects WHERE id = s.subject_id)
     OR NOT EXISTS (SELECT 1 FROM teachers WHERE id = s.created_by_teacher_id);
```

#### Step 10: Test the New Schema

```sql
-- Test: Get all students in CSE, Year 1
SELECT s.id, s.name, s.roll_no, b.name as branch, y.year_number
FROM students s
JOIN branches b ON s.branch_id = b.id
JOIN years y ON s.year_id = y.id
WHERE b.name = 'CSE' AND y.year_number = 1;

-- Test: Get all subjects for CSE, Year 2
SELECT su.id, su.name, b.name as branch, y.year_number
FROM subjects su
JOIN branches b ON su.branch_id = b.id
JOIN years y ON su.year_id = y.id
WHERE b.name = 'CSE' AND y.year_number = 2;

-- Test: Get all subjects taught by teacher ID 1
SELECT su.id, su.name, b.name as branch, y.year_number
FROM subjects su
JOIN branches b ON su.branch_id = b.id
JOIN years y ON su.year_id = y.id
JOIN teacher_subjects ts ON su.id = ts.subject_id
WHERE ts.teacher_id = 1;

-- Test: Get attendance for a session with branch/year info
SELECT 
  a.id, 
  s.name as student_name, 
  s.roll_no,
  b.name as branch,
  y.year_number,
  a.status,
  a.student_ip,
  a.subnet
FROM attendance a
JOIN sessions ss ON a.session_id = ss.id
JOIN students s ON a.student_id = s.id
JOIN branches b ON s.branch_id = b.id
JOIN years y ON s.year_id = y.id
LIMIT 10;
```

---

## Common Migration Scenarios

### Scenario 1: Assigning Students to Different Branches/Years

```sql
-- Update students to their correct branch/year based on roll_no pattern
-- Example: CSE001-050 → CSE, Year 1; CSE101-150 → CSE, Year 2

UPDATE students 
SET 
  branch_id = (SELECT id FROM branches WHERE name = 'CSE'),
  year_id = (SELECT id FROM years WHERE year_number = 1)
WHERE roll_no LIKE 'CSE%' AND CAST(SUBSTRING(roll_no, 4) AS INTEGER) < 100;

UPDATE students 
SET 
  branch_id = (SELECT id FROM branches WHERE name = 'CSE'),
  year_id = (SELECT id FROM years WHERE year_number = 2)
WHERE roll_no LIKE 'CSE%' AND CAST(SUBSTRING(roll_no, 4) AS INTEGER) >= 100 AND CAST(SUBSTRING(roll_no, 4) AS INTEGER) < 200;

-- Similar for IT, ECE, etc.
```

### Scenario 2: Bulk Update Subjects by Branch

```sql
-- Update all existing subjects to specific branch/year
UPDATE subjects 
SET 
  branch_id = (SELECT id FROM branches WHERE name = 'CSE'),
  year_id = (SELECT id FROM years WHERE year_number = 2)
WHERE name IN ('Data Structures', 'Database Management', 'Operating Systems');
```

### Scenario 3: Handling Duplicate Subject Names

If you have duplicate subject names across different branches/years:

```sql
-- Check for duplicates first
SELECT name, COUNT(*) FROM subjects GROUP BY name HAVING COUNT(*) > 1;

-- If duplicates exist, you'll need to rename some:
UPDATE subjects 
SET name = 'Data Structures (ECE)'
WHERE name = 'Data Structures' 
  AND branch_id = (SELECT id FROM branches WHERE name = 'ECE');
```

---

## Rollback Procedure (If Needed)

If migration fails, restore from backup:

```bash
# Stop application
systemctl stop at-app-server

# Restore database
psql attendance_db < backup_YYYYMMDD_HHMMSS.sql

# Start application
systemctl start at-app-server
```

---

## Verification Checklist

- [ ] Backup created and stored safely
- [ ] All 5 new/updated tables created
- [ ] All 9 indexes created
- [ ] Foreign key constraints properly set
- [ ] No NULL values in required columns
- [ ] No orphaned records detected
- [ ] Test queries execute successfully
- [ ] Application starts without errors
- [ ] Student registration works with branch/year
- [ ] Teacher can view assigned subjects
- [ ] Student attendance marking validates eligibility

---

## Performance Considerations

After migration:

```sql
-- Analyze tables for query planner optimization
ANALYZE students;
ANALYZE subjects;
ANALYZE teacher_subjects;
ANALYZE sessions;
ANALYZE attendance;

-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

---

## Troubleshooting

### Error: Foreign key constraint violation

**Cause:** Orphaned records referencing non-existent branches/years

**Solution:**
```sql
-- Find problematic records
SELECT s.id, s.roll_no, s.branch_id FROM students s
WHERE s.branch_id NOT IN (SELECT id FROM branches);

-- Either delete or update them
DELETE FROM students WHERE branch_id IS NULL OR year_id IS NULL;
```

### Error: Duplicate key value violates unique constraint

**Cause:** Multiple subjects with same name in same branch/year

**Solution:**
```sql
-- Rename duplicates
UPDATE subjects 
SET name = name || ' (Alt)'
WHERE id IN (
  SELECT id FROM subjects 
  WHERE (branch_id, year_id, name) IN (
    SELECT branch_id, year_id, name FROM subjects 
    GROUP BY branch_id, year_id, name HAVING COUNT(*) > 1
  )
  LIMIT 1
);
```

---

## Post-Migration

1. **Update Client Registration Form**
   - Add branch dropdown (calls GET /api/auth/branches)
   - Add year dropdown (calls GET /api/auth/years)

2. **Update Teacher Dashboard**
   - Implement subject selector instead of text input
   - Call GET /api/teachers/subjects to list assigned subjects

3. **Test End-to-End**
   - Register new student with branch/year
   - Create session for subject
   - Mark attendance and verify eligibility check

4. **Monitor Logs**
   ```bash
   tail -f /var/log/at-app-server.log
   ```

---

## Support

For migration issues:
1. Check the SQL error message carefully
2. Verify foreign key constraints with `\d tablename`
3. Check data consistency with provided test queries
4. Review database logs: `SELECT * FROM pg_stat_statements;`

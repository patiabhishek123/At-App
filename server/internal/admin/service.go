package admin

import (
	"context"
	"database/sql"
	"encoding/csv"
	"errors"
	"fmt"
	"io"

	"atapp/db"
	"golang.org/x/crypto/bcrypt"
)

// Service provides administrative features for managing college tenants.
type Service struct {
	dbConn *sql.DB
}

// NewService creates a new Admin Service instance.
func NewService(dbConn *sql.DB) *Service {
	return &Service{dbConn: dbConn}
}

// CreateDepartment creates a department inside the given college tenant context.
func (s *Service) CreateDepartment(ctx context.Context, collegeID, name string) (string, error) {
	tx, err := s.dbConn.BeginTx(ctx, nil)
	if err != nil {
		return "", err
	}
	defer tx.Rollback()

	if err := db.WithTenant(tx, collegeID); err != nil {
		return "", err
	}

	var id string
	err = tx.QueryRowContext(ctx, "INSERT INTO departments (college_id, name) VALUES ($1, $2) RETURNING id", collegeID, name).Scan(&id)
	if err != nil {
		return "", err
	}

	return id, tx.Commit()
}

// CreateCourse creates a course inside the given college and department context.
func (s *Service) CreateCourse(ctx context.Context, collegeID, departmentID, name, code string, threshold *float64) (string, error) {
	tx, err := s.dbConn.BeginTx(ctx, nil)
	if err != nil {
		return "", err
	}
	defer tx.Rollback()

	if err := db.WithTenant(tx, collegeID); err != nil {
		return "", err
	}

	var id string
	err = tx.QueryRowContext(ctx, "INSERT INTO courses (college_id, department_id, name, code, attendance_threshold_pct) VALUES ($1, $2, $3, $4, $5) RETURNING id",
		collegeID, departmentID, name, code, threshold).Scan(&id)
	if err != nil {
		return "", err
	}

	return id, tx.Commit()
}

// CreateSection creates a class section instance with classroom geofence/BSSID verification settings.
func (s *Service) CreateSection(ctx context.Context, collegeID, courseID, term, teacherID string, bssid *string, lat, lng, radius *float64) (string, error) {
	tx, err := s.dbConn.BeginTx(ctx, nil)
	if err != nil {
		return "", err
	}
	defer tx.Rollback()

	if err := db.WithTenant(tx, collegeID); err != nil {
		return "", err
	}

	var id string
	query := `
		INSERT INTO sections (
			college_id, course_id, term, teacher_id, 
			classroom_bssid, classroom_geofence_lat, classroom_geofence_lng, classroom_geofence_radius_m
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
		RETURNING id
	`
	err = tx.QueryRowContext(ctx, query, collegeID, courseID, term, teacherID, bssid, lat, lng, radius).Scan(&id)
	if err != nil {
		return "", err
	}

	return id, tx.Commit()
}

// BulkImportUsersCSV parses a CSV list of user credentials and creates user records.
// CSV format: role,name,email,password
func (s *Service) BulkImportUsersCSV(ctx context.Context, collegeID string, r io.Reader) (int, error) {
	reader := csv.NewReader(r)

	header, err := reader.Read()
	if err != nil {
		return 0, err
	}

	// Support optional header detection
	var rows [][]string
	if header[0] == "student" || header[0] == "teacher" || header[0] == "admin" {
		rows = append(rows, header)
	}

	for {
		record, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return 0, err
		}
		rows = append(rows, record)
	}

	tx, err := s.dbConn.BeginTx(ctx, nil)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()

	if err := db.WithTenant(tx, collegeID); err != nil {
		return 0, err
	}

	count := 0
	for _, row := range rows {
		if len(row) < 4 {
			continue // Skip malformed rows
		}
		role, name, email, password := row[0], row[1], row[2], row[3]

		// Hash password
		hashedBytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		if err != nil {
			return count, fmt.Errorf("failed to hash password for user %s: %w", email, err)
		}
		hash := string(hashedBytes)

		_, err = tx.ExecContext(ctx, `
			INSERT INTO users (college_id, role, name, email, password_hash)
			VALUES ($1, $2, $3, $4, $5)
			ON CONFLICT (email) DO NOTHING
		`, collegeID, role, name, email, hash)
		if err != nil {
			return count, fmt.Errorf("failed to insert user %s: %w", email, err)
		}
		count++
	}

	return count, tx.Commit()
}

// BulkImportEnrollmentsCSV parses a CSV of student enrollments and registers students.
// CSV format: student_email,section_id
func (s *Service) BulkImportEnrollmentsCSV(ctx context.Context, collegeID string, r io.Reader) (int, error) {
	reader := csv.NewReader(r)

	// Read and skip header
	_, err := reader.Read()
	if err != nil {
		return 0, err
	}

	tx, err := s.dbConn.BeginTx(ctx, nil)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()

	if err := db.WithTenant(tx, collegeID); err != nil {
		return 0, err
	}

	count := 0
	for {
		record, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return count, err
		}
		if len(record) < 2 {
			continue
		}
		studentEmail, sectionID := record[0], record[1]

		// Resolve student ID within tenant
		var studentID string
		err = tx.QueryRowContext(ctx, "SELECT id FROM users WHERE email = $1 AND role = 'student'", studentEmail).Scan(&studentID)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				continue // Skip if student not found under this tenant
			}
			return count, fmt.Errorf("failed to resolve student email %s: %w", studentEmail, err)
		}

		_, err = tx.ExecContext(ctx, `
			INSERT INTO enrollments (college_id, student_id, section_id)
			VALUES ($1, $2, $3)
			ON CONFLICT (student_id, section_id) DO NOTHING
		`, collegeID, studentID, sectionID)
		if err != nil {
			return count, fmt.Errorf("failed to enroll student %s into section %s: %w", studentEmail, sectionID, err)
		}
		count++
	}

	return count, tx.Commit()
}

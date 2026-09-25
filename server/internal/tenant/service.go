package tenant

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"atapp/db"
	"golang.org/x/crypto/bcrypt"
)

// Service provisions new college tenants. It is deliberately separate from
// internal/admin, since admin.Service operates within an already-authenticated
// tenant's context, whereas onboarding a college has no tenant context yet.
type Service struct {
	dbConn *sql.DB
}

// NewService creates a new tenant onboarding Service instance.
func NewService(dbConn *sql.DB) *Service {
	return &Service{dbConn: dbConn}
}

// College is the result of a successful onboarding call.
type College struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	AdminUserID string `json:"adminUserId"`
}

// CreateCollege provisions a new college tenant along with its first admin
// user, atomically. The college ID is generated client-side so the RLS tenant
// context can be set before either row is inserted.
func (s *Service) CreateCollege(ctx context.Context, name, adminName, adminEmail, adminPassword string) (College, error) {
	if name == "" || adminName == "" || adminEmail == "" || adminPassword == "" {
		return College{}, errors.New("name, adminName, adminEmail, and adminPassword are required")
	}

	collegeID, err := newUUIDv4()
	if err != nil {
		return College{}, err
	}

	hashedBytes, err := bcrypt.GenerateFromPassword([]byte(adminPassword), bcrypt.DefaultCost)
	if err != nil {
		return College{}, fmt.Errorf("failed to hash password: %w", err)
	}

	tx, err := s.dbConn.BeginTx(ctx, nil)
	if err != nil {
		return College{}, err
	}
	defer tx.Rollback()

	if err := db.WithTenant(tx, collegeID); err != nil {
		return College{}, err
	}

	if _, err := tx.ExecContext(ctx, "INSERT INTO colleges (id, name) VALUES ($1, $2)", collegeID, name); err != nil {
		return College{}, fmt.Errorf("failed to create college: %w", err)
	}

	var adminID string
	err = tx.QueryRowContext(ctx, `
		INSERT INTO users (college_id, role, name, email, password_hash)
		VALUES ($1, 'admin', $2, $3, $4)
		RETURNING id
	`, collegeID, adminName, adminEmail, string(hashedBytes)).Scan(&adminID)
	if err != nil {
		return College{}, fmt.Errorf("failed to create initial admin user: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return College{}, fmt.Errorf("failed to commit college onboarding: %w", err)
	}

	return College{ID: collegeID, Name: name, AdminUserID: adminID}, nil
}

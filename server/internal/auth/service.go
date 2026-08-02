package auth

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"atapp/config"
	"atapp/db"
	"golang.org/x/crypto/bcrypt"
)

var (
	// ErrInvalidCredentials represents login failure.
	ErrInvalidCredentials = errors.New("invalid email or password")
)

// Service manages authentication and signup business logic.
type Service struct {
	dbConn *sql.DB
	cfg    config.Config
}

// NewService instantiates a new authentication service.
func NewService(dbConn *sql.DB, cfg config.Config) *Service {
	return &Service{
		dbConn: dbConn,
		cfg:    cfg,
	}
}

// UserDTO defines the user info payload returned to clients upon auth success.
type UserDTO struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Email     string `json:"email"`
	Role      string `json:"role"`
	CollegeID string `json:"collegeId"`
}

// Login validates user credentials and issues a JWT token pair.
func (s *Service) Login(ctx context.Context, email, password string) (TokenPair, UserDTO, error) {
	var id, collegeID, role, name, hash string

	// Query via SECURITY DEFINER database function to bypass RLS before tenant is known.
	err := s.dbConn.QueryRowContext(ctx, "SELECT id, college_id, role, name, password_hash FROM get_user_for_auth($1)", email).
		Scan(&id, &collegeID, &role, &name, &hash)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return TokenPair{}, UserDTO{}, ErrInvalidCredentials
		}
		return TokenPair{}, UserDTO{}, fmt.Errorf("failed to lookup user: %w", err)
	}

	// Compare password hash
	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)); err != nil {
		return TokenPair{}, UserDTO{}, ErrInvalidCredentials
	}

	// Generate short-lived Access Token and long-lived Refresh Token
	tokens, err := GenerateTokenPair(id, role, collegeID, []byte(s.cfg.JWTSecret))
	if err != nil {
		return TokenPair{}, UserDTO{}, fmt.Errorf("failed to generate token pair: %w", err)
	}

	return tokens, UserDTO{
		ID:        id,
		Name:      name,
		Email:     email,
		Role:      role,
		CollegeID: collegeID,
	}, nil
}

// SignUp inserts a new user under the specified tenant, enforcing RLS during creation.
func (s *Service) SignUp(ctx context.Context, collegeID, role, name, email, password string) (UserDTO, error) {
	if role != "student" && role != "teacher" && role != "admin" {
		return UserDTO{}, errors.New("invalid role: must be student, teacher, or admin")
	}

	// Hash password
	hashedBytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return UserDTO{}, fmt.Errorf("failed to hash password: %w", err)
	}
	hash := string(hashedBytes)

	// Since RLS is active on the users table, we must set the transaction tenant context before writing.
	tx, err := s.dbConn.BeginTx(ctx, nil)
	if err != nil {
		return UserDTO{}, fmt.Errorf("failed to start signup transaction: %w", err)
	}
	defer tx.Rollback()

	if err := db.WithTenant(tx, collegeID); err != nil {
		return UserDTO{}, fmt.Errorf("failed to bind tenant context: %w", err)
	}

	var id string
	query := `
		INSERT INTO users (college_id, role, name, email, password_hash)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id
	`
	err = tx.QueryRowContext(ctx, query, collegeID, role, name, email, hash).Scan(&id)
	if err != nil {
		return UserDTO{}, fmt.Errorf("failed to insert user: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return UserDTO{}, fmt.Errorf("failed to commit signup: %w", err)
	}

	return UserDTO{
		ID:        id,
		Name:      name,
		Email:     email,
		Role:      role,
		CollegeID: collegeID,
	}, nil
}

// Refresh generates a new token pair from a valid, unexpired refresh token.
func (s *Service) Refresh(ctx context.Context, refreshTokenStr string) (TokenPair, error) {
	claims, err := ValidateToken(refreshTokenStr, []byte(s.cfg.JWTSecret))
	if err != nil {
		return TokenPair{}, fmt.Errorf("invalid refresh token: %w", err)
	}

	tokens, err := GenerateTokenPair(claims.UserID, claims.Role, claims.CollegeID, []byte(s.cfg.JWTSecret))
	if err != nil {
		return TokenPair{}, fmt.Errorf("failed to issue fresh token pair: %w", err)
	}

	return tokens, nil
}

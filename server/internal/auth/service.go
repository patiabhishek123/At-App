package auth

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log"

	"atapp/config"
	"atapp/db"
	"golang.org/x/crypto/bcrypt"
)

var (
	// ErrInvalidCredentials represents login failure.
	ErrInvalidCredentials = errors.New("invalid email or password")
	// ErrUserNotFound is returned when no user matches the given email.
	ErrUserNotFound = errors.New("user not found")
)

// EmailSender delivers transactional emails (e.g. password resets). Defined
// locally (rather than importing internal/notification's identical
// interface) to avoid an import cycle, since internal/notification's HTTP
// handler depends on internal/gateway, which depends on this package. Any
// notification.EmailSender implementation satisfies this interface
// structurally.
type EmailSender interface {
	SendEmail(ctx context.Context, to, subject, body string) error
}

// consoleEmailSender logs emails instead of sending them; used until a real
// sender is wired in via SetEmailSender.
type consoleEmailSender struct{}

func (consoleEmailSender) SendEmail(ctx context.Context, to, subject, body string) error {
	log.Printf("[EMAIL] to=%s subject=%q body=%q\n", to, subject, body)
	return nil
}

// Service manages authentication and signup business logic.
type Service struct {
	dbConn      *sql.DB
	cfg         config.Config
	emailSender EmailSender
}

// NewService instantiates a new authentication service. Emails (e.g.
// password resets) are logged rather than sent until SetEmailSender is
// called with a real sender.
func NewService(dbConn *sql.DB, cfg config.Config) *Service {
	return &Service{
		dbConn:      dbConn,
		cfg:         cfg,
		emailSender: consoleEmailSender{},
	}
}

// SetEmailSender overrides the email delivery mechanism (e.g. with a real
// SMTP sender), used for outbound account emails like password resets.
func (s *Service) SetEmailSender(sender EmailSender) {
	s.emailSender = sender
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

// RequestPasswordReset issues a short-lived reset token for the given email
// if an account exists, and delivers it via the configured EmailSender (logs
// it if none is configured). The handler layer must still respond
// identically whether or not the account exists, to avoid leaking which
// emails are registered.
func (s *Service) RequestPasswordReset(ctx context.Context, email string) error {
	var id, collegeID, role, name, hash string
	err := s.dbConn.QueryRowContext(ctx, "SELECT id, college_id, role, name, password_hash FROM get_user_for_auth($1)", email).
		Scan(&id, &collegeID, &role, &name, &hash)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrUserNotFound
		}
		return fmt.Errorf("failed to lookup user: %w", err)
	}

	token, err := GeneratePasswordResetToken(id, role, collegeID, []byte(s.cfg.JWTSecret))
	if err != nil {
		return fmt.Errorf("failed to generate password reset token: %w", err)
	}

	subject := "Reset your AtApp password"
	body := fmt.Sprintf("Hi %s,\n\nUse this token to reset your password (valid for 30 minutes):\n\n%s\n\nIf you didn't request this, you can ignore this email.", name, token)
	if err := s.emailSender.SendEmail(ctx, email, subject, body); err != nil {
		return fmt.Errorf("failed to send password reset email: %w", err)
	}

	return nil
}

// ConfirmPasswordReset validates a reset token and sets the account's new password.
func (s *Service) ConfirmPasswordReset(ctx context.Context, tokenStr, newPassword string) error {
	claims, err := ValidatePasswordResetToken(tokenStr, []byte(s.cfg.JWTSecret))
	if err != nil {
		return fmt.Errorf("invalid or expired reset token: %w", err)
	}

	hashedBytes, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	tx, err := s.dbConn.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if err := db.WithTenant(tx, claims.CollegeID); err != nil {
		return err
	}

	res, err := tx.ExecContext(ctx, "UPDATE users SET password_hash = $1 WHERE id = $2", string(hashedBytes), claims.UserID)
	if err != nil {
		return fmt.Errorf("failed to update password: %w", err)
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrUserNotFound
	}

	return tx.Commit()
}

// Refresh generates a new token pair from a valid, unexpired refresh token.
func (s *Service) Refresh(ctx context.Context, refreshTokenStr string) (TokenPair, error) {
	claims, err := ValidateRefreshToken(refreshTokenStr, []byte(s.cfg.JWTSecret))
	if err != nil {
		return TokenPair{}, fmt.Errorf("invalid refresh token: %w", err)
	}

	tokens, err := GenerateTokenPair(claims.UserID, claims.Role, claims.CollegeID, []byte(s.cfg.JWTSecret))
	if err != nil {
		return TokenPair{}, fmt.Errorf("failed to issue fresh token pair: %w", err)
	}

	return tokens, nil
}

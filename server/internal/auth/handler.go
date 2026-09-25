package auth

import (
	"encoding/json"
	"errors"
	"net/http"

	"atapp/internal/utils"
	"github.com/go-chi/chi/v5"
)

// Handler exposes authentication HTTP endpoints.
type Handler struct {
	service *Service
}

// NewHandler initializes a new Auth Handler instance.
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// RegisterPublicRoutes binds the authentication paths that do not require a JWT.
// rateLimit, if non-nil, is applied to guard against brute-force attempts.
func (h *Handler) RegisterPublicRoutes(r chi.Router, rateLimit func(http.Handler) http.Handler) {
	register := r.Post
	if rateLimit != nil {
		register = r.With(rateLimit).Post
	}
	register("/auth/login", h.handleLogin)
	register("/auth/refresh", h.handleRefresh)
	register("/auth/password-reset/request", h.handlePasswordResetRequest)
	register("/auth/password-reset/confirm", h.handlePasswordResetConfirm)
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type loginResponse struct {
	AccessToken  string  `json:"accessToken"`
	RefreshToken string  `json:"refreshToken"`
	User         UserDTO `json:"user"`
}

func (h *Handler) handleLogin(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Email == "" || req.Password == "" {
		utils.WriteError(w, http.StatusBadRequest, "email and password are required")
		return
	}

	tokens, user, err := h.service.Login(r.Context(), req.Email, req.Password)
	if err != nil {
		if errors.Is(err, ErrInvalidCredentials) {
			utils.WriteError(w, http.StatusUnauthorized, "invalid email or password")
			return
		}
		utils.WriteServiceError(w, err)
		return
	}

	utils.WriteJSON(w, http.StatusOK, loginResponse{
		AccessToken:  tokens.AccessToken,
		RefreshToken: tokens.RefreshToken,
		User:         user,
	})
}

type refreshRequest struct {
	RefreshToken string `json:"refreshToken"`
}

func (h *Handler) handleRefresh(w http.ResponseWriter, r *http.Request) {
	var req refreshRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.RefreshToken == "" {
		utils.WriteError(w, http.StatusBadRequest, "refreshToken is required")
		return
	}

	tokens, err := h.service.Refresh(r.Context(), req.RefreshToken)
	if err != nil {
		utils.WriteError(w, http.StatusUnauthorized, "invalid or expired refresh token")
		return
	}

	utils.WriteJSON(w, http.StatusOK, tokens)
}

type passwordResetRequestRequest struct {
	Email string `json:"email"`
}

func (h *Handler) handlePasswordResetRequest(w http.ResponseWriter, r *http.Request) {
	var req passwordResetRequestRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Email == "" {
		utils.WriteError(w, http.StatusBadRequest, "email is required")
		return
	}

	if err := h.service.RequestPasswordReset(r.Context(), req.Email); err != nil && !errors.Is(err, ErrUserNotFound) {
		utils.WriteError(w, http.StatusInternalServerError, "failed to process password reset request")
		return
	}

	// Always respond the same way, whether or not the account exists, to
	// avoid leaking which emails are registered.
	utils.WriteJSON(w, http.StatusOK, map[string]string{
		"message": "if an account exists for that email, a password reset link has been sent",
	})
}

type passwordResetConfirmRequest struct {
	Token       string `json:"token"`
	NewPassword string `json:"newPassword"`
}

func (h *Handler) handlePasswordResetConfirm(w http.ResponseWriter, r *http.Request) {
	var req passwordResetConfirmRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Token == "" || req.NewPassword == "" {
		utils.WriteError(w, http.StatusBadRequest, "token and newPassword are required")
		return
	}
	if len(req.NewPassword) < 8 {
		utils.WriteError(w, http.StatusBadRequest, "newPassword must be at least 8 characters")
		return
	}

	if err := h.service.ConfirmPasswordReset(r.Context(), req.Token, req.NewPassword); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "invalid or expired reset token")
		return
	}

	utils.WriteJSON(w, http.StatusOK, map[string]string{"message": "password updated successfully"})
}

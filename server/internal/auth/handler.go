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
func (h *Handler) RegisterPublicRoutes(r chi.Router) {
	r.Post("/auth/login", h.handleLogin)
	r.Post("/auth/refresh", h.handleRefresh)
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
		utils.WriteError(w, http.StatusInternalServerError, err.Error())
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

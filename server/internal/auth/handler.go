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

// RegisterRoutes binds authentication paths to the router.
func (h *Handler) RegisterRoutes(r chi.Router) {
	r.Post("/auth/login", h.handleLogin)
	r.Post("/auth/refresh", h.handleRefresh)
	r.Post("/auth/signup", h.handleSignUp)
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

type signUpRequest struct {
	CollegeID string `json:"collegeId"`
	Role      string `json:"role"`
	Name      string `json:"name"`
	Email     string `json:"email"`
	Password  string `json:"password"`
}

func (h *Handler) handleSignUp(w http.ResponseWriter, r *http.Request) {
	var req signUpRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.CollegeID == "" || req.Role == "" || req.Name == "" || req.Email == "" || req.Password == "" {
		utils.WriteError(w, http.StatusBadRequest, "collegeId, role, name, email, and password are required")
		return
	}

	user, err := h.service.SignUp(r.Context(), req.CollegeID, req.Role, req.Name, req.Email, req.Password)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	utils.WriteJSON(w, http.StatusCreated, user)
}

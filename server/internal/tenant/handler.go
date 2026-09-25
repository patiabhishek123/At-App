package tenant

import (
	"encoding/json"
	"net/http"

	"atapp/internal/utils"
	"github.com/go-chi/chi/v5"
)

// Handler exposes platform-level tenant (college) onboarding endpoints.
// These routes sit outside normal tenant/JWT auth (there is no tenant yet)
// and must be gated by the platform admin key middleware instead.
type Handler struct {
	service *Service
}

// NewHandler creates a new tenant Handler instance.
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// RegisterRoutes binds the platform onboarding paths. Callers must wrap the
// router with a platform-key auth middleware before calling this.
func (h *Handler) RegisterRoutes(r chi.Router) {
	r.Post("/platform/colleges", h.handleCreateCollege)
}

type createCollegeRequest struct {
	Name          string `json:"name"`
	AdminName     string `json:"adminName"`
	AdminEmail    string `json:"adminEmail"`
	AdminPassword string `json:"adminPassword"`
}

func (h *Handler) handleCreateCollege(w http.ResponseWriter, r *http.Request) {
	var req createCollegeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Name == "" || req.AdminName == "" || req.AdminEmail == "" || req.AdminPassword == "" {
		utils.WriteError(w, http.StatusBadRequest, "name, adminName, adminEmail, and adminPassword are required")
		return
	}
	if len(req.AdminPassword) < 8 {
		utils.WriteError(w, http.StatusBadRequest, "adminPassword must be at least 8 characters")
		return
	}

	college, err := h.service.CreateCollege(r.Context(), req.Name, req.AdminName, req.AdminEmail, req.AdminPassword)
	if err != nil {
		utils.WriteServiceError(w, err)
		return
	}

	utils.WriteJSON(w, http.StatusCreated, college)
}

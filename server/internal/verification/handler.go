package verification

import (
	"encoding/json"
	"net/http"

	"atapp/internal/gateway"
	"atapp/internal/utils"
	"github.com/go-chi/chi/v5"
)

// Handler maps check-in requests to the Verification service.
type Handler struct {
	service *Service
}

// NewHandler initializes a new verification Handler.
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// RegisterRoutes registers the check-in endpoint under student role checks.
func (h *Handler) RegisterRoutes(r chi.Router) {
	r.Group(func(r chi.Router) {
		r.Use(gateway.RequireRole("student"))

		r.Post("/student/checkin", h.handleCheckin)
	})
}

type gpsCoords struct {
	Lat float64 `json:"lat"`
	Lng float64 `json:"lng"`
}

type checkinRequest struct {
	Code  string     `json:"code"`
	Bssid string     `json:"bssid"`
	Gps   *gpsCoords `json:"gps"`
}

func (h *Handler) handleCheckin(w http.ResponseWriter, r *http.Request) {
	collegeID := gateway.GetCollegeID(r.Context())
	studentID := gateway.GetUserID(r.Context())
	if collegeID == "" || studentID == "" {
		utils.WriteError(w, http.StatusUnauthorized, "unauthorized: missing student context information")
		return
	}

	var req checkinRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Code == "" || req.Gps == nil {
		utils.WriteError(w, http.StatusBadRequest, "code and gps coordinates are required")
		return
	}

	res, err := h.service.SubmitCheckin(r.Context(), collegeID, studentID, req.Code, req.Bssid, req.Gps.Lat, req.Gps.Lng)
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	utils.WriteJSON(w, http.StatusOK, res)
}

package session

import (
	"encoding/json"
	"net/http"

	"atapp/internal/gateway"
	"atapp/internal/utils"
	"github.com/go-chi/chi/v5"
)

// Handler maps HTTP requests to the Session service.
type Handler struct {
	service *Service
}

// NewHandler initializes a new session Handler instance.
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// RegisterRoutes hooks endpoints for class sessions onto the router under teacher role checks.
func (h *Handler) RegisterRoutes(r chi.Router) {
	r.Group(func(r chi.Router) {
		r.Use(gateway.RequireRole("teacher"))

		r.Post("/teacher/sessions", h.handleStartSession)
		r.Post("/teacher/sessions/{sessionId}/end", h.handleEndSession)
		r.Get("/teacher/sessions/{sessionId}/code", h.handleGetCode)
	})
}

type geofenceOverride struct {
	Lat     float64 `json:"lat"`
	Lng     float64 `json:"lng"`
	RadiusM float64 `json:"radiusM"`
}

type startSessionRequest struct {
	SectionID        string            `json:"sectionId"`
	GeofenceOverride *geofenceOverride `json:"geofenceOverride,omitempty"`
}

type startSessionResponse struct {
	SessionID            string `json:"sessionId"`
	CurrentCode          string `json:"currentCode"`
	CodeExpiresInSeconds int    `json:"codeExpiresInSeconds"`
}

func (h *Handler) handleStartSession(w http.ResponseWriter, r *http.Request) {
	collegeID := gateway.GetCollegeID(r.Context())
	teacherID := gateway.GetUserID(r.Context())
	if collegeID == "" || teacherID == "" {
		utils.WriteError(w, http.StatusUnauthorized, "unauthorized: missing context info")
		return
	}

	var req startSessionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.SectionID == "" {
		utils.WriteError(w, http.StatusBadRequest, "sectionId is required")
		return
	}

	var lat, lng, radius *float64
	if req.GeofenceOverride != nil {
		lat = &req.GeofenceOverride.Lat
		lng = &req.GeofenceOverride.Lng
		radius = &req.GeofenceOverride.RadiusM
	}

	res, err := h.service.StartSession(r.Context(), collegeID, teacherID, req.SectionID, lat, lng, radius)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	utils.WriteJSON(w, http.StatusCreated, startSessionResponse{
		SessionID:            res.SessionID,
		CurrentCode:          res.CurrentCode,
		CodeExpiresInSeconds: res.CodeExpiresInSeconds,
	})
}

func (h *Handler) handleEndSession(w http.ResponseWriter, r *http.Request) {
	collegeID := gateway.GetCollegeID(r.Context())
	if collegeID == "" {
		utils.WriteError(w, http.StatusUnauthorized, "unauthorized: missing college context")
		return
	}

	sessionID := chi.URLParam(r, "sessionId")
	if sessionID == "" {
		utils.WriteError(w, http.StatusBadRequest, "sessionId path parameter is required")
		return
	}

	summary, err := h.service.EndSession(r.Context(), collegeID, sessionID)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	utils.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"sessionId": sessionID,
		"summary":   summary,
	})
}

func (h *Handler) handleGetCode(w http.ResponseWriter, r *http.Request) {
	collegeID := gateway.GetCollegeID(r.Context())
	if collegeID == "" {
		utils.WriteError(w, http.StatusUnauthorized, "unauthorized: missing college context")
		return
	}

	sessionID := chi.URLParam(r, "sessionId")
	if sessionID == "" {
		utils.WriteError(w, http.StatusBadRequest, "sessionId path parameter is required")
		return
	}

	code, expires, err := h.service.GetOrRotateCode(r.Context(), collegeID, sessionID)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	utils.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"currentCode":          code,
		"codeExpiresInSeconds": expires,
	})
}

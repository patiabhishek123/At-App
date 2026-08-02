package attendance

import (
	"encoding/json"
	"net/http"

	"atapp/internal/gateway"
	"atapp/internal/utils"
	"github.com/go-chi/chi/v5"
)

// Handler maps HTTP requests to the Attendance service.
type Handler struct {
	service *Service
}

// NewHandler initializes a new attendance Handler.
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// RegisterRoutes binds endpoints for manual overrides, teacher operations, and student reporting onto the router.
func (h *Handler) RegisterRoutes(r chi.Router) {
	r.Group(func(r chi.Router) {
		r.Use(gateway.RequireRole("teacher"))
		r.Post("/teacher/attendance/overrides", h.handleOverride)
		r.Get("/teacher/sections", h.handleGetTeacherSections)
		r.Get("/teacher/sessions/{sessionId}/roster", h.handleGetSessionRoster)
		r.Get("/teacher/sections/{sectionId}/dashboard", h.handleGetSectionDashboard)
		r.Get("/teacher/sections/{sectionId}/sessions", h.handleGetSectionHistory)
	})

	r.Group(func(r chi.Router) {
		r.Use(gateway.RequireRole("student"))
		r.Get("/student/courses", h.handleGetCourses)
	})
}

type overrideRequest struct {
	SessionID string `json:"sessionId"`
	StudentID string `json:"studentId"`
	Status    string `json:"status"`
	Reason    string `json:"reason"`
}

func (h *Handler) handleOverride(w http.ResponseWriter, r *http.Request) {
	collegeID := gateway.GetCollegeID(r.Context())
	teacherID := gateway.GetUserID(r.Context())
	if collegeID == "" || teacherID == "" {
		utils.WriteError(w, http.StatusUnauthorized, "unauthorized: missing token context information")
		return
	}

	var req overrideRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.SessionID == "" || req.StudentID == "" || req.Status == "" || req.Reason == "" {
		utils.WriteError(w, http.StatusBadRequest, "sessionId, studentId, status, and reason are required")
		return
	}

	res, err := h.service.SubmitOverride(r.Context(), collegeID, teacherID, req.SessionID, req.StudentID, req.Status, req.Reason)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	utils.WriteJSON(w, http.StatusOK, res)
}

func (h *Handler) handleGetCourses(w http.ResponseWriter, r *http.Request) {
	collegeID := gateway.GetCollegeID(r.Context())
	studentID := gateway.GetUserID(r.Context())
	if collegeID == "" || studentID == "" {
		utils.WriteError(w, http.StatusUnauthorized, "unauthorized: missing student context information")
		return
	}

	list, err := h.service.GetStudentCourses(r.Context(), collegeID, studentID)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	utils.WriteJSON(w, http.StatusOK, list)
}

func (h *Handler) handleGetTeacherSections(w http.ResponseWriter, r *http.Request) {
	collegeID := gateway.GetCollegeID(r.Context())
	teacherID := gateway.GetUserID(r.Context())
	if collegeID == "" || teacherID == "" {
		utils.WriteError(w, http.StatusUnauthorized, "unauthorized: missing token context information")
		return
	}

	list, err := h.service.GetTeacherSections(r.Context(), collegeID, teacherID)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	utils.WriteJSON(w, http.StatusOK, list)
}

func (h *Handler) handleGetSessionRoster(w http.ResponseWriter, r *http.Request) {
	collegeID := gateway.GetCollegeID(r.Context())
	teacherID := gateway.GetUserID(r.Context())
	sessionID := chi.URLParam(r, "sessionId")
	if collegeID == "" || teacherID == "" {
		utils.WriteError(w, http.StatusUnauthorized, "unauthorized: missing token context information")
		return
	}
	if sessionID == "" {
		utils.WriteError(w, http.StatusBadRequest, "sessionId path parameter is required")
		return
	}

	list, err := h.service.GetSessionRoster(r.Context(), collegeID, sessionID, teacherID)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	utils.WriteJSON(w, http.StatusOK, list)
}

func (h *Handler) handleGetSectionDashboard(w http.ResponseWriter, r *http.Request) {
	collegeID := gateway.GetCollegeID(r.Context())
	teacherID := gateway.GetUserID(r.Context())
	sectionID := chi.URLParam(r, "sectionId")
	if collegeID == "" || teacherID == "" {
		utils.WriteError(w, http.StatusUnauthorized, "unauthorized: missing token context information")
		return
	}
	if sectionID == "" {
		utils.WriteError(w, http.StatusBadRequest, "sectionId path parameter is required")
		return
	}

	list, err := h.service.GetSectionDashboard(r.Context(), collegeID, sectionID, teacherID)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	utils.WriteJSON(w, http.StatusOK, list)
}

func (h *Handler) handleGetSectionHistory(w http.ResponseWriter, r *http.Request) {
	collegeID := gateway.GetCollegeID(r.Context())
	teacherID := gateway.GetUserID(r.Context())
	sectionID := chi.URLParam(r, "sectionId")
	if collegeID == "" || teacherID == "" {
		utils.WriteError(w, http.StatusUnauthorized, "unauthorized: missing token context information")
		return
	}
	if sectionID == "" {
		utils.WriteError(w, http.StatusBadRequest, "sectionId path parameter is required")
		return
	}

	list, err := h.service.GetSectionHistory(r.Context(), collegeID, sectionID, teacherID)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	utils.WriteJSON(w, http.StatusOK, list)
}

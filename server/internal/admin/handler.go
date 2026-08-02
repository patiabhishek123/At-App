package admin

import (
	"encoding/json"
	"net/http"

	"atapp/internal/gateway"
	"atapp/internal/utils"
	"github.com/go-chi/chi/v5"
)

// Handler exposes admin-only database setup and bulk data loading endpoints.
type Handler struct {
	service *Service
}

// NewHandler creates a new Admin Handler instance.
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// RegisterRoutes registers HTTP routes with the router under admin role authorization checks.
func (h *Handler) RegisterRoutes(r chi.Router) {
	r.Group(func(r chi.Router) {
		r.Use(gateway.RequireRole("admin"))

		r.Post("/admin/departments", h.handleCreateDepartment)
		r.Post("/admin/courses", h.handleCreateCourse)
		r.Post("/admin/sections", h.handleCreateSection)
		r.Post("/admin/import/users", h.handleImportUsers)
		r.Post("/admin/import/enrollments", h.handleImportEnrollments)
	})
}

type createDeptRequest struct {
	Name string `json:"name"`
}

func (h *Handler) handleCreateDepartment(w http.ResponseWriter, r *http.Request) {
	collegeID := gateway.GetCollegeID(r.Context())
	if collegeID == "" {
		utils.WriteError(w, http.StatusUnauthorized, "missing college tenant context")
		return
	}

	var req createDeptRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Name == "" {
		utils.WriteError(w, http.StatusBadRequest, "name is required")
		return
	}

	id, err := h.service.CreateDepartment(r.Context(), collegeID, req.Name)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	utils.WriteJSON(w, http.StatusCreated, map[string]string{"id": id})
}

type createCourseRequest struct {
	DepartmentID           string   `json:"departmentId"`
	Name                   string   `json:"name"`
	Code                   string   `json:"code"`
	AttendanceThresholdPct *float64 `json:"attendanceThresholdPct,omitempty"`
}

func (h *Handler) handleCreateCourse(w http.ResponseWriter, r *http.Request) {
	collegeID := gateway.GetCollegeID(r.Context())
	if collegeID == "" {
		utils.WriteError(w, http.StatusUnauthorized, "missing college tenant context")
		return
	}

	var req createCourseRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.DepartmentID == "" || req.Name == "" || req.Code == "" {
		utils.WriteError(w, http.StatusBadRequest, "departmentId, name, and code are required")
		return
	}

	id, err := h.service.CreateCourse(r.Context(), collegeID, req.DepartmentID, req.Name, req.Code, req.AttendanceThresholdPct)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	utils.WriteJSON(w, http.StatusCreated, map[string]string{"id": id})
}

type createSectionRequest struct {
	CourseID                 string   `json:"courseId"`
	Term                     string   `json:"term"`
	TeacherID                string   `json:"teacherId"`
	ClassroomBssid           *string  `json:"classroomBssid,omitempty"`
	ClassroomGeofenceLat     *float64 `json:"classroomGeofenceLat,omitempty"`
	ClassroomGeofenceLng     *float64 `json:"classroomGeofenceLng,omitempty"`
	ClassroomGeofenceRadiusM *float64 `json:"classroomGeofenceRadiusM,omitempty"`
}

func (h *Handler) handleCreateSection(w http.ResponseWriter, r *http.Request) {
	collegeID := gateway.GetCollegeID(r.Context())
	if collegeID == "" {
		utils.WriteError(w, http.StatusUnauthorized, "missing college tenant context")
		return
	}

	var req createSectionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.CourseID == "" || req.Term == "" || req.TeacherID == "" {
		utils.WriteError(w, http.StatusBadRequest, "courseId, term, and teacherId are required")
		return
	}

	id, err := h.service.CreateSection(r.Context(), collegeID, req.CourseID, req.Term, req.TeacherID,
		req.ClassroomBssid, req.ClassroomGeofenceLat, req.ClassroomGeofenceLng, req.ClassroomGeofenceRadiusM)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	utils.WriteJSON(w, http.StatusCreated, map[string]string{"id": id})
}

func (h *Handler) handleImportUsers(w http.ResponseWriter, r *http.Request) {
	collegeID := gateway.GetCollegeID(r.Context())
	if collegeID == "" {
		utils.WriteError(w, http.StatusUnauthorized, "missing college tenant context")
		return
	}

	if err := r.ParseMultipartForm(10 << 20); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "failed to parse multipart form")
		return
	}

	file, _, err := r.FormFile("file")
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "file parameter is required")
		return
	}
	defer file.Close()

	count, err := h.service.BulkImportUsersCSV(r.Context(), collegeID, file)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	utils.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"imported": count,
		"message":  "users imported successfully",
	})
}

func (h *Handler) handleImportEnrollments(w http.ResponseWriter, r *http.Request) {
	collegeID := gateway.GetCollegeID(r.Context())
	if collegeID == "" {
		utils.WriteError(w, http.StatusUnauthorized, "missing college tenant context")
		return
	}

	if err := r.ParseMultipartForm(10 << 20); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "failed to parse multipart form")
		return
	}

	file, _, err := r.FormFile("file")
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "file parameter is required")
		return
	}
	defer file.Close()

	count, err := h.service.BulkImportEnrollmentsCSV(r.Context(), collegeID, file)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	utils.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"imported": count,
		"message":  "enrollments imported successfully",
	})
}

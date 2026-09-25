package notification

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"

	"atapp/db"
	"atapp/internal/gateway"
	"atapp/internal/utils"
	"github.com/go-chi/chi/v5"
)

// Service manages user-facing notification preferences (device tokens).
type Service struct {
	dbConn *sql.DB
}

// NewService instantiates a new notification preferences Service.
func NewService(dbConn *sql.DB) *Service {
	return &Service{dbConn: dbConn}
}

// RegisterDeviceToken stores (or clears, if empty) the caller's FCM device
// token, used to route push notifications to their device.
func (s *Service) RegisterDeviceToken(ctx context.Context, collegeID, userID, token string) error {
	tx, err := s.dbConn.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if err := db.WithTenant(tx, collegeID); err != nil {
		return err
	}

	if _, err := tx.ExecContext(ctx, "UPDATE users SET fcm_token = $1 WHERE id = $2", token, userID); err != nil {
		return err
	}

	return tx.Commit()
}

// Handler exposes notification preference endpoints to any authenticated user.
type Handler struct {
	service *Service
}

// NewHandler creates a new notification preferences Handler instance.
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// RegisterRoutes binds the device-token registration endpoint. Callers must
// wrap the router with the JWT auth middleware before calling this; any
// authenticated role may register their own device token.
func (h *Handler) RegisterRoutes(r chi.Router) {
	r.Post("/me/device-token", h.handleRegisterDeviceToken)
}

type registerDeviceTokenRequest struct {
	Token string `json:"token"`
}

func (h *Handler) handleRegisterDeviceToken(w http.ResponseWriter, r *http.Request) {
	collegeID := gateway.GetCollegeID(r.Context())
	userID := gateway.GetUserID(r.Context())
	if collegeID == "" || userID == "" {
		utils.WriteError(w, http.StatusUnauthorized, "unauthorized: missing token context information")
		return
	}

	var req registerDeviceTokenRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := h.service.RegisterDeviceToken(r.Context(), collegeID, userID, req.Token); err != nil {
		utils.WriteServiceError(w, err)
		return
	}

	utils.WriteJSON(w, http.StatusOK, map[string]string{"message": "device token registered"})
}

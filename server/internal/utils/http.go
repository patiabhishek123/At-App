package utils

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
)

// ErrorResponse represents a standardized JSON error envelope.
type ErrorResponse struct {
	Error string `json:"error"`
}

// WriteJSON sends a JSON response with the given status code.
func WriteJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

// WriteError sends a JSON error response with the given status code.
func WriteError(w http.ResponseWriter, status int, message string) {
	WriteJSON(w, status, ErrorResponse{Error: message})
}

// AppError is a service-layer error that carries the HTTP status it should
// map to, and a message that is safe to return to the client (unlike a
// wrapped internal/db error, which may contain sensitive details).
type AppError struct {
	Status  int
	Message string
}

func (e *AppError) Error() string { return e.Message }

// NewAppError constructs an AppError for an expected business-logic failure
// (e.g. "not found", "not yours", "already ended") that a handler should
// report to the client verbatim, at the given HTTP status.
func NewAppError(status int, message string) error {
	return &AppError{Status: status, Message: message}
}

// WriteServiceError maps a service-layer error to an HTTP response: an
// AppError is reported at its declared status with its message, while any
// other error is treated as an unexpected internal failure — logged
// server-side, but reported to the client as a generic 500 so internal
// details (e.g. raw SQL errors) are never leaked.
func WriteServiceError(w http.ResponseWriter, err error) {
	var appErr *AppError
	if errors.As(err, &appErr) {
		WriteError(w, appErr.Status, appErr.Message)
		return
	}
	log.Printf("internal error: %v", err)
	WriteError(w, http.StatusInternalServerError, "internal server error")
}

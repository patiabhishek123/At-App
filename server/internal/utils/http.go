package utils

import (
	"encoding/json"
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

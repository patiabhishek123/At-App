package utils

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestWriteJSON(t *testing.T) {
	w := httptest.NewRecorder()
	WriteJSON(w, http.StatusCreated, map[string]string{"id": "abc"})

	if w.Code != http.StatusCreated {
		t.Errorf("expected status %d, got %d", http.StatusCreated, w.Code)
	}
	if ct := w.Header().Get("Content-Type"); ct != "application/json" {
		t.Errorf("expected Content-Type application/json, got %q", ct)
	}

	var body map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to decode response body: %v", err)
	}
	if body["id"] != "abc" {
		t.Errorf("expected body id=abc, got %+v", body)
	}
}

func TestWriteError(t *testing.T) {
	w := httptest.NewRecorder()
	WriteError(w, http.StatusBadRequest, "bad input")

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status %d, got %d", http.StatusBadRequest, w.Code)
	}

	var body ErrorResponse
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to decode response body: %v", err)
	}
	if body.Error != "bad input" {
		t.Errorf("expected error message %q, got %q", "bad input", body.Error)
	}
}

func TestAppError(t *testing.T) {
	err := NewAppError(http.StatusNotFound, "section not found")
	if err.Error() != "section not found" {
		t.Errorf("expected Error() to return the message, got %q", err.Error())
	}

	var appErr *AppError
	if !errors.As(err, &appErr) {
		t.Fatal("expected NewAppError's result to unwrap via errors.As into *AppError")
	}
	if appErr.Status != http.StatusNotFound {
		t.Errorf("expected status %d, got %d", http.StatusNotFound, appErr.Status)
	}
}

func TestWriteServiceError_AppError(t *testing.T) {
	w := httptest.NewRecorder()
	WriteServiceError(w, NewAppError(http.StatusConflict, "already ended"))

	if w.Code != http.StatusConflict {
		t.Errorf("expected status %d, got %d", http.StatusConflict, w.Code)
	}

	var body ErrorResponse
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to decode response body: %v", err)
	}
	if body.Error != "already ended" {
		t.Errorf("expected AppError message to be reported verbatim, got %q", body.Error)
	}
}

func TestWriteServiceError_WrappedAppError(t *testing.T) {
	// A wrapped AppError (e.g. via fmt.Errorf with %w) should still be
	// unwrapped and reported at its declared status.
	w := httptest.NewRecorder()
	wrapped := fmt.Errorf("context: %w", NewAppError(http.StatusForbidden, "not your section"))
	WriteServiceError(w, wrapped)

	if w.Code != http.StatusForbidden {
		t.Errorf("expected status %d, got %d", http.StatusForbidden, w.Code)
	}
}

func TestWriteServiceError_GenericError(t *testing.T) {
	// A plain/wrapped internal error must NOT leak its message to the
	// client; it should always come back as a generic 500.
	w := httptest.NewRecorder()
	WriteServiceError(w, fmt.Errorf("pq: relation \"users\" violates constraint \"fk_college\""))

	if w.Code != http.StatusInternalServerError {
		t.Errorf("expected status %d, got %d", http.StatusInternalServerError, w.Code)
	}

	var body ErrorResponse
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to decode response body: %v", err)
	}
	if body.Error != "internal server error" {
		t.Errorf("expected generic error message, got a leaked internal message: %q", body.Error)
	}
}

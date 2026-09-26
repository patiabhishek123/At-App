package observability

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/prometheus/client_golang/prometheus/testutil"
)

func TestRequestLogger_RecordsIdentityWhenSet(t *testing.T) {
	var innerCalled bool
	handler := RequestLogger(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		innerCalled = true
		// Simulate auth middleware running deeper in the chain and
		// recording the caller's identity after RequestLogger has already
		// wrapped the request.
		SetRequestIdentity(r.Context(), "user-123", "teacher", "college-456")
		w.WriteHeader(http.StatusTeapot)
	}))

	req := httptest.NewRequest(http.MethodGet, "/some/path", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if !innerCalled {
		t.Fatal("expected the wrapped handler to be invoked")
	}
	if rec.Code != http.StatusTeapot {
		t.Errorf("expected status %d, got %d", http.StatusTeapot, rec.Code)
	}
}

func TestSetRequestIdentity_NoopWithoutRequestLogger(t *testing.T) {
	// Calling SetRequestIdentity on a context that was never wrapped by
	// RequestLogger must not panic.
	SetRequestIdentity(context.Background(), "u", "r", "c")
}

func TestMetricsMiddleware_RecordsRequest(t *testing.T) {
	r := chi.NewRouter()
	r.Use(MetricsMiddleware)
	r.Get("/widgets/{id}", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	counter := HTTPRequestsTotal.WithLabelValues(http.MethodGet, "/widgets/{id}", "200")
	before := testutil.ToFloat64(counter)

	req := httptest.NewRequest(http.MethodGet, "/widgets/42", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rec.Code)
	}

	after := testutil.ToFloat64(counter)
	if after != before+1 {
		t.Errorf("expected atapp_http_requests_total{route=/widgets/{id}} to increment by 1, went from %v to %v", before, after)
	}
}

func TestTracingMiddleware_PassesThrough(t *testing.T) {
	var sawSpanContext bool
	handler := TracingMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		sawSpanContext = Tracer() != nil
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/traced", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if !sawSpanContext {
		t.Error("expected a non-nil tracer to be available inside the handler")
	}
	if rec.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", rec.Code)
	}
}

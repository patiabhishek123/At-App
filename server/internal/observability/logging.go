package observability

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/go-chi/chi/v5/middleware"
)

// Logger is the process-wide structured logger. JSON output, so log lines
// are directly parseable by a log aggregator.
var Logger = slog.New(slog.NewJSONHandler(os.Stdout, nil))

type requestLogFields struct {
	userID    string
	role      string
	collegeID string
}

type requestLogFieldsKeyType struct{}

var requestLogFieldsKey = requestLogFieldsKeyType{}

// SetRequestIdentity records the authenticated caller's identity for the
// current request, so RequestLogger's line includes it even though identity
// is only known after auth middleware runs (deeper in the chain than the
// logger itself). A no-op if the request wasn't wrapped by RequestLogger.
func SetRequestIdentity(ctx context.Context, userID, role, collegeID string) {
	if f, ok := ctx.Value(requestLogFieldsKey).(*requestLogFields); ok {
		f.userID = userID
		f.role = role
		f.collegeID = collegeID
	}
}

// RequestLogger is chi middleware that logs each request as a single
// structured line: method, path, status, duration, request id, and (when
// the request is authenticated) the caller's user/role/college id.
func RequestLogger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()

		fields := &requestLogFields{}
		ctx := context.WithValue(r.Context(), requestLogFieldsKey, fields)
		r = r.WithContext(ctx)

		ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)
		next.ServeHTTP(ww, r)

		attrs := []any{
			"method", r.Method,
			"path", r.URL.Path,
			"status", ww.Status(),
			"bytes", ww.BytesWritten(),
			"duration_ms", time.Since(start).Milliseconds(),
			"request_id", middleware.GetReqID(r.Context()),
		}
		if fields.userID != "" {
			attrs = append(attrs, "user_id", fields.userID, "role", fields.role, "college_id", fields.collegeID)
		}

		level := slog.LevelInfo
		if ww.Status() >= 500 {
			level = slog.LevelError
		} else if ww.Status() >= 400 {
			level = slog.LevelWarn
		}
		Logger.Log(r.Context(), level, "http_request", attrs...)
	})
}

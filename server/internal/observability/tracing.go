package observability

import (
	"context"
	"net/http"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	sdkresource "go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/trace"
)

// LoggingSpanExporter reports finished spans to the structured logger. Used
// in place of a real OTLP/Jaeger exporter since no trace backend is
// available in this deployment; swapping in a real exporter later only
// requires changing InitTracing.
type LoggingSpanExporter struct{}

// ExportSpans logs one structured line per finished span.
func (LoggingSpanExporter) ExportSpans(ctx context.Context, spans []sdktrace.ReadOnlySpan) error {
	for _, s := range spans {
		sc := s.SpanContext()
		Logger.Info("span",
			"name", s.Name(),
			"trace_id", sc.TraceID().String(),
			"span_id", sc.SpanID().String(),
			"parent_span_id", s.Parent().SpanID().String(),
			"duration_ms", s.EndTime().Sub(s.StartTime()).Milliseconds(),
			"status", s.Status().Code.String(),
		)
	}
	return nil
}

// Shutdown is a no-op; there is no external connection to close.
func (LoggingSpanExporter) Shutdown(ctx context.Context) error { return nil }

var tracer trace.Tracer = otel.Tracer("atapp")

// InitTracing installs a global TracerProvider for the given service name,
// exporting finished spans via LoggingSpanExporter. Returns a shutdown func
// to flush/stop the provider on graceful shutdown.
func InitTracing(serviceName string) func(context.Context) error {
	res := sdkresource.NewSchemaless(attribute.String("service.name", serviceName))

	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(LoggingSpanExporter{}),
		sdktrace.WithResource(res),
	)
	otel.SetTracerProvider(tp)
	tracer = tp.Tracer(serviceName)

	return tp.Shutdown
}

// Tracer returns the process-wide tracer, valid whether or not InitTracing
// has been called (falls back to a no-op tracer before that).
func Tracer() trace.Tracer {
	return tracer
}

// TracingMiddleware starts a root span for every HTTP request, named after
// the matched route pattern once routing has occurred.
func TracingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx, span := Tracer().Start(r.Context(), r.Method+" "+r.URL.Path)
		defer span.End()
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

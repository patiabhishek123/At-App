package observability

import (
	"context"

	"go.opentelemetry.io/otel/propagation"
)

var propagator = propagation.TraceContext{}

// InjectTraceHeaders serializes the current span context from ctx into a
// plain string map suitable for carrying over a message broker (e.g. as
// Kafka message headers), so a consumer can continue the same trace.
func InjectTraceHeaders(ctx context.Context) map[string]string {
	carrier := propagation.MapCarrier{}
	propagator.Inject(ctx, carrier)
	return carrier
}

// ExtractTraceContext rebuilds a context carrying the span context encoded
// in headers (as produced by InjectTraceHeaders), so a consumer can start a
// child span continuing the producer's trace.
func ExtractTraceContext(ctx context.Context, headers map[string]string) context.Context {
	carrier := propagation.MapCarrier(headers)
	return propagator.Extract(ctx, carrier)
}

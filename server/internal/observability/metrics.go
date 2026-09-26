package observability

import (
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	// HTTPRequestsTotal counts every HTTP request handled, by method, route
	// pattern (not raw path, to keep cardinality bounded), and status code.
	HTTPRequestsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "atapp_http_requests_total",
		Help: "Total HTTP requests processed.",
	}, []string{"method", "route", "status"})

	// HTTPRequestDuration observes request latency, by method and route pattern.
	HTTPRequestDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "atapp_http_request_duration_seconds",
		Help:    "HTTP request latency in seconds.",
		Buckets: prometheus.DefBuckets,
	}, []string{"method", "route"})

	// CheckinsTotal counts student check-in attempts by outcome
	// ("accepted"/"rejected"), the core business metric for the anti-proxy flow.
	CheckinsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "atapp_checkins_total",
		Help: "Total student check-in attempts, by result.",
	}, []string{"result"})

	// ActiveSessions tracks the number of currently active class sessions.
	ActiveSessions = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "atapp_active_sessions",
		Help: "Number of currently active class sessions.",
	})
)

// MetricsMiddleware records request count and latency metrics for every
// request. Must run after chi's routing has matched a pattern (i.e. mounted
// on the top-level router) so RoutePattern() resolves correctly.
func MetricsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)

		next.ServeHTTP(ww, r)

		pattern := chi.RouteContext(r.Context()).RoutePattern()
		if pattern == "" {
			pattern = "unmatched"
		}

		HTTPRequestsTotal.WithLabelValues(r.Method, pattern, strconv.Itoa(ww.Status())).Inc()
		HTTPRequestDuration.WithLabelValues(r.Method, pattern).Observe(time.Since(start).Seconds())
	})
}

// MetricsHandler exposes the Prometheus text-format scrape endpoint.
func MetricsHandler() http.Handler {
	return promhttp.Handler()
}

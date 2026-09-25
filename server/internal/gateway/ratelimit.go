package gateway

import (
	"fmt"
	"net"
	"net/http"
	"time"

	"atapp/internal/utils"
	"github.com/redis/go-redis/v9"
)

// RateLimit returns middleware that allows at most maxAttempts requests per
// window per client IP, keyed under the given name. It is intended for
// unauthenticated, abuse-prone endpoints such as login.
func RateLimit(rdb *redis.Client, name string, maxAttempts int, window time.Duration) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := clientIP(r)
			key := fmt.Sprintf("ratelimit:%s:%s", name, ip)

			count, err := rdb.Incr(r.Context(), key).Result()
			if err != nil {
				// Fail open: don't block requests if Redis is unavailable.
				next.ServeHTTP(w, r)
				return
			}
			if count == 1 {
				rdb.Expire(r.Context(), key, window)
			}
			if count > int64(maxAttempts) {
				utils.WriteError(w, http.StatusTooManyRequests, "too many requests, please try again later")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

func clientIP(r *http.Request) string {
	if fwd := r.Header.Get("X-Forwarded-For"); fwd != "" {
		return fwd
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

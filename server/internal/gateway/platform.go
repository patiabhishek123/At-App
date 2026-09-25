package gateway

import (
	"crypto/subtle"
	"net/http"

	"atapp/internal/utils"
)

// RequirePlatformKey restricts access to platform-provisioning endpoints
// (e.g. tenant onboarding) to callers presenting the shared platform admin
// key, since these routes run before any tenant/JWT context exists.
func RequirePlatformKey(key string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			provided := r.Header.Get("X-Platform-Admin-Key")
			if provided == "" || subtle.ConstantTimeCompare([]byte(provided), []byte(key)) != 1 {
				utils.WriteError(w, http.StatusForbidden, "forbidden: invalid platform admin key")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

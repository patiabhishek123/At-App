package gateway

import (
	"context"
	"net/http"
	"strings"

	"atapp/internal/auth"
	"atapp/internal/utils"
)

type contextKey string

const (
	// ContextKeyUserID is the context key for the user ID.
	ContextKeyUserID contextKey = "user_id"
	// ContextKeyRole is the context key for the user's role.
	ContextKeyRole contextKey = "role"
	// ContextKeyCollegeID is the context key for the user's college tenant ID.
	ContextKeyCollegeID contextKey = "college_id"
)

// AuthMiddleware validates the JWT token in the Authorization header and stores claims in context.
func AuthMiddleware(jwtSecret []byte) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				utils.WriteError(w, http.StatusUnauthorized, "authorization header is required")
				return
			}

			parts := strings.Split(authHeader, " ")
			if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
				utils.WriteError(w, http.StatusUnauthorized, "authorization header must be in 'Bearer <token>' format")
				return
			}

			tokenStr := parts[1]
			claims, err := auth.ValidateToken(tokenStr, jwtSecret)
			if err != nil {
				utils.WriteError(w, http.StatusUnauthorized, "invalid or expired access token")
				return
			}

			// Enrich context with claims
			ctx := context.WithValue(r.Context(), ContextKeyUserID, claims.UserID)
			ctx = context.WithValue(ctx, ContextKeyRole, claims.Role)
			ctx = context.WithValue(ctx, ContextKeyCollegeID, claims.CollegeID)

			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// RequireRole restricts endpoint access to specified roles.
func RequireRole(allowedRoles ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			role, ok := r.Context().Value(ContextKeyRole).(string)
			if !ok {
				utils.WriteError(w, http.StatusForbidden, "forbidden: missing role verification")
				return
			}

			allowed := false
			for _, r := range allowedRoles {
				if role == r {
					allowed = true
					break
				}
			}

			if !allowed {
				utils.WriteError(w, http.StatusForbidden, "forbidden: insufficient permissions")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// GetUserID retrieves the authenticated User ID from context.
func GetUserID(ctx context.Context) string {
	val, _ := ctx.Value(ContextKeyUserID).(string)
	return val
}

// GetRole retrieves the authenticated User Role from context.
func GetRole(ctx context.Context) string {
	val, _ := ctx.Value(ContextKeyRole).(string)
	return val
}

// GetCollegeID retrieves the authenticated Tenant College ID from context.
func GetCollegeID(ctx context.Context) string {
	val, _ := ctx.Value(ContextKeyCollegeID).(string)
	return val
}

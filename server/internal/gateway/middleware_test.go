package gateway

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"atapp/internal/auth"
)

func TestAuthMiddlewareAcceptsOnlyAccessTokens(t *testing.T) {
	secret := []byte("gateway-token-test-secret-at-least-32-bytes")
	pair, err := auth.GenerateTokenPair("user-1", "teacher", "college-1", secret)
	if err != nil {
		t.Fatalf("GenerateTokenPair failed: %v", err)
	}

	handler := AuthMiddleware(secret)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if GetUserID(r.Context()) != "user-1" || GetRole(r.Context()) != "teacher" || GetCollegeID(r.Context()) != "college-1" {
			t.Fatal("middleware did not populate the expected identity context")
		}
		w.WriteHeader(http.StatusNoContent)
	}))

	tests := []struct {
		name       string
		token      string
		wantStatus int
	}{
		{name: "access token", token: pair.AccessToken, wantStatus: http.StatusNoContent},
		{name: "refresh token", token: pair.RefreshToken, wantStatus: http.StatusUnauthorized},
		{name: "tampered token", token: pair.AccessToken + "tampered", wantStatus: http.StatusUnauthorized},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			request := httptest.NewRequest(http.MethodGet, "/protected", nil)
			request.Header.Set("Authorization", "Bearer "+test.token)
			response := httptest.NewRecorder()

			handler.ServeHTTP(response, request)

			if response.Code != test.wantStatus {
				t.Fatalf("expected status %d, got %d", test.wantStatus, response.Code)
			}
		})
	}
}

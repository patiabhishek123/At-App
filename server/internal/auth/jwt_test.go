package auth

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func TestTokenPurposeValidation(t *testing.T) {
	secret := []byte("token-purpose-test-secret-at-least-32-bytes")
	pair, err := GenerateTokenPair("user-1", "student", "college-1", secret)
	if err != nil {
		t.Fatalf("GenerateTokenPair failed: %v", err)
	}

	accessClaims, err := ValidateAccessToken(pair.AccessToken, secret)
	if err != nil {
		t.Fatalf("access token validation failed: %v", err)
	}
	if accessClaims.TokenType != TokenTypeAccess {
		t.Fatalf("expected access token type, got %q", accessClaims.TokenType)
	}

	refreshClaims, err := ValidateRefreshToken(pair.RefreshToken, secret)
	if err != nil {
		t.Fatalf("refresh token validation failed: %v", err)
	}
	if refreshClaims.TokenType != TokenTypeRefresh {
		t.Fatalf("expected refresh token type, got %q", refreshClaims.TokenType)
	}

	if _, err := ValidateAccessToken(pair.RefreshToken, secret); err == nil {
		t.Fatal("expected refresh token to be rejected as an access token")
	}
	if _, err := ValidateRefreshToken(pair.AccessToken, secret); err == nil {
		t.Fatal("expected access token to be rejected as a refresh token")
	}
	if _, err := ValidateAccessToken(pair.AccessToken+"tampered", secret); err == nil {
		t.Fatal("expected tampered access token to be rejected")
	}
}

func TestExpiredAccessTokenIsRejected(t *testing.T) {
	secret := []byte("expired-token-test-secret-at-least-32-bytes")
	claims := Claims{
		UserID:    "user-1",
		Role:      "student",
		CollegeID: "college-1",
		TokenType: TokenTypeAccess,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   "user-1",
			IssuedAt:  jwt.NewNumericDate(time.Now().Add(-2 * time.Hour)),
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(-time.Hour)),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString(secret)
	if err != nil {
		t.Fatalf("failed to sign expired token: %v", err)
	}

	if _, err := ValidateAccessToken(tokenString, secret); err == nil {
		t.Fatal("expected expired access token to be rejected")
	}
}

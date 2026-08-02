package auth

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// Claims represents the customized JWT payload.
type Claims struct {
	UserID    string `json:"user_id"`
	Role      string `json:"role"`
	CollegeID string `json:"college_id"`
	jwt.RegisteredClaims
}

// TokenPair bundles the access and refresh tokens.
type TokenPair struct {
	AccessToken  string `json:"accessToken"`
	RefreshToken string `json:"refreshToken"`
}

// GenerateTokenPair issues a 15-minute access token and a 7-day refresh token.
func GenerateTokenPair(userID, role, collegeID string, secret []byte) (TokenPair, error) {
	now := time.Now()

	// Access Token
	accessClaims := Claims{
		UserID:    userID,
		Role:      role,
		CollegeID: collegeID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(15 * time.Minute)),
			IssuedAt:  jwt.NewNumericDate(now),
		},
	}
	accessToken := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims)
	accessStr, err := accessToken.SignedString(secret)
	if err != nil {
		return TokenPair{}, err
	}

	// Refresh Token
	refreshClaims := Claims{
		UserID:    userID,
		Role:      role,
		CollegeID: collegeID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(7 * 24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(now),
		},
	}
	refreshToken := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims)
	refreshStr, err := refreshToken.SignedString(secret)
	if err != nil {
		return TokenPair{}, err
	}

	return TokenPair{
		AccessToken:  accessStr,
		RefreshToken: refreshStr,
	}, nil
}

// ValidateToken parses and validates the JWT string against the secret.
func ValidateToken(tokenStr string, secret []byte) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return secret, nil
	})
	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(*Claims); ok && token.Valid {
		return claims, nil
	}

	return nil, errors.New("invalid claims or token")
}

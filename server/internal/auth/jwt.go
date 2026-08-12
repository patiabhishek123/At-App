package auth

import (
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// Claims represents the customized JWT payload.
type Claims struct {
	UserID    string `json:"user_id"`
	Role      string `json:"role"`
	CollegeID string `json:"college_id"`
	TokenType string `json:"token_type"`
	jwt.RegisteredClaims
}

const (
	TokenTypeAccess  = "access"
	TokenTypeRefresh = "refresh"
)

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
		TokenType: TokenTypeAccess,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(15 * time.Minute)),
			IssuedAt:  jwt.NewNumericDate(now),
			Subject:   userID,
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
		TokenType: TokenTypeRefresh,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(7 * 24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(now),
			Subject:   userID,
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

// ValidateAccessToken parses a JWT and requires an access-token purpose.
func ValidateAccessToken(tokenStr string, secret []byte) (*Claims, error) {
	return validateToken(tokenStr, secret, TokenTypeAccess)
}

// ValidateRefreshToken parses a JWT and requires a refresh-token purpose.
func ValidateRefreshToken(tokenStr string, secret []byte) (*Claims, error) {
	return validateToken(tokenStr, secret, TokenTypeRefresh)
}

func validateToken(tokenStr string, secret []byte, expectedType string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (interface{}, error) {
		if t.Method != jwt.SigningMethodHS256 {
			return nil, errors.New("unexpected signing method")
		}
		return secret, nil
	})
	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid claims or token")
	}
	if claims.TokenType != expectedType {
		return nil, fmt.Errorf("invalid token purpose: expected %s", expectedType)
	}
	if claims.UserID == "" || claims.Role == "" || claims.CollegeID == "" {
		return nil, errors.New("token is missing required identity claims")
	}

	return claims, nil
}

package notification

import (
	"bytes"
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"

	"atapp/db"
)

// fcmServiceAccount mirrors the fields we need from a Firebase/Google Cloud
// service account JSON key file.
type fcmServiceAccount struct {
	ClientEmail string `json:"client_email"`
	PrivateKey  string `json:"private_key"`
	TokenURI    string `json:"token_uri"`
}

// FCMNotifier sends push notifications via the Firebase Cloud Messaging
// HTTP v1 API, authenticating as a service account via the OAuth2
// JWT-bearer flow (RFC 7523) so no extra dependency beyond the standard
// library is required.
type FCMNotifier struct {
	dbConn    *sql.DB
	projectID string
	account   fcmServiceAccount
	key       *rsa.PrivateKey
	client    *http.Client
	sendURL   string // overridable in tests; defaults to the real FCM endpoint

	tokenMu     sync.Mutex
	cachedToken string
	tokenExpiry time.Time
}

// NewFCMNotifier parses the given service account JSON and prepares a
// notifier for the given Firebase project.
func NewFCMNotifier(dbConn *sql.DB, projectID string, serviceAccountJSON []byte) (*FCMNotifier, error) {
	var acct fcmServiceAccount
	if err := json.Unmarshal(serviceAccountJSON, &acct); err != nil {
		return nil, fmt.Errorf("invalid FCM service account JSON: %w", err)
	}
	if acct.ClientEmail == "" || acct.PrivateKey == "" || acct.TokenURI == "" {
		return nil, errors.New("FCM service account JSON missing required fields (client_email, private_key, token_uri)")
	}

	block, _ := pem.Decode([]byte(acct.PrivateKey))
	if block == nil {
		return nil, errors.New("failed to decode FCM service account private key PEM")
	}
	keyIfc, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		return nil, fmt.Errorf("failed to parse FCM service account private key: %w", err)
	}
	key, ok := keyIfc.(*rsa.PrivateKey)
	if !ok {
		return nil, errors.New("FCM service account private key is not RSA")
	}

	return &FCMNotifier{
		dbConn:    dbConn,
		projectID: projectID,
		account:   acct,
		key:       key,
		client:    &http.Client{Timeout: 10 * time.Second},
		sendURL:   fmt.Sprintf("https://fcm.googleapis.com/v1/projects/%s/messages:send", projectID),
	}, nil
}

func base64URLEncode(b []byte) string {
	return base64.RawURLEncoding.EncodeToString(b)
}

// accessToken returns a cached OAuth2 access token, minting a new one via
// the JWT-bearer flow if the cached one is missing or close to expiring.
func (f *FCMNotifier) accessToken(ctx context.Context) (string, error) {
	f.tokenMu.Lock()
	defer f.tokenMu.Unlock()

	if f.cachedToken != "" && time.Now().Before(f.tokenExpiry.Add(-1*time.Minute)) {
		return f.cachedToken, nil
	}

	now := time.Now()
	header := map[string]string{"alg": "RS256", "typ": "JWT"}
	claims := map[string]interface{}{
		"iss":   f.account.ClientEmail,
		"scope": "https://www.googleapis.com/auth/firebase.messaging",
		"aud":   f.account.TokenURI,
		"iat":   now.Unix(),
		"exp":   now.Add(1 * time.Hour).Unix(),
	}
	headerJSON, err := json.Marshal(header)
	if err != nil {
		return "", err
	}
	claimsJSON, err := json.Marshal(claims)
	if err != nil {
		return "", err
	}
	signingInput := base64URLEncode(headerJSON) + "." + base64URLEncode(claimsJSON)

	hashed := sha256.Sum256([]byte(signingInput))
	sig, err := rsa.SignPKCS1v15(rand.Reader, f.key, crypto.SHA256, hashed[:])
	if err != nil {
		return "", fmt.Errorf("failed to sign FCM JWT: %w", err)
	}
	assertion := signingInput + "." + base64URLEncode(sig)

	form := "grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=" + assertion
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, f.account.TokenURI, bytes.NewBufferString(form))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := f.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to exchange FCM JWT for access token: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("FCM token exchange failed: %s: %s", resp.Status, string(respBody))
	}

	var tokenResp struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
	}
	if err := json.Unmarshal(respBody, &tokenResp); err != nil {
		return "", fmt.Errorf("failed to parse FCM token response: %w", err)
	}

	f.cachedToken = tokenResp.AccessToken
	f.tokenExpiry = now.Add(time.Duration(tokenResp.ExpiresIn) * time.Second)
	return f.cachedToken, nil
}

// SendPushNotification looks up the user's registered device token under the
// tenant's RLS context and delivers the message via the FCM HTTP v1 API.
// If the user has no registered device, this is a no-op (not an error).
func (f *FCMNotifier) SendPushNotification(ctx context.Context, collegeID, userID, title, body string) error {
	token, err := f.lookupDeviceToken(ctx, collegeID, userID)
	if err != nil {
		return err
	}
	if token == "" {
		return nil
	}

	return f.sendToToken(ctx, token, title, body)
}

// sendToToken delivers a single message to a specific FCM device token. Split
// out from SendPushNotification so the HTTP/auth flow can be tested without
// a database.
func (f *FCMNotifier) sendToToken(ctx context.Context, token, title, body string) error {
	accessToken, err := f.accessToken(ctx)
	if err != nil {
		return err
	}

	payload := map[string]interface{}{
		"message": map[string]interface{}{
			"token": token,
			"notification": map[string]string{
				"title": title,
				"body":  body,
			},
		},
	}
	payloadJSON, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, f.sendURL, bytes.NewReader(payloadJSON))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := f.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send FCM push notification: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("FCM send failed: %s: %s", resp.Status, string(respBody))
	}
	return nil
}

func (f *FCMNotifier) lookupDeviceToken(ctx context.Context, collegeID, userID string) (string, error) {
	tx, err := f.dbConn.BeginTx(ctx, &sql.TxOptions{ReadOnly: true})
	if err != nil {
		return "", err
	}
	defer tx.Rollback()

	if err := db.WithTenant(tx, collegeID); err != nil {
		return "", err
	}

	var token sql.NullString
	err = tx.QueryRowContext(ctx, "SELECT fcm_token FROM users WHERE id = $1", userID).Scan(&token)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", nil
		}
		return "", err
	}
	return token.String, nil
}

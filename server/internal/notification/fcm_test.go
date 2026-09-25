package notification

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// newTestServiceAccountJSON generates a fresh RSA key and returns a fake
// service account JSON blob pointing at the given token endpoint.
func newTestServiceAccountJSON(t *testing.T, tokenURI string) []byte {
	t.Helper()

	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("failed to generate test RSA key: %v", err)
	}

	pkcs8, err := x509.MarshalPKCS8PrivateKey(key)
	if err != nil {
		t.Fatalf("failed to marshal test private key: %v", err)
	}
	pemBytes := pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: pkcs8})

	acct := map[string]string{
		"client_email": "test-notifier@example-project.iam.gserviceaccount.com",
		"private_key":  string(pemBytes),
		"token_uri":    tokenURI,
	}
	raw, err := json.Marshal(acct)
	if err != nil {
		t.Fatalf("failed to marshal test service account: %v", err)
	}
	return raw
}

func TestFCMNotifier_AccessTokenExchange(t *testing.T) {
	var gotAuthHeader, gotBody string
	tokenServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuthHeader = r.Header.Get("Content-Type")
		body, _ := io.ReadAll(r.Body)
		gotBody = string(body)

		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"access_token":"test-access-token","expires_in":3600}`))
	}))
	defer tokenServer.Close()

	acctJSON := newTestServiceAccountJSON(t, tokenServer.URL)
	notifier, err := NewFCMNotifier(nil, "example-project", acctJSON)
	if err != nil {
		t.Fatalf("NewFCMNotifier failed: %v", err)
	}

	token, err := notifier.accessToken(t.Context())
	if err != nil {
		t.Fatalf("accessToken failed: %v", err)
	}
	if token != "test-access-token" {
		t.Errorf("expected access token %q, got %q", "test-access-token", token)
	}
	if gotAuthHeader != "application/x-www-form-urlencoded" {
		t.Errorf("expected form-urlencoded content type, got %q", gotAuthHeader)
	}
	if !strings.Contains(gotBody, "grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer") {
		t.Errorf("expected JWT-bearer grant type in request body, got %q", gotBody)
	}
	if !strings.Contains(gotBody, "assertion=") {
		t.Errorf("expected a signed JWT assertion in request body, got %q", gotBody)
	}

	// A second call within the token's lifetime should reuse the cached
	// token rather than hitting the token endpoint again.
	gotBody = ""
	token2, err := notifier.accessToken(t.Context())
	if err != nil {
		t.Fatalf("accessToken (cached) failed: %v", err)
	}
	if token2 != token {
		t.Errorf("expected cached token to be reused, got a different value")
	}
	if gotBody != "" {
		t.Errorf("expected cached token to avoid a second token-endpoint call, but the endpoint was hit again")
	}
}

func TestFCMNotifier_SendToToken(t *testing.T) {
	tokenServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"access_token":"test-access-token","expires_in":3600}`))
	}))
	defer tokenServer.Close()

	var gotAuth, gotContentType, gotBody string
	sendServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuth = r.Header.Get("Authorization")
		gotContentType = r.Header.Get("Content-Type")
		body, _ := io.ReadAll(r.Body)
		gotBody = string(body)
		w.WriteHeader(http.StatusOK)
	}))
	defer sendServer.Close()

	acctJSON := newTestServiceAccountJSON(t, tokenServer.URL)
	notifier, err := NewFCMNotifier(nil, "example-project", acctJSON)
	if err != nil {
		t.Fatalf("NewFCMNotifier failed: %v", err)
	}
	notifier.sendURL = sendServer.URL

	if err := notifier.sendToToken(t.Context(), "device-token-abc", "Hello", "World"); err != nil {
		t.Fatalf("sendToToken failed: %v", err)
	}

	if gotAuth != "Bearer test-access-token" {
		t.Errorf("expected Authorization header %q, got %q", "Bearer test-access-token", gotAuth)
	}
	if gotContentType != "application/json" {
		t.Errorf("expected JSON content type, got %q", gotContentType)
	}
	var payload map[string]interface{}
	if err := json.Unmarshal([]byte(gotBody), &payload); err != nil {
		t.Fatalf("failed to parse sent payload: %v", err)
	}
	message, ok := payload["message"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected a 'message' object in payload, got %v", payload)
	}
	if message["token"] != "device-token-abc" {
		t.Errorf("expected device token %q in payload, got %v", "device-token-abc", message["token"])
	}
	notification, ok := message["notification"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected a 'notification' object in message, got %v", message)
	}
	if notification["title"] != "Hello" || notification["body"] != "World" {
		t.Errorf("expected title/body Hello/World, got %v", notification)
	}
}

func TestFCMNotifier_SendToToken_ErrorStatus(t *testing.T) {
	tokenServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"access_token":"test-access-token","expires_in":3600}`))
	}))
	defer tokenServer.Close()

	sendServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"error":"invalid device token"}`))
	}))
	defer sendServer.Close()

	acctJSON := newTestServiceAccountJSON(t, tokenServer.URL)
	notifier, err := NewFCMNotifier(nil, "example-project", acctJSON)
	if err != nil {
		t.Fatalf("NewFCMNotifier failed: %v", err)
	}
	notifier.sendURL = sendServer.URL

	err = notifier.sendToToken(t.Context(), "bad-token", "Hello", "World")
	if err == nil {
		t.Fatal("expected an error for a non-200 FCM response, got nil")
	}
	if !strings.Contains(err.Error(), "invalid device token") {
		t.Errorf("expected error to include the FCM response body, got: %v", err)
	}
}

func TestNewFCMNotifier_InvalidServiceAccount(t *testing.T) {
	if _, err := NewFCMNotifier(nil, "example-project", []byte(`{"client_email":"x"}`)); err == nil {
		t.Fatal("expected an error for a service account missing private_key/token_uri")
	}
	if _, err := NewFCMNotifier(nil, "example-project", []byte(`not json`)); err == nil {
		t.Fatal("expected an error for invalid JSON")
	}
}

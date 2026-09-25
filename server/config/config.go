package config

import (
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"
	"time"
)

// Config holds the application configuration parameters.
type Config struct {
	Env              string
	ServerPort       string
	DBHost           string
	DBPort           int
	DBUser           string
	DBPassword       string
	DBName           string
	DBSSLMode        string
	RedisAddr        string
	JWTSecret        string
	KafkaBrokers     []string
	AllowedOrigins   []string
	PlatformAdminKey string

	// SMTP settings for outbound transactional email. Optional: when
	// SMTPHost is empty, emails are logged instead of sent (any environment).
	SMTPHost     string
	SMTPPort     string
	SMTPUsername string
	SMTPPassword string
	SMTPFrom     string

	// FCM settings for push notification delivery. Optional: when
	// FCMProjectID or FCMServiceAccountJSON is empty, push notifications are
	// logged instead of sent (any environment).
	FCMProjectID          string
	FCMServiceAccountJSON string

	// Data retention: how long raw verification signals (BSSID, GPS) are kept
	// before being scrubbed, and how often the prune job checks.
	RawSignalRetention     time.Duration
	RawSignalPruneInterval time.Duration
}

// Load reads config from environment variables or applies dev defaults.
// In any environment other than "development", secrets (JWT_SECRET, DB_PASSWORD)
// must be supplied explicitly; the app refuses to start with insecure defaults.
func Load() Config {
	env := getEnv("APP_ENV", "development")
	isDev := env == "development"

	cfg := Config{
		Env:              env,
		ServerPort:       getEnv("SERVER_PORT", "8080"),
		DBHost:           getEnv("DB_HOST", "localhost"),
		DBPort:           getEnvInt("DB_PORT", 5433),
		DBUser:           getEnv("DB_USER", "atapp_user"),
		DBPassword:       getEnvSecret("DB_PASSWORD", "atapp_password", isDev),
		DBName:           getEnv("DB_NAME", "atapp_db"),
		DBSSLMode:        getEnv("DB_SSLMODE", "disable"),
		RedisAddr:        getEnv("REDIS_ADDR", "localhost:6380"),
		JWTSecret:        getEnvSecret("JWT_SECRET", "super-secret-jwt-signing-key-for-atapp-development", isDev),
		KafkaBrokers:     getEnvList("KAFKA_BROKERS", []string{"localhost:19092"}, isDev),
		AllowedOrigins:   getEnvList("ALLOWED_ORIGINS", []string{"*"}, isDev),
		PlatformAdminKey: getEnvSecret("PLATFORM_ADMIN_KEY", "dev-platform-admin-key", isDev),

		SMTPHost:     getEnv("SMTP_HOST", ""),
		SMTPPort:     getEnv("SMTP_PORT", "587"),
		SMTPUsername: getEnv("SMTP_USERNAME", ""),
		SMTPPassword: getEnv("SMTP_PASSWORD", ""),
		SMTPFrom:     getEnv("SMTP_FROM", "no-reply@atapp.example.com"),

		FCMProjectID:          getEnv("FCM_PROJECT_ID", ""),
		FCMServiceAccountJSON: getEnv("FCM_SERVICE_ACCOUNT_JSON", ""),

		RawSignalRetention:     getEnvDuration("RAW_SIGNAL_RETENTION", 24*time.Hour),
		RawSignalPruneInterval: getEnvDuration("RAW_SIGNAL_PRUNE_INTERVAL", 1*time.Hour),
	}

	return cfg
}

// getEnvSecret behaves like getEnv, but refuses to fall back to a default
// value outside development, since these defaults are known/insecure.
func getEnvSecret(key, devDefault string, isDev bool) string {
	if val, ok := os.LookupEnv(key); ok && val != "" {
		return val
	}
	if !isDev {
		log.Fatalf("Critical: %s must be set explicitly outside development (APP_ENV != \"development\")", key)
	}
	return devDefault
}

// getEnvList reads a comma-separated env var into a slice, refusing to fall
// back to a default value outside development.
func getEnvList(key string, devDefault []string, isDev bool) []string {
	val, ok := os.LookupEnv(key)
	if !ok || val == "" {
		if !isDev {
			log.Fatalf("Critical: %s must be set explicitly outside development (APP_ENV != \"development\")", key)
		}
		return devDefault
	}
	parts := strings.Split(val, ",")
	result := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			result = append(result, p)
		}
	}
	if len(result) == 0 {
		panic(fmt.Sprintf("%s was set but contained no valid entries", key))
	}
	return result
}

func getEnv(key, defaultVal string) string {
	if val, ok := os.LookupEnv(key); ok {
		return val
	}
	return defaultVal
}

func getEnvInt(key string, defaultVal int) int {
	if val, ok := os.LookupEnv(key); ok {
		if intVal, err := strconv.Atoi(val); err == nil {
			return intVal
		}
	}
	return defaultVal
}

// getEnvDuration reads a Go duration string (e.g. "24h", "30m") from the
// given env var, falling back to defaultVal if unset or invalid.
func getEnvDuration(key string, defaultVal time.Duration) time.Duration {
	if val, ok := os.LookupEnv(key); ok {
		if d, err := time.ParseDuration(val); err == nil {
			return d
		}
	}
	return defaultVal
}

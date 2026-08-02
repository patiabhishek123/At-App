package config

import (
	"os"
	"strconv"
)

// Config holds the application configuration parameters.
type Config struct {
	ServerPort string
	DBHost     string
	DBPort     int
	DBUser     string
	DBPassword string
	DBName     string
	DBSSLMode  string
	RedisAddr  string
	JWTSecret  string
}

// Load reads config from environment variables or applies dev defaults.
func Load() Config {
	return Config{
		ServerPort: getEnv("SERVER_PORT", "8080"),
		DBHost:     getEnv("DB_HOST", "localhost"),
		DBPort:     getEnvInt("DB_PORT", 5433),
		DBUser:     getEnv("DB_USER", "atapp_user"),
		DBPassword: getEnv("DB_PASSWORD", "atapp_password"),
		DBName:     getEnv("DB_NAME", "atapp_db"),
		DBSSLMode:  getEnv("DB_SSLMODE", "disable"),
		RedisAddr:  getEnv("REDIS_ADDR", "localhost:6380"),
		JWTSecret:  getEnv("JWT_SECRET", "super-secret-jwt-signing-key-for-atapp-development"),
	}
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

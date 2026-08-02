package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"atapp/config"
	"atapp/db"
	"atapp/internal/admin"
	"atapp/internal/attendance"
	"atapp/internal/auth"
	"atapp/internal/event"
	"atapp/internal/gateway"
	"atapp/internal/notification"
	"atapp/internal/reporting"
	"atapp/internal/session"
	"atapp/internal/verification"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

func main() {
	log.Println("Initializing AtApp Modular Monolith server...")

	// 1. Load config
	cfg := config.Load()

	// 2. Connect to database
	dbCfg := db.Config{
		Host:     cfg.DBHost,
		Port:     cfg.DBPort,
		User:     cfg.DBUser,
		Password: cfg.DBPassword,
		DBName:   cfg.DBName,
		SSLMode:  cfg.DBSSLMode,
	}
	dbConn, err := db.Connect(dbCfg)
	if err != nil {
		log.Fatalf("Critical: database connection failed: %v", err)
	}
	defer dbConn.Close()
	log.Println("Database connection pool established")

	// 3. Connect to Redis
	rdb, err := db.ConnectRedis(cfg.RedisAddr)
	if err != nil {
		log.Fatalf("Critical: Redis connection failed: %v", err)
	}
	defer rdb.Close()
	log.Println("Redis connection established")

	// 4. Initialize Event Bus (Kafka/Redpanda)
	brokers := []string{os.Getenv("KAFKA_BROKERS")}
	if len(brokers) == 0 || brokers[0] == "" {
		brokers = []string{"localhost:19092"}
	}
	var eventBus event.EventBus = event.NewKafkaEventBus(brokers)
	defer func() {
		if err := eventBus.Close(); err != nil {
			log.Printf("Error closing event bus: %v\n", err)
		}
	}()
	log.Printf("Event Bus (Kafka) initialized with brokers %v\n", brokers)

	// 5. Instantiate services
	authService := auth.NewService(dbConn, cfg)
	adminService := admin.NewService(dbConn)
	sessionService := session.NewService(dbConn, rdb, eventBus)
	verifService := verification.NewService(dbConn, rdb, eventBus)
	attendanceService := attendance.NewService(dbConn, eventBus)
	updaterService := reporting.NewUpdater(dbConn, eventBus)

	// 6. Instantiate handlers
	authHandler := auth.NewHandler(authService)
	adminHandler := admin.NewHandler(adminService)
	sessionHandler := session.NewHandler(sessionService)
	verifHandler := verification.NewHandler(verifService)
	attendanceHandler := attendance.NewHandler(attendanceService)

	// 7. Start Asynchronous Aggregate Reporting Consumer
	consumerCtx, consumerCancel := context.WithCancel(context.Background())
	defer consumerCancel()

	reportingConsumer := reporting.NewConsumer(brokers, "attendance.recorded", updaterService)
	reportingConsumer.Start(consumerCtx)

	// 8. Start Asynchronous Notification Consumer
	notifier := notification.NewConsoleNotifier()
	notificationConsumer := notification.NewConsumer(brokers, notifier, dbConn)
	notificationConsumer.Start(consumerCtx)

	// 8b. Start Background Data Pruning Loop
	go func() {
		// Run initial prune
		pruned, err := verifService.PruneRawVerificationData(context.Background(), 24*time.Hour)
		if err != nil {
			log.Printf("[Pruning Job] Error pruning raw verification data: %v", err)
		} else if pruned > 0 {
			log.Printf("[Pruning Job] Successfully pruned %d verification attempt raw location details on startup", pruned)
		}

		ticker := time.NewTicker(1 * time.Hour)
		defer ticker.Stop()
		for {
			select {
			case <-consumerCtx.Done():
				return
			case <-ticker.C:
				pruned, err := verifService.PruneRawVerificationData(context.Background(), 24*time.Hour)
				if err != nil {
					log.Printf("[Pruning Job] Error pruning raw verification data: %v", err)
				} else if pruned > 0 {
					log.Printf("[Pruning Job] Successfully pruned %d verification attempt raw location details", pruned)
				}
			}
		}
	}()


	// 8. Router and middlewares
	r := chi.NewRouter()

	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(60 * time.Second))

	// CORS configuration
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
			if r.Method == "OPTIONS" {
				w.WriteHeader(http.StatusOK)
				return
			}
			next.ServeHTTP(w, r)
		})
	})

	// 9. Register endpoints under /api/v1
	r.Route("/api/v1", func(r chi.Router) {
		// Public Auth routes
		authHandler.RegisterRoutes(r)

		// Authenticated Tenant Context routes
		r.Group(func(r chi.Router) {
			r.Use(gateway.AuthMiddleware([]byte(cfg.JWTSecret)))

			adminHandler.RegisterRoutes(r)
			sessionHandler.RegisterRoutes(r)
			verifHandler.RegisterRoutes(r)
			attendanceHandler.RegisterRoutes(r)

			r.Get("/ping", func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
				_, _ = w.Write([]byte("pong"))
			})
		})
	})

	// 10. Start HTTP server with graceful shutdown handling
	serverAddr := ":" + cfg.ServerPort
	srv := &http.Server{
		Addr:         serverAddr,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Printf("Gateway HTTP server listening on %s", serverAddr)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("Critical: Gateway server closed unexpectedly: %v", err)
		}
	}()

	// Await signal for shutdown
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop

	log.Println("Shutting down Gateway server gracefully...")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("Gateway shutdown failed: %v", err)
	}
	log.Println("Gateway server stopped cleanly")
}

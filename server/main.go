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
	"atapp/internal/observability"
	"atapp/internal/reporting"
	"atapp/internal/session"
	"atapp/internal/tenant"
	"atapp/internal/utils"
	"atapp/internal/verification"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

func main() {
	observability.Logger.Info("initializing AtApp modular monolith server")

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
	if err := db.RunMigrations(dbConn); err != nil {
		log.Fatalf("Critical: database migration failed: %v", err)
	}
	observability.Logger.Info("database migrations applied")
	defer dbConn.Close()
	observability.Logger.Info("database connection pool established")

	// 3. Connect to Redis
	rdb, err := db.ConnectRedis(cfg.RedisAddr)
	if err != nil {
		log.Fatalf("Critical: Redis connection failed: %v", err)
	}
	defer rdb.Close()
	observability.Logger.Info("redis connection established")

	// 4. Initialize Event Bus (Kafka/Redpanda)
	brokers := cfg.KafkaBrokers
	var eventBus event.EventBus = event.NewKafkaEventBus(brokers)
	defer func() {
		if err := eventBus.Close(); err != nil {
			observability.Logger.Error("error closing event bus", "error", err)
		}
	}()
	observability.Logger.Info("event bus initialized", "brokers", brokers)

	// 5. Instantiate services
	authService := auth.NewService(dbConn, cfg)
	adminService := admin.NewService(dbConn)
	tenantService := tenant.NewService(dbConn)
	sessionService := session.NewService(dbConn, rdb, eventBus)
	verifService := verification.NewService(dbConn, rdb, eventBus)
	attendanceService := attendance.NewService(dbConn, eventBus)
	updaterService := reporting.NewUpdater(dbConn, eventBus)
	notificationPrefsService := notification.NewService(dbConn)

	// Wire real email delivery (falls back to console logging if SMTP isn't configured).
	emailSender := notification.NewEmailSenderFromConfig(notification.SMTPConfig{
		Host:     cfg.SMTPHost,
		Port:     cfg.SMTPPort,
		Username: cfg.SMTPUsername,
		Password: cfg.SMTPPassword,
		From:     cfg.SMTPFrom,
	})
	authService.SetEmailSender(emailSender)

	// 6. Instantiate handlers
	authHandler := auth.NewHandler(authService)
	adminHandler := admin.NewHandler(adminService)
	tenantHandler := tenant.NewHandler(tenantService)
	sessionHandler := session.NewHandler(sessionService)
	verifHandler := verification.NewHandler(verifService)
	attendanceHandler := attendance.NewHandler(attendanceService)
	notificationPrefsHandler := notification.NewHandler(notificationPrefsService)

	// 7. Start Asynchronous Aggregate Reporting Consumer
	consumerCtx, consumerCancel := context.WithCancel(context.Background())
	defer consumerCancel()

	reportingConsumer := reporting.NewConsumer(brokers, "attendance.recorded", updaterService)
	reportingConsumer.Start(consumerCtx)

	// 8. Start Asynchronous Notification Consumer
	var notifier notification.Notifier = notification.NewConsoleNotifier()
	if cfg.FCMProjectID != "" && cfg.FCMServiceAccountJSON != "" {
		fcmNotifier, err := notification.NewFCMNotifier(dbConn, cfg.FCMProjectID, []byte(cfg.FCMServiceAccountJSON))
		if err != nil {
			log.Fatalf("Critical: failed to initialize FCM notifier: %v", err)
		}
		notifier = fcmNotifier
		observability.Logger.Info("push notifications: using FCM")
	} else {
		observability.Logger.Info("push notifications: FCM not configured, logging to console instead")
	}
	notificationConsumer := notification.NewConsumer(brokers, notifier, dbConn)
	notificationConsumer.Start(consumerCtx)

	// 8b. Start Background Data Pruning Loop
	observability.Logger.Info("raw verification signal retention configured",
		"retention", cfg.RawSignalRetention.String(), "check_interval", cfg.RawSignalPruneInterval.String())
	go func() {
		// Run initial prune
		pruned, err := verifService.PruneRawVerificationData(context.Background(), cfg.RawSignalRetention)
		if err != nil {
			observability.Logger.Error("pruning job failed", "error", err)
		} else if pruned > 0 {
			observability.Logger.Info("pruning job completed on startup", "rows_pruned", pruned)
		}

		ticker := time.NewTicker(cfg.RawSignalPruneInterval)
		defer ticker.Stop()
		for {
			select {
			case <-consumerCtx.Done():
				return
			case <-ticker.C:
				pruned, err := verifService.PruneRawVerificationData(context.Background(), cfg.RawSignalRetention)
				if err != nil {
					observability.Logger.Error("pruning job failed", "error", err)
				} else if pruned > 0 {
					observability.Logger.Info("pruning job completed", "rows_pruned", pruned)
				}
			}
		}
	}()

	// 7b. Initialize tracing (spans are exported to the structured logger).
	shutdownTracing := observability.InitTracing("atapp")
	defer func() {
		if err := shutdownTracing(context.Background()); err != nil {
			log.Printf("Error shutting down tracer provider: %v", err)
		}
	}()

	// 8. Router and middlewares
	r := chi.NewRouter()

	r.Use(middleware.RequestID)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(60 * time.Second))
	r.Use(observability.TracingMiddleware)
	r.Use(observability.MetricsMiddleware)
	r.Use(observability.RequestLogger)

	// CORS configuration
	allowedOrigins := make(map[string]bool, len(cfg.AllowedOrigins))
	allowAll := false
	for _, o := range cfg.AllowedOrigins {
		if o == "*" {
			allowAll = true
		}
		allowedOrigins[o] = true
	}
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			if allowAll {
				w.Header().Set("Access-Control-Allow-Origin", "*")
			} else if origin != "" && allowedOrigins[origin] {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Vary", "Origin")
			}
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
			if r.Method == "OPTIONS" {
				w.WriteHeader(http.StatusOK)
				return
			}
			next.ServeHTTP(w, r)
		})
	})

	// Unauthenticated health/readiness probes (for load balancers / k8s).
	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})
	r.Get("/readyz", func(w http.ResponseWriter, r *http.Request) {
		if err := dbConn.PingContext(r.Context()); err != nil {
			utils.WriteError(w, http.StatusServiceUnavailable, "database not ready")
			return
		}
		if err := rdb.Ping(r.Context()).Err(); err != nil {
			utils.WriteError(w, http.StatusServiceUnavailable, "redis not ready")
			return
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ready"))
	})

	// Prometheus scrape endpoint. Unauthenticated like the probes above;
	// restrict network access to it (e.g. cluster-internal only) at the
	// infra layer in production.
	r.Handle("/metrics", observability.MetricsHandler())

	// 9. Register endpoints under /api/v1
	authRateLimit := gateway.RateLimit(rdb, "auth", 10, time.Minute)
	r.Route("/api/v1", func(r chi.Router) {
		// Public Auth routes
		authHandler.RegisterPublicRoutes(r, authRateLimit)

		// Platform-level tenant onboarding (no tenant context yet; gated by a
		// shared platform admin key instead of a per-tenant JWT).
		r.Group(func(r chi.Router) {
			r.Use(gateway.RequirePlatformKey(cfg.PlatformAdminKey))
			r.Use(authRateLimit)
			tenantHandler.RegisterRoutes(r)
		})

		// Authenticated Tenant Context routes
		r.Group(func(r chi.Router) {
			r.Use(gateway.AuthMiddleware([]byte(cfg.JWTSecret)))

			adminHandler.RegisterRoutes(r)
			sessionHandler.RegisterRoutes(r)
			verifHandler.RegisterRoutes(r)
			attendanceHandler.RegisterRoutes(r)
			notificationPrefsHandler.RegisterRoutes(r)

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
		observability.Logger.Info("gateway HTTP server listening", "addr", serverAddr)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("Critical: Gateway server closed unexpectedly: %v", err)
		}
	}()

	// Await signal for shutdown
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop

	observability.Logger.Info("shutting down gateway server gracefully")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("Gateway shutdown failed: %v", err)
	}
	observability.Logger.Info("gateway server stopped cleanly")
}

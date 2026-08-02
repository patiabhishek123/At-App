package notification

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"atapp/db"
	"atapp/internal/event"
	"github.com/segmentio/kafka-go"
)

// Consumer manages background Kafka topic readers for notification dispatch.
type Consumer struct {
	brokers       []string
	sessionReader *kafka.Reader
	breachReader  *kafka.Reader
	notifier      Notifier
	dbConn        *sql.DB
}

// NewConsumer initializes readers for session started alerts and low-attendance warnings.
func NewConsumer(brokers []string, notifier Notifier, dbConn *sql.DB) *Consumer {
	sessionReader := kafka.NewReader(kafka.ReaderConfig{
		Brokers:  brokers,
		GroupID:  "notification-session-alerts-group",
		Topic:    "session.started",
		MinBytes: 10,
		MaxBytes: 10e6,
	})

	breachReader := kafka.NewReader(kafka.ReaderConfig{
		Brokers:  brokers,
		GroupID:  "notification-breach-alerts-group",
		Topic:    "threshold.breached",
		MinBytes: 10,
		MaxBytes: 10e6,
	})

	return &Consumer{
		brokers:       brokers,
		sessionReader: sessionReader,
		breachReader:  breachReader,
		notifier:      notifier,
		dbConn:        dbConn,
	}
}

// Start launches background routines reading events until context termination.
func (c *Consumer) Start(ctx context.Context) {
	log.Println("Starting notification consumers...")

	// Listen for new class sessions
	go func() {
		defer func() {
			if err := c.sessionReader.Close(); err != nil {
				log.Printf("Failed to close session notification reader: %v\n", err)
			}
		}()

		for {
			m, err := c.sessionReader.ReadMessage(ctx)
			if err != nil {
				if ctx.Err() != nil {
					return
				}
				log.Printf("Notification session reader error: %v. Retrying in 2s...\n", err)
				time.Sleep(2 * time.Second)
				continue
			}

			var ev event.SessionStartedEvent
			if err := json.Unmarshal(m.Value, &ev); err != nil {
				log.Printf("Notification session error decoding payload: %v\n", err)
				continue
			}

			err = c.notifyEnrolledStudents(ctx, ev)
			if err != nil {
				log.Printf("Failed to notify students for session %s: %v\n", ev.SessionID, err)
			}
		}
	}()

	// Listen for course threshold breaches
	go func() {
		defer func() {
			if err := c.breachReader.Close(); err != nil {
				log.Printf("Failed to close breach notification reader: %v\n", err)
			}
		}()

		for {
			m, err := c.breachReader.ReadMessage(ctx)
			if err != nil {
				if ctx.Err() != nil {
					return
				}
				log.Printf("Notification breach reader error: %v. Retrying in 2s...\n", err)
				time.Sleep(2 * time.Second)
				continue
			}

			var ev event.ThresholdBreachedEvent
			if err := json.Unmarshal(m.Value, &ev); err != nil {
				log.Printf("Notification breach error decoding payload: %v\n", err)
				continue
			}

			var courseCode string
			tx, err := c.dbConn.BeginTx(ctx, &sql.TxOptions{ReadOnly: true})
			if err == nil {
				if errTenant := db.WithTenant(tx, ev.CollegeID); errTenant == nil {
					query := `
						SELECT c.code 
						FROM sections s
						JOIN courses c ON c.id = s.course_id
						WHERE s.id = $1
					`
					_ = tx.QueryRowContext(ctx, query, ev.SectionID).Scan(&courseCode)
				}
				_ = tx.Rollback()
			}

			if courseCode == "" {
				courseCode = "your course"
			}

			title := "Attendance Warning!"
			body := fmt.Sprintf("Your attendance in %s has dropped to %.2f%%, falling below the required %.2f%% threshold.", 
				courseCode, ev.CurrentPct, ev.ThresholdPct)

			_ = c.notifier.SendPushNotification(ctx, ev.StudentID, title, body)
		}
	}()
}

func (c *Consumer) notifyEnrolledStudents(ctx context.Context, ev event.SessionStartedEvent) error {
	tx, err := c.dbConn.BeginTx(ctx, &sql.TxOptions{ReadOnly: true})
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if err := db.WithTenant(tx, ev.CollegeID); err != nil {
		return err
	}

	var courseCode string
	err = tx.QueryRowContext(ctx, `
		SELECT c.code 
		FROM sections s 
		JOIN courses c ON c.id = s.course_id 
		WHERE s.id = $1
	`, ev.SectionID).Scan(&courseCode)
	if err != nil {
		return err
	}

	rows, err := tx.QueryContext(ctx, "SELECT student_id FROM enrollments WHERE section_id = $1", ev.SectionID)
	if err != nil {
		return err
	}
	defer rows.Close()

	var studentIDs []string
	for rows.Next() {
		var sID string
		if err := rows.Scan(&sID); err == nil {
			studentIDs = append(studentIDs, sID)
		}
	}

	title := "Class Session Active"
	body := fmt.Sprintf("The attendance session for %s is now active. Please check in.", courseCode)

	for _, studentID := range studentIDs {
		_ = c.notifier.SendPushNotification(ctx, studentID, title, body)
	}

	return nil
}

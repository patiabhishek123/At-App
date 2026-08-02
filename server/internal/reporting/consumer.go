package reporting

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"atapp/internal/event"
	"github.com/segmentio/kafka-go"
)

// Consumer listens for attendance recorded events from Kafka and triggers aggregates recalculation.
type Consumer struct {
	reader  *kafka.Reader
	updater *Updater
}

// NewConsumer initializes a consumer group listening to the specified topic.
func NewConsumer(brokers []string, topic string, updater *Updater) *Consumer {
	return &Consumer{
		reader: kafka.NewReader(kafka.ReaderConfig{
			Brokers:  brokers,
			GroupID:  "reporting-aggregates-group",
			Topic:    topic,
			MinBytes: 10,
			MaxBytes: 10e6, // 10MB
		}),
		updater: updater,
	}
}

// Start spawns a background goroutine to process events until context cancellation.
func (c *Consumer) Start(ctx context.Context) {
	log.Printf("Starting reporting consumer on topic %q...\n", c.reader.Config().Topic)
	go func() {
		defer func() {
			if err := c.reader.Close(); err != nil {
				log.Printf("Failed to close reporting consumer reader: %v\n", err)
			}
			log.Println("Reporting consumer shut down cleanly")
		}()

		for {
			m, err := c.reader.ReadMessage(ctx)
			if err != nil {
				// Exit loop cleanly if context is canceled
				if ctx.Err() != nil {
					return
				}
				log.Printf("Reporting consumer error reading message: %v. Retrying in 2 seconds...\n", err)
				time.Sleep(2 * time.Second)
				continue
			}

			var ev event.AttendanceRecordedEvent
			if err := json.Unmarshal(m.Value, &ev); err != nil {
				log.Printf("Reporting consumer error unmarshaling payload: %v\n", err)
				continue
			}

			log.Printf("[Event Consumer] Received attendance outcome: RecordID=%s, StudentID=%s, SectionID=%s, Status=%s\n",
				ev.RecordID, ev.StudentID, ev.SectionID, ev.Status)

			err = c.updater.UpdateAggregate(ctx, ev.CollegeID, ev.StudentID, ev.SectionID)
			if err != nil {
				log.Printf("Reporting consumer error updating aggregates: %v\n", err)
			}
		}
	}()
}

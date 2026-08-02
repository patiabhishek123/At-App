package event

import (
	"context"
	"encoding/json"
	"fmt"
	"log"

	"github.com/segmentio/kafka-go"
)

// EventBus defines the interface for publishing events to a message broker.
type EventBus interface {
	Publish(ctx context.Context, topic string, key string, value interface{}) error
	Close() error
}

// KafkaEventBus implements EventBus using Redpanda/Kafka.
type KafkaEventBus struct {
	writer *kafka.Writer
}

// NewKafkaEventBus creates a new KafkaEventBus instance.
func NewKafkaEventBus(brokers []string) *KafkaEventBus {
	return &KafkaEventBus{
		writer: &kafka.Writer{
			Addr:     kafka.TCP(brokers...),
			Balancer: &kafka.LeastBytes{},
		},
	}
}

// Publish serializes and writes a message to the specified Kafka topic.
func (k *KafkaEventBus) Publish(ctx context.Context, topic string, key string, value interface{}) error {
	bytes, err := json.Marshal(value)
	if err != nil {
		return fmt.Errorf("failed to marshal event value: %w", err)
	}

	err = k.writer.WriteMessages(ctx, kafka.Message{
		Topic: topic,
		Key:   []byte(key),
		Value: bytes,
	})
	if err != nil {
		return fmt.Errorf("failed to write message to topic %s: %w", topic, err)
	}
	return nil
}

// Close releases the Kafka writer resource.
func (k *KafkaEventBus) Close() error {
	return k.writer.Close()
}

// NoOpEventBus acts as a mock/noop event bus for test runs and fallback configurations.
type NoOpEventBus struct{}

// NewNoOpEventBus instantiates a NoOpEventBus.
func NewNoOpEventBus() *NoOpEventBus {
	return &NoOpEventBus{}
}

// Publish logs the event locally without sending to Kafka.
func (n *NoOpEventBus) Publish(ctx context.Context, topic string, key string, value interface{}) error {
	log.Printf("[NoOpEventBus] Publish: Topic=%q Key=%q Value=%+v\n", topic, key, value)
	return nil
}

// Close is a no-op close method.
func (n *NoOpEventBus) Close() error {
	return nil
}

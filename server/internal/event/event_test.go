package event

import (
	"context"
	"testing"
)

func TestNoOpEventBus_PublishAndClose(t *testing.T) {
	bus := NewNoOpEventBus()

	if err := bus.Publish(context.Background(), "session.started", "some-key", map[string]string{"foo": "bar"}); err != nil {
		t.Fatalf("expected NoOpEventBus.Publish to never error, got: %v", err)
	}

	if err := bus.Close(); err != nil {
		t.Fatalf("expected NoOpEventBus.Close to never error, got: %v", err)
	}
}

func TestKafkaEventBus_ImplementsEventBus(t *testing.T) {
	// Compile-time-ish check that both implementations satisfy the
	// interface the rest of the app depends on.
	var _ EventBus = (*KafkaEventBus)(nil)
	var _ EventBus = (*NoOpEventBus)(nil)
}

func TestNewKafkaEventBus_Close(t *testing.T) {
	// Constructing and closing a KafkaEventBus should not require an actual
	// broker connection (segmentio/kafka-go connects lazily on first write).
	bus := NewKafkaEventBus([]string{"localhost:1"})
	if err := bus.Close(); err != nil {
		t.Fatalf("expected Close to succeed without ever writing, got: %v", err)
	}
}

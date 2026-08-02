package notification

import (
	"context"
	"log"
)

// Notifier defines the interface for dispatching push notifications to users.
type Notifier interface {
	SendPushNotification(ctx context.Context, userID, title, body string) error
}

// ConsoleNotifier prints push notification alerts to standard output.
type ConsoleNotifier struct{}

// NewConsoleNotifier instantiates a ConsoleNotifier.
func NewConsoleNotifier() *ConsoleNotifier {
	return &ConsoleNotifier{}
}

// SendPushNotification logs push payloads to the console.
func (c *ConsoleNotifier) SendPushNotification(ctx context.Context, userID, title, body string) error {
	log.Printf("[PUSH NOTIFICATION] UserID=%s | Title=%q | Body=%q\n", userID, title, body)
	return nil
}

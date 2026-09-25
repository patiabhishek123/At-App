package notification

import (
	"context"
	"log"
)

// Notifier defines the interface for dispatching push notifications to users.
type Notifier interface {
	SendPushNotification(ctx context.Context, collegeID, userID, title, body string) error
}

// ConsoleNotifier prints push notification alerts to standard output.
// Used when no real push provider (e.g. FCM) is configured.
type ConsoleNotifier struct{}

// NewConsoleNotifier instantiates a ConsoleNotifier.
func NewConsoleNotifier() *ConsoleNotifier {
	return &ConsoleNotifier{}
}

// SendPushNotification logs push payloads to the console.
func (c *ConsoleNotifier) SendPushNotification(ctx context.Context, collegeID, userID, title, body string) error {
	log.Printf("[PUSH NOTIFICATION] CollegeID=%s UserID=%s | Title=%q | Body=%q\n", collegeID, userID, title, body)
	return nil
}

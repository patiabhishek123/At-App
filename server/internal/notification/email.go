package notification

import (
	"context"
	"fmt"
	"log"
	"net/smtp"
)

// EmailSender delivers transactional emails (e.g. password resets, account
// verification) to a single recipient.
type EmailSender interface {
	SendEmail(ctx context.Context, to, subject, body string) error
}

// ConsoleEmailSender logs emails instead of sending them. Used when no SMTP
// server is configured (e.g. local development).
type ConsoleEmailSender struct{}

// NewConsoleEmailSender instantiates a ConsoleEmailSender.
func NewConsoleEmailSender() *ConsoleEmailSender {
	return &ConsoleEmailSender{}
}

// SendEmail logs the email payload to the console.
func (c *ConsoleEmailSender) SendEmail(ctx context.Context, to, subject, body string) error {
	log.Printf("[EMAIL] to=%s subject=%q body=%q\n", to, subject, body)
	return nil
}

// SMTPConfig holds the connection details for an outbound SMTP relay.
type SMTPConfig struct {
	Host     string
	Port     string
	Username string
	Password string
	From     string
}

// SMTPEmailSender sends real emails over SMTP using PLAIN auth.
type SMTPEmailSender struct {
	cfg SMTPConfig
}

// NewSMTPEmailSender instantiates an SMTPEmailSender from the given config.
func NewSMTPEmailSender(cfg SMTPConfig) *SMTPEmailSender {
	return &SMTPEmailSender{cfg: cfg}
}

// SendEmail sends a plain-text email over SMTP. The context is not honored
// mid-flight by net/smtp; callers should still pass it for future-proofing
// and for cancellation before the call begins.
func (s *SMTPEmailSender) SendEmail(ctx context.Context, to, subject, body string) error {
	if err := ctx.Err(); err != nil {
		return err
	}

	addr := fmt.Sprintf("%s:%s", s.cfg.Host, s.cfg.Port)
	auth := smtp.PlainAuth("", s.cfg.Username, s.cfg.Password, s.cfg.Host)

	msg := fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: %s\r\nContent-Type: text/plain; charset=\"utf-8\"\r\n\r\n%s\r\n",
		s.cfg.From, to, subject, body)

	if err := smtp.SendMail(addr, auth, s.cfg.From, []string{to}, []byte(msg)); err != nil {
		return fmt.Errorf("failed to send email via SMTP: %w", err)
	}
	return nil
}

// NewEmailSenderFromConfig returns a real SMTP sender if SMTP is configured
// (host is non-empty), otherwise falls back to logging emails to the console.
func NewEmailSenderFromConfig(cfg SMTPConfig) EmailSender {
	if cfg.Host == "" {
		log.Println("[EMAIL] no SMTP host configured; emails will be logged instead of sent")
		return NewConsoleEmailSender()
	}
	return NewSMTPEmailSender(cfg)
}

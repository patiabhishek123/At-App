package db

import (
	"context"
	"fmt"

	"github.com/redis/go-redis/v9"
)

// ConnectRedis initializes a Redis client and verifies the connection.
func ConnectRedis(addr string) (*redis.Client, error) {
	rdb := redis.NewClient(&redis.Options{
		Addr: addr,
	})

	// Verify connection with Ping
	ctx := context.Background()
	if err := rdb.Ping(ctx).Err(); err != nil {
		rdb.Close()
		return nil, fmt.Errorf("failed to ping Redis at %s: %w", addr, err)
	}

	return rdb, nil
}

# syntax=docker/dockerfile:1

# --- Build stage ---
FROM golang:1.25-alpine AS builder

WORKDIR /src

# Cache dependency downloads separately from source changes.
COPY go.mod go.sum ./
RUN go mod download

COPY . .

# CGO_ENABLED=0 for a fully static binary (all deps here are pure Go),
# so the runtime image can be a minimal, shell-less distroless base.
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /out/atapp .

# --- Runtime stage ---
FROM gcr.io/distroless/static-debian12:nonroot

WORKDIR /

COPY --from=builder /out/atapp /atapp

# Database migrations are embedded into the binary (db/migrate.go's
# go:embed), so no SQL files need to be copied here.

USER nonroot:nonroot

EXPOSE 8080

ENTRYPOINT ["/atapp"]

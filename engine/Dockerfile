# ─────────────────────────────────────────────────────────────────────────────
# Multi-stage Dockerfile — Lelu Authorization Engine
# Stage 1: build a static binary
# Stage 2: minimal distroless runtime image
# ─────────────────────────────────────────────────────────────────────────────

# ── Builder ───────────────────────────────────────────────────────────────────
FROM golang:1.24-alpine AS builder

# Install git + ca-certs (needed for go module downloads over HTTPS)
RUN apk add --no-cache git ca-certificates tzdata

ENV GOPROXY=https://proxy.golang.org,direct
ENV GOTOOLCHAIN=auto

WORKDIR /build

# Cache dependency downloads separately from source changes.
COPY engine/go.mod engine/go.sum ./
RUN go mod download

# Copy source
COPY engine/ .

# Ensure all dependencies are properly tracked
RUN go mod tidy

# Build a fully static binary
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -ldflags="-s -w -extldflags '-static'" \
    -o /engine ./cmd/engine

# ── Runtime ───────────────────────────────────────────────────────────────────
# Using alpine (already pulled) instead of distroless to avoid gcr.io network
# dependency. Alpine adds ~8 MB but is available from Docker Hub.
FROM alpine:3.19 AS runtime

RUN apk add --no-cache ca-certificates tzdata && \
    adduser -D -u 10001 nonroot

USER nonroot:nonroot

# Copy binary from builder
COPY --from=builder /engine /engine

# Default policy mount point
VOLUME ["/etc/lelu"]

EXPOSE 8080

ENTRYPOINT ["/engine"]

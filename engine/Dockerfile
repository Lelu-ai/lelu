# ─────────────────────────────────────────────────────────────────────────────
# Multi-stage Dockerfile — Lelu Authorization Engine
# Stage 1: build a static binary
# Stage 2: minimal distroless runtime image
# ─────────────────────────────────────────────────────────────────────────────

# ── Builder ───────────────────────────────────────────────────────────────────
FROM golang:1.24-alpine AS builder

# Install ca-certs (no git or network downloads needed — using vendor/)
RUN apk add --no-cache ca-certificates tzdata

ENV GOTOOLCHAIN=auto

WORKDIR /build

# Copy source + pre-vendored dependencies (no network access required)
COPY engine/ .

# Build a fully static binary using the vendor directory
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -mod=vendor -ldflags="-s -w -extldflags '-static'" \
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

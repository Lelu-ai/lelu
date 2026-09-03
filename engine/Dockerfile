# ─────────────────────────────────────────────────────────────────────────────
# Multi-stage Dockerfile — Lelu Authorization Engine
# Stage 1: build the binary (cgo enabled — see below)
# Stage 2: minimal alpine runtime image
# ─────────────────────────────────────────────────────────────────────────────

# ── Builder ───────────────────────────────────────────────────────────────────
FROM golang:1.24-alpine AS builder

# gcc/musl-dev are required because the build is cgo-enabled.
RUN apk add --no-cache ca-certificates tzdata gcc musl-dev

ENV GOTOOLCHAIN=auto

WORKDIR /build

# Copy source + pre-vendored dependencies (no network access required)
COPY engine/ .

# CGO_ENABLED=1.
#
# go-sqlite3 compiles to a stub without cgo, so a CGO_ENABLED=0 image cannot
# open its database at all. That is not a degraded analytics feature — the
# database is what the identity registry needs, and the identity registry is
# what /.well-known/jwks.json needs, so a no-cgo build signs audit receipts
# with a key whose public half it then serves as HTTP 503. Every receipt it
# produces is unverifiable by anyone, permanently, and the failure announces
# itself only as a warning line at boot.
#
# Still statically linked, via musl, so the runtime image needs no libc
# beyond what alpine already has.
RUN CGO_ENABLED=1 GOOS=linux GOARCH=amd64 \
    go build -mod=vendor -tags "sqlite_omit_load_extension" \
    -ldflags="-s -w -extldflags '-static'" \
    -o /engine ./cmd/engine

# ── Runtime ───────────────────────────────────────────────────────────────────
# Using alpine (already pulled) instead of distroless to avoid gcr.io network
# dependency. Alpine adds ~8 MB but is available from Docker Hub.
FROM alpine:3.19 AS runtime

# /var/lib is root-owned 0755, so the engine's MkdirAll of /var/lib/lelu as uid
# 10001 failed deterministically — not environmentally. Without that directory
# the RSA signing key is never persisted (a new kid every restart), the database
# never opens, and the audit chain restarts at genesis on every boot. Create it
# here and hand it to the runtime user.
RUN apk add --no-cache ca-certificates tzdata && \
    adduser -D -u 10001 nonroot && \
    mkdir -p /var/lib/lelu && \
    chown 10001:10001 /var/lib/lelu

USER nonroot:nonroot

# Copy binary from builder
COPY --from=builder /engine /engine

# Default policy mount point
VOLUME ["/etc/lelu"]

# Durable state: RSA signing key, behavioral analytics database, and the audit
# chain continuity file. Mount a real volume here — an anonymous volume works
# but is easy to discard, and discarding it silently resets the receipt chain.
VOLUME ["/var/lib/lelu"]

EXPOSE 8080

ENTRYPOINT ["/engine"]

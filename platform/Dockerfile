# ── Build stage ────────────────────────────────────────────────────────────────
FROM golang:1.22-alpine AS builder

ENV GOTOOLCHAIN=local

WORKDIR /src
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -mod=vendor \
    -ldflags="-s -w" \
    -o /platform ./cmd/api

# ── Runtime stage ──────────────────────────────────────────────────────────────
FROM alpine:3.19
RUN apk add --no-cache ca-certificates tzdata
COPY --from=builder /platform /platform
EXPOSE 9090
ENTRYPOINT ["/platform"]

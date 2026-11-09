// Package telemetry provides OpenTelemetry instrumentation for the engine.
package telemetry

import (
	"context"
	"fmt"
	"log"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.24.0"
	"go.opentelemetry.io/otel/trace"
)

const serviceName = "lelu-engine"

// Config holds OpenTelemetry configuration.
type Config struct {
	Enabled      bool
	OTLPEndpoint string
	SampleRate   float64
	// ServiceVersion is reported as service.version. The engine passes its
	// build version (server.Version); a hard-coded value here went stale.
	ServiceVersion string
}

// Provider wraps the OpenTelemetry tracer provider.
type Provider struct {
	tp     *sdktrace.TracerProvider
	tracer trace.Tracer
}

// InitProvider initializes OpenTelemetry with OTLP exporter.
func InitProvider(cfg Config) (*Provider, error) {
	if !cfg.Enabled {
		log.Println("telemetry: OpenTelemetry disabled")
		return &Provider{tracer: otel.Tracer(serviceName)}, nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Create OTLP trace exporter
	exporter, err := otlptrace.New(
		ctx,
		otlptracegrpc.NewClient(
			otlptracegrpc.WithEndpoint(cfg.OTLPEndpoint),
			otlptracegrpc.WithInsecure(), // Use TLS in production
		),
	)
	if err != nil {
		return nil, fmt.Errorf("telemetry: failed to create exporter: %w", err)
	}

	// Create resource with service information
	res, err := resource.New(ctx,
		resource.WithAttributes(
			semconv.ServiceName(serviceName),
			semconv.ServiceVersion(cfg.ServiceVersion),
		),
	)
	if err != nil {
		return nil, fmt.Errorf("telemetry: failed to create resource: %w", err)
	}

	// Configure sampling rate
	sampleRate := cfg.SampleRate
	if sampleRate <= 0 || sampleRate > 1 {
		sampleRate = 1.0 // Default to 100% sampling
	}

	// Create tracer provider
	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exporter),
		sdktrace.WithResource(res),
		sdktrace.WithSampler(sdktrace.TraceIDRatioBased(sampleRate)),
	)

	otel.SetTracerProvider(tp)

	log.Printf("telemetry: OpenTelemetry initialized (endpoint=%s, sample_rate=%.2f)", cfg.OTLPEndpoint, sampleRate)

	return &Provider{
		tp:     tp,
		tracer: tp.Tracer(serviceName),
	}, nil
}

// Shutdown gracefully shuts down the tracer provider.
func (p *Provider) Shutdown(ctx context.Context) error {
	if p.tp == nil {
		return nil
	}
	return p.tp.Shutdown(ctx)
}

// Tracer returns the configured tracer.
func (p *Provider) Tracer() trace.Tracer {
	return p.tracer
}

// StartSpan starts a new span with the given name and attributes.
func (p *Provider) StartSpan(ctx context.Context, name string, attrs ...attribute.KeyValue) (context.Context, trace.Span) {
	ctx, span := p.tracer.Start(ctx, name)
	if len(attrs) > 0 {
		span.SetAttributes(attrs...)
	}
	return ctx, span
}

// RecordError records an error on the span.
func RecordError(span trace.Span, err error) {
	if err != nil && span != nil {
		span.RecordError(err)
	}
}

// SetAttributes sets attributes on the span.
func SetAttributes(span trace.Span, attrs ...attribute.KeyValue) {
	if span != nil {
		span.SetAttributes(attrs...)
	}
}

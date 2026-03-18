package observability

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

// CorrelationManager manages multi-agent trace correlation
type CorrelationManager struct {
	mu            sync.RWMutex
	delegations   map[string]*DelegationChain
	swarms        map[string]*SwarmContext
	cleanupTicker *time.Ticker
	stopCleanup   chan struct{}
}

// DelegationChain represents a chain of agent delegations
type DelegationChain struct {
	ID          string
	RootAgent   string
	Chain       []string
	TraceID     string
	SpanID      string
	CreatedAt   time.Time
	LastUpdated time.Time
}

// SwarmContext represents a multi-agent swarm operation
type SwarmContext struct {
	ID           string
	Orchestrator string
	Agents       []string
	TraceID      string
	SpanID       string
	CreatedAt    time.Time
	LastUpdated  time.Time
}

// NewCorrelationManager creates a new correlation manager
func NewCorrelationManager() *CorrelationManager {
	cm := &CorrelationManager{
		delegations: make(map[string]*DelegationChain),
		swarms:      make(map[string]*SwarmContext),
		stopCleanup: make(chan struct{}),
	}

	// Start cleanup goroutine to remove old correlations
	cm.cleanupTicker = time.NewTicker(5 * time.Minute)
	go cm.cleanupLoop()

	return cm
}

// Close stops the correlation manager
func (cm *CorrelationManager) Close() {
	if cm.cleanupTicker != nil {
		cm.cleanupTicker.Stop()
	}
	close(cm.stopCleanup)
}

// StartDelegationChain starts tracking a new delegation chain
func (cm *CorrelationManager) StartDelegationChain(ctx context.Context, delegator, delegatee string) string {
	span := trace.SpanFromContext(ctx)
	if span == nil {
		return ""
	}

	spanCtx := span.SpanContext()
	chainID := fmt.Sprintf("delegation_%s_%d", delegator, time.Now().UnixNano())

	cm.mu.Lock()
	defer cm.mu.Unlock()

	chain := &DelegationChain{
		ID:          chainID,
		RootAgent:   delegator,
		Chain:       []string{delegator, delegatee},
		TraceID:     spanCtx.TraceID().String(),
		SpanID:      spanCtx.SpanID().String(),
		CreatedAt:   time.Now(),
		LastUpdated: time.Now(),
	}

	cm.delegations[chainID] = chain

	// Add correlation attributes to span
	span.SetAttributes(
		attribute.String(AttrDelegationChain, strings.Join(chain.Chain, "→")),
		attribute.String("ai.correlation.chain_id", chainID),
		attribute.String("ai.correlation.root_agent", delegator),
	)

	return chainID
}

// ExtendDelegationChain extends an existing delegation chain
func (cm *CorrelationManager) ExtendDelegationChain(ctx context.Context, chainID, newAgent string) {
	span := trace.SpanFromContext(ctx)
	if span == nil || chainID == "" {
		return
	}

	cm.mu.Lock()
	defer cm.mu.Unlock()

	chain, exists := cm.delegations[chainID]
	if !exists {
		return
	}

	chain.Chain = append(chain.Chain, newAgent)
	chain.LastUpdated = time.Now()

	// Update span with extended chain
	span.SetAttributes(
		attribute.String(AttrDelegationChain, strings.Join(chain.Chain, "→")),
		attribute.String("ai.correlation.chain_id", chainID),
		attribute.Int("ai.correlation.chain_length", len(chain.Chain)),
	)
}

// StartSwarmOperation starts tracking a swarm operation
func (cm *CorrelationManager) StartSwarmOperation(ctx context.Context, swarmID, orchestrator string, agents []string) {
	span := trace.SpanFromContext(ctx)
	if span == nil {
		return
	}

	spanCtx := span.SpanContext()

	cm.mu.Lock()
	defer cm.mu.Unlock()

	swarm := &SwarmContext{
		ID:           swarmID,
		Orchestrator: orchestrator,
		Agents:       make([]string, len(agents)),
		TraceID:      spanCtx.TraceID().String(),
		SpanID:       spanCtx.SpanID().String(),
		CreatedAt:    time.Now(),
		LastUpdated:  time.Now(),
	}
	copy(swarm.Agents, agents)

	cm.swarms[swarmID] = swarm

	// Add swarm correlation attributes
	span.SetAttributes(
		attribute.String(AttrSwarmID, swarmID),
		attribute.String("ai.swarm.orchestrator", orchestrator),
		attribute.StringSlice("ai.swarm.agents", agents),
		attribute.Int("ai.swarm.agent_count", len(agents)),
	)

	// Record swarm metrics
	RecordSwarmOperation(swarmID, "start", "success")
	UpdateSwarmAgentCount(swarmID, float64(len(agents)))
}

// AddSwarmAgent adds an agent to an existing swarm
func (cm *CorrelationManager) AddSwarmAgent(ctx context.Context, swarmID, agentID string) {
	span := trace.SpanFromContext(ctx)

	cm.mu.Lock()
	defer cm.mu.Unlock()

	swarm, exists := cm.swarms[swarmID]
	if !exists {
		return
	}

	// Check if agent is already in swarm
	for _, agent := range swarm.Agents {
		if agent == agentID {
			return
		}
	}

	swarm.Agents = append(swarm.Agents, agentID)
	swarm.LastUpdated = time.Now()

	if span != nil {
		span.SetAttributes(
			attribute.StringSlice("ai.swarm.agents", swarm.Agents),
			attribute.Int("ai.swarm.agent_count", len(swarm.Agents)),
		)
	}

	// Update metrics
	UpdateSwarmAgentCount(swarmID, float64(len(swarm.Agents)))
	RecordSwarmOperation(swarmID, "add_agent", "success")
}

// GetDelegationChain retrieves a delegation chain
func (cm *CorrelationManager) GetDelegationChain(chainID string) *DelegationChain {
	cm.mu.RLock()
	defer cm.mu.RUnlock()

	chain, exists := cm.delegations[chainID]
	if !exists {
		return nil
	}

	// Return a copy to avoid race conditions
	chainCopy := *chain
	chainCopy.Chain = make([]string, len(chain.Chain))
	copy(chainCopy.Chain, chain.Chain)

	return &chainCopy
}

// GetSwarmContext retrieves a swarm context
func (cm *CorrelationManager) GetSwarmContext(swarmID string) *SwarmContext {
	cm.mu.RLock()
	defer cm.mu.RUnlock()

	swarm, exists := cm.swarms[swarmID]
	if !exists {
		return nil
	}

	// Return a copy to avoid race conditions
	swarmCopy := *swarm
	swarmCopy.Agents = make([]string, len(swarm.Agents))
	copy(swarmCopy.Agents, swarm.Agents)

	return &swarmCopy
}

// InjectCorrelationHeaders injects correlation context into outgoing requests
func (cm *CorrelationManager) InjectCorrelationHeaders(ctx context.Context, headers map[string]string) {
	span := trace.SpanFromContext(ctx)
	if span == nil {
		return
	}

	spanCtx := span.SpanContext()
	if spanCtx.IsValid() {
		headers["X-Trace-ID"] = spanCtx.TraceID().String()
		headers["X-Span-ID"] = spanCtx.SpanID().String()
	}

	// Add delegation chain if present
	cm.mu.RLock()
	for _, chain := range cm.delegations {
		if chain.TraceID == spanCtx.TraceID().String() {
			headers["X-Delegation-Chain"] = strings.Join(chain.Chain, "→")
			headers["X-Chain-ID"] = chain.ID
			break
		}
	}

	// Add swarm context if present
	for _, swarm := range cm.swarms {
		if swarm.TraceID == spanCtx.TraceID().String() {
			headers["X-Swarm-ID"] = swarm.ID
			headers["X-Swarm-Orchestrator"] = swarm.Orchestrator
			break
		}
	}
	cm.mu.RUnlock()
}

// ExtractCorrelationHeaders extracts correlation context from incoming requests
func (cm *CorrelationManager) ExtractCorrelationHeaders(headers map[string]string) (traceID, spanID, chainID, swarmID string) {
	traceID = headers["X-Trace-ID"]
	spanID = headers["X-Span-ID"]
	chainID = headers["X-Chain-ID"]
	swarmID = headers["X-Swarm-ID"]
	return
}

// cleanupLoop periodically removes old correlation contexts
func (cm *CorrelationManager) cleanupLoop() {
	for {
		select {
		case <-cm.cleanupTicker.C:
			cm.cleanup()
		case <-cm.stopCleanup:
			return
		}
	}
}

// cleanup removes correlation contexts older than 1 hour
func (cm *CorrelationManager) cleanup() {
	cutoff := time.Now().Add(-1 * time.Hour)

	cm.mu.Lock()
	defer cm.mu.Unlock()

	// Clean up old delegations
	for id, chain := range cm.delegations {
		if chain.LastUpdated.Before(cutoff) {
			delete(cm.delegations, id)
		}
	}

	// Clean up old swarms
	for id, swarm := range cm.swarms {
		if swarm.LastUpdated.Before(cutoff) {
			delete(cm.swarms, id)
		}
	}
}

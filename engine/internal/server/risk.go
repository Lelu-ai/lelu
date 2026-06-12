package server

import (
	"fmt"
	"math"
	"os"
	"strconv"
	"strings"
	"sync"

	"github.com/lelu-auth/lelu/engine/internal/confidence"
)

type decisionOutcome int

const (
	outcomeAllow decisionOutcome = iota
	outcomeReadOnly
	outcomeReview
	outcomeDeny
)

func (o decisionOutcome) severity() int {
	switch o {
	case outcomeDeny:
		return 4
	case outcomeReview:
		return 3
	case outcomeReadOnly:
		return 2
	case outcomeAllow:
		return 1
	default:
		return 1
	}
}

func moreRestrictive(a, b decisionOutcome) decisionOutcome {
	if a.severity() >= b.severity() {
		return a
	}
	return b
}

type riskDecision struct {
	Outcome       decisionOutcome
	Reason        string
	Score         float64
	Criticality   float64
	Reliability   float64
	AnomalyFactor float64
}

type riskBandThresholds struct {
	Allow    float64
	Review   float64
	ReadOnly float64
}

type RiskConfig struct {
	LowBand  riskBandThresholds
	MidBand  riskBandThresholds
	HighBand riskBandThresholds

	HighCriticalityMin float64
	MidCriticalityMin  float64
}

func DefaultRiskConfig() RiskConfig {
	return RiskConfig{
		LowBand:  riskBandThresholds{Allow: 0.30, Review: 0.55, ReadOnly: 0.75},
		MidBand:  riskBandThresholds{Allow: 0.15, Review: 0.35, ReadOnly: 0.55},
		HighBand: riskBandThresholds{Allow: 0.08, Review: 0.22, ReadOnly: 0.40},

		HighCriticalityMin: 0.80,
		MidCriticalityMin:  0.50,
	}
}

func NewRiskConfigFromEnv() RiskConfig {
	cfg := DefaultRiskConfig()

	cfg.LowBand = loadBandFromEnv("LOW", cfg.LowBand)
	cfg.MidBand = loadBandFromEnv("MID", cfg.MidBand)
	cfg.HighBand = loadBandFromEnv("HIGH", cfg.HighBand)

	cfg.HighCriticalityMin = getEnvFloatInRange("RISK_CRITICALITY_HIGH_MIN", cfg.HighCriticalityMin, 0, 1)
	cfg.MidCriticalityMin = getEnvFloatInRange("RISK_CRITICALITY_MID_MIN", cfg.MidCriticalityMin, 0, 1)

	if cfg.MidCriticalityMin > cfg.HighCriticalityMin {
		cfg.MidCriticalityMin = cfg.HighCriticalityMin
	}

	return cfg
}

func loadBandFromEnv(prefix string, fallback riskBandThresholds) riskBandThresholds {
	b := riskBandThresholds{
		Allow:    getEnvFloatInRange("RISK_ALLOW_THRESHOLD_"+prefix, fallback.Allow, 0, 1),
		Review:   getEnvFloatInRange("RISK_REVIEW_THRESHOLD_"+prefix, fallback.Review, 0, 1),
		ReadOnly: getEnvFloatInRange("RISK_READONLY_THRESHOLD_"+prefix, fallback.ReadOnly, 0, 1),
	}

	if b.Review < b.Allow {
		b.Review = b.Allow
	}
	if b.ReadOnly < b.Review {
		b.ReadOnly = b.Review
	}
	return b
}

func getEnvFloatInRange(key string, fallback float64, minVal float64, maxVal float64) float64 {
	v, ok := os.LookupEnv(key)
	if !ok || strings.TrimSpace(v) == "" {
		return fallback
	}
	f, err := strconv.ParseFloat(v, 64)
	if err != nil {
		return fallback
	}
	if f < minVal || f > maxVal {
		return fallback
	}
	return f
}

type riskModel struct {
	cfg RiskConfig
}

func newRiskModel(cfg RiskConfig) *riskModel {
	return &riskModel{cfg: cfg}
}

func (m *riskModel) evaluate(action string, confidenceScore float64, reliability float64, anomalyFactor float64) riskDecision {
	criticality := actionCriticality(action)
	riskScore := riskScore(criticality, confidenceScore, reliability, anomalyFactor)

	allowThreshold := m.cfg.LowBand.Allow
	reviewThreshold := m.cfg.LowBand.Review
	readOnlyThreshold := m.cfg.LowBand.ReadOnly

	if criticality >= m.cfg.HighCriticalityMin {
		allowThreshold = m.cfg.HighBand.Allow
		reviewThreshold = m.cfg.HighBand.Review
		readOnlyThreshold = m.cfg.HighBand.ReadOnly
	} else if criticality >= m.cfg.MidCriticalityMin {
		allowThreshold = m.cfg.MidBand.Allow
		reviewThreshold = m.cfg.MidBand.Review
		readOnlyThreshold = m.cfg.MidBand.ReadOnly
	}

	var outcome decisionOutcome
	switch {
	case riskScore <= allowThreshold:
		outcome = outcomeAllow
	case riskScore <= reviewThreshold:
		outcome = outcomeReview
	case riskScore <= readOnlyThreshold:
		outcome = outcomeReadOnly
	default:
		outcome = outcomeDeny
	}

	return riskDecision{
		Outcome:       outcome,
		Reason:        fmt.Sprintf("risk score %.3f (criticality=%.2f, confidence=%.2f, reliability=%.2f, anomaly_factor=%.2f)", riskScore, criticality, confidenceScore, reliability, anomalyFactor),
		Score:         riskScore,
		Criticality:   criticality,
		Reliability:   reliability,
		AnomalyFactor: anomalyFactor,
	}
}

func actionCriticality(action string) float64 {
	a := strings.ToLower(strings.TrimSpace(action))

	highRisk := []string{"delete", "approve", "refund", "transfer", "payment", "wire", "revoke", "grant", "admin"}
	mediumRisk := []string{"update", "write", "create", "modify", "issue", "change"}
	lowRisk := []string{"read", "view", "list", "search", "get", "fetch"}

	for _, k := range highRisk {
		if strings.Contains(a, k) {
			return 0.90
		}
	}
	for _, k := range mediumRisk {
		if strings.Contains(a, k) {
			return 0.60
		}
	}
	for _, k := range lowRisk {
		if strings.Contains(a, k) {
			return 0.25
		}
	}

	return 0.50
}

func riskScore(criticality float64, confidenceScore float64, reliability float64, anomalyFactor float64) float64 {
	if reliability < 0 {
		reliability = 0
	}
	if reliability > 1 {
		reliability = 1
	}
	if anomalyFactor <= 0 {
		anomalyFactor = 1
	}

	base := criticality * (1 - confidenceScore)
	reliabilityMultiplier := 1 + (1 - reliability)
	risk := base * reliabilityMultiplier * anomalyFactor

	if risk < 0 {
		return 0
	}
	return math.Min(1, risk)
}

type actorStats struct {
	mu     sync.Mutex
	totals map[string]int
	denies map[string]int
}

func newActorStats() *actorStats {
	return &actorStats{
		totals: make(map[string]int),
		denies: make(map[string]int),
	}
}

func (s *actorStats) reliability(actor string) float64 {
	s.mu.Lock()
	defer s.mu.Unlock()

	total := s.totals[actor]
	if total == 0 {
		return 1.0
	}
	deny := s.denies[actor]
	rel := 1 - (float64(deny) / float64(total))
	if rel < 0 {
		return 0
	}
	if rel > 1 {
		return 1
	}
	return rel
}

func (s *actorStats) record(actor string, outcome decisionOutcome) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.totals[actor]++
	if outcome == outcomeDeny {
		s.denies[actor]++
	}
}

func confidenceOutcome(dec *confidence.Decision) decisionOutcome {
	if dec == nil {
		return outcomeAllow
	}
	switch dec.Level {
	case confidence.LevelHardDeny:
		return outcomeDeny
	case confidence.LevelRequiresHuman:
		return outcomeReview
	case confidence.LevelReadOnly:
		return outcomeReadOnly
	case confidence.LevelFullPermission:
		return outcomeAllow
	default:
		return outcomeAllow
	}
}

func evaluatorOutcome(allowed bool, requiresReview bool, downgradedScope string) decisionOutcome {
	if downgradedScope != "" {
		return outcomeReadOnly
	}
	if requiresReview {
		return outcomeReview
	}
	if allowed {
		return outcomeAllow
	}
	return outcomeDeny
}

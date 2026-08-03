package server

import (
	"fmt"
	"math"
	"os"
	"strconv"
	"strings"
	"sync"
	"unicode"

	"github.com/lelu-ai/lelu/engine/internal/confidence"
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

// riskBandThresholds are score ceilings in ascending restrictiveness order:
// Allow <= ReadOnly <= Review. ReadOnly is the softer outcome (the agent
// keeps running, scope reduced) and Review is the harder one (the agent
// stops for a human) — see decisionOutcome.severity(). Loading and
// normalization must preserve that order or the switch in evaluate() and
// severity() disagree about which of ReadOnly/Review is more restrictive.
// See https://github.com/Lelu-ai/lelu/pull/45.
type riskBandThresholds struct {
	Allow    float64
	ReadOnly float64
	Review   float64
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
		LowBand:  riskBandThresholds{Allow: 0.30, ReadOnly: 0.55, Review: 0.75},
		MidBand:  riskBandThresholds{Allow: 0.15, ReadOnly: 0.35, Review: 0.55},
		HighBand: riskBandThresholds{Allow: 0.08, ReadOnly: 0.22, Review: 0.40},

		HighCriticalityMin: 0.80,
		MidCriticalityMin:  0.50,
	}
}

// NewRiskConfigFromEnv loads risk thresholds from the environment. It
// returns an error rather than silently reordering a misconfigured band —
// see loadBandFromEnv. A silent clamp would let a deployment carrying
// pre-PR#45 RISK_REVIEW_THRESHOLD_*/RISK_READONLY_THRESHOLD_* overrides
// start up with review collapsed into read_only for that band instead of
// failing loudly, since the meaning of those two variables swapped, not
// just their recommended values. See
// https://github.com/Lelu-ai/lelu/pull/45.
func NewRiskConfigFromEnv() (RiskConfig, error) {
	cfg := DefaultRiskConfig()

	var err error
	if cfg.LowBand, err = loadBandFromEnv("LOW", cfg.LowBand); err != nil {
		return RiskConfig{}, err
	}
	if cfg.MidBand, err = loadBandFromEnv("MID", cfg.MidBand); err != nil {
		return RiskConfig{}, err
	}
	if cfg.HighBand, err = loadBandFromEnv("HIGH", cfg.HighBand); err != nil {
		return RiskConfig{}, err
	}

	cfg.HighCriticalityMin = getEnvFloatInRange("RISK_CRITICALITY_HIGH_MIN", cfg.HighCriticalityMin, 0, 1)
	cfg.MidCriticalityMin = getEnvFloatInRange("RISK_CRITICALITY_MID_MIN", cfg.MidCriticalityMin, 0, 1)

	if cfg.MidCriticalityMin > cfg.HighCriticalityMin {
		cfg.MidCriticalityMin = cfg.HighCriticalityMin
	}

	return cfg, nil
}

func loadBandFromEnv(prefix string, fallback riskBandThresholds) (riskBandThresholds, error) {
	b := riskBandThresholds{
		Allow:    getEnvFloatInRange("RISK_ALLOW_THRESHOLD_"+prefix, fallback.Allow, 0, 1),
		ReadOnly: getEnvFloatInRange("RISK_READONLY_THRESHOLD_"+prefix, fallback.ReadOnly, 0, 1),
		Review:   getEnvFloatInRange("RISK_REVIEW_THRESHOLD_"+prefix, fallback.Review, 0, 1),
	}

	if b.ReadOnly < b.Allow || b.Review < b.ReadOnly {
		return riskBandThresholds{}, fmt.Errorf(
			"risk band %s misconfigured: need RISK_ALLOW_THRESHOLD_%s (%.4f) <= RISK_READONLY_THRESHOLD_%s (%.4f) <= RISK_REVIEW_THRESHOLD_%s (%.4f) — "+
				"if these were set before PR #45, note RISK_REVIEW_THRESHOLD_%s and RISK_READONLY_THRESHOLD_%s swapped meaning, they didn't just get new recommended values",
			prefix, prefix, b.Allow, prefix, b.ReadOnly, prefix, b.Review, prefix, prefix,
		)
	}
	return b, nil
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

// riskScoreEpsilon absorbs float64 representation error at exact band
// boundaries — e.g. 0.5*(1-0.70) computes to 0.15000000000000002, a hair
// above the literal 0.15 threshold, which would review at confidence 0.70
// and allow at 0.71 for no reason anyone configured. See
// https://github.com/Lelu-ai/lelu/issues/44.
const riskScoreEpsilon = 1e-9

func (m *riskModel) evaluate(action string, confidenceScore float64, reliability float64, anomalyFactor float64) riskDecision {
	criticality := actionCriticality(action)
	riskScore := riskScore(criticality, confidenceScore, reliability, anomalyFactor)

	allowThreshold := m.cfg.LowBand.Allow
	readOnlyThreshold := m.cfg.LowBand.ReadOnly
	reviewThreshold := m.cfg.LowBand.Review

	if criticality >= m.cfg.HighCriticalityMin {
		allowThreshold = m.cfg.HighBand.Allow
		readOnlyThreshold = m.cfg.HighBand.ReadOnly
		reviewThreshold = m.cfg.HighBand.Review
	} else if criticality >= m.cfg.MidCriticalityMin {
		allowThreshold = m.cfg.MidBand.Allow
		readOnlyThreshold = m.cfg.MidBand.ReadOnly
		reviewThreshold = m.cfg.MidBand.Review
	}

	// Ascending restrictiveness order must match decisionOutcome.severity()
	// (allow < readOnly < review < deny), not the reverse — see the
	// riskBandThresholds doc comment. See https://github.com/Lelu-ai/lelu/pull/45.
	var outcome decisionOutcome
	switch {
	case riskScore <= allowThreshold+riskScoreEpsilon:
		outcome = outcomeAllow
	case riskScore <= readOnlyThreshold+riskScoreEpsilon:
		outcome = outcomeReadOnly
	case riskScore <= reviewThreshold+riskScoreEpsilon:
		outcome = outcomeReview
	default:
		outcome = outcomeDeny
	}

	reason := fmt.Sprintf("risk score %.3f (criticality=%.2f, confidence=%.2f, reliability=%.2f, anomaly_factor=%.2f)", riskScore, criticality, confidenceScore, reliability, anomalyFactor)

	// Criticality floor: the risk score is criticality * (1-confidence) * ...,
	// so a high enough confidence always drives the score toward zero
	// regardless of criticality — the band-threshold ratio (0.30/0.08=3.75)
	// nearly cancels the criticality ratio (0.90/0.25=3.6) besides, so the
	// score alone stops reflecting what the action actually does well before
	// confidence reaches 1.0. For the highest-criticality tier, never let the
	// outcome go below review no matter how confident the model claims to be.
	// See https://github.com/Lelu-ai/lelu/issues/44.
	if criticality >= m.cfg.HighCriticalityMin {
		floored := moreRestrictive(outcome, outcomeReview)
		if floored != outcome {
			outcome = floored
			reason += " — floored to review: criticality at or above the high-criticality threshold is never auto-allowed or read-only-only, regardless of confidence"
		}
	}

	return riskDecision{
		Outcome:       outcome,
		Reason:        reason,
		Score:         riskScore,
		Criticality:   criticality,
		Reliability:   reliability,
		AnomalyFactor: anomalyFactor,
	}
}

const (
	criticalityHigh    = 0.90
	criticalityMedium  = 0.60
	criticalityLow     = 0.25
	criticalityDefault = 0.50
)

// actionCriticalityTiers enumerates every criticality value actionCriticality
// can return, in ascending order, each paired with one representative action
// that resolves to it. TestRiskModel_CriticalityMonotone iterates this slice
// directly instead of a hand-maintained copy, so a tier added here is
// automatically covered by the monotonicity property — the 0.60 mediumRisk
// tier previously escaped that test simply because nobody remembered to add
// it to a second, separate list. See https://github.com/Lelu-ai/lelu/pull/45.
var actionCriticalityTiers = []struct {
	Action      string
	Criticality float64
}{
	{"read_public_doc", criticalityLow},
	{"restart_service", criticalityDefault},
	{"update_record", criticalityMedium},
	{"delete_record", criticalityHigh},
}

// actionKeywordToken reports whether any of keywords appears as a whole
// token in action, splitting on any non-alphanumeric rune. Whole-token
// matching (rather than raw substring containment) avoids false positives
// where a short keyword like "drop" or "exec" is embedded in an unrelated
// word with no delimiter nearby — read_dropbox_file and list_execution_logs
// are not high-criticality just because "dropbox" and "execution" happen to
// contain those substrings. This does not help when the keyword genuinely
// is its own delimited word with an unintended meaning — "root" in
// view_root_cause_report still matches, since "root_cause" really is a
// standalone "root" token; that's a keyword-taxonomy problem, not a
// tokenization one. See https://github.com/Lelu-ai/lelu/pull/45.
func actionKeywordToken(action string, keywords []string) bool {
	tokens := strings.FieldsFunc(action, func(r rune) bool {
		return !unicode.IsLetter(r) && !unicode.IsDigit(r)
	})
	for _, tok := range tokens {
		for _, k := range keywords {
			if tok == k {
				return true
			}
		}
	}
	return false
}

func actionCriticality(action string) float64 {
	a := strings.ToLower(strings.TrimSpace(action))

	// disable/drop/shell/exec/sudo/root cover security-control-disabling and
	// destructive-infrastructure actions (disable_mfa, drop_table,
	// execute_shell, ...) that don't contain any of the original keywords
	// and were silently inheriting the medium-criticality default — see
	// https://github.com/Lelu-ai/lelu/issues/44.
	highRisk := []string{
		"delete", "approve", "refund", "transfer", "payment", "wire", "revoke", "grant", "admin",
		"disable", "drop", "shell", "exec", "sudo", "root",
	}
	mediumRisk := []string{"update", "write", "create", "modify", "issue", "change"}
	lowRisk := []string{"read", "view", "list", "search", "get", "fetch"}

	if actionKeywordToken(a, highRisk) {
		return criticalityHigh
	}
	if actionKeywordToken(a, mediumRisk) {
		return criticalityMedium
	}
	if actionKeywordToken(a, lowRisk) {
		return criticalityLow
	}

	return criticalityDefault
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

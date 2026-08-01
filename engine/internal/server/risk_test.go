package server

import "testing"

func TestNewRiskConfigFromEnv_Defaults(t *testing.T) {
	t.Setenv("RISK_ALLOW_THRESHOLD_LOW", "")
	t.Setenv("RISK_REVIEW_THRESHOLD_LOW", "")
	t.Setenv("RISK_READONLY_THRESHOLD_LOW", "")

	cfg := NewRiskConfigFromEnv()
	def := DefaultRiskConfig()

	if cfg.LowBand.Allow != def.LowBand.Allow {
		t.Fatalf("expected default low allow threshold %.2f, got %.2f", def.LowBand.Allow, cfg.LowBand.Allow)
	}
	if cfg.HighBand.Review != def.HighBand.Review {
		t.Fatalf("expected default high review threshold %.2f, got %.2f", def.HighBand.Review, cfg.HighBand.Review)
	}
}

func TestNewRiskConfigFromEnv_OverridesAndNormalizes(t *testing.T) {
	t.Setenv("RISK_ALLOW_THRESHOLD_HIGH", "0.05")
	t.Setenv("RISK_REVIEW_THRESHOLD_HIGH", "0.04")
	t.Setenv("RISK_READONLY_THRESHOLD_HIGH", "0.03")
	t.Setenv("RISK_CRITICALITY_MID_MIN", "0.9")
	t.Setenv("RISK_CRITICALITY_HIGH_MIN", "0.8")

	cfg := NewRiskConfigFromEnv()

	if cfg.HighBand.Allow != 0.05 {
		t.Fatalf("expected high-band allow override 0.05, got %.2f", cfg.HighBand.Allow)
	}
	if cfg.HighBand.Review < cfg.HighBand.Allow {
		t.Fatalf("expected review >= allow, got review=%.2f allow=%.2f", cfg.HighBand.Review, cfg.HighBand.Allow)
	}
	if cfg.HighBand.ReadOnly < cfg.HighBand.Review {
		t.Fatalf("expected read_only >= review, got read_only=%.2f review=%.2f", cfg.HighBand.ReadOnly, cfg.HighBand.Review)
	}
	if cfg.MidCriticalityMin > cfg.HighCriticalityMin {
		t.Fatalf("expected mid criticality <= high criticality, got mid=%.2f high=%.2f", cfg.MidCriticalityMin, cfg.HighCriticalityMin)
	}
}

package shadow

import "testing"

func TestFingerprintDeterministic(t *testing.T) {
    req := map[string]interface{}{
        "user_agent":     "lelu-test-agent/1.0",
        "api_key_prefix": "sk_test_123",
        "actor":          "invoice_bot",
    }
    fp1 := Fingerprint(req)
    fp2 := Fingerprint(req)
    if fp1 == "" {
        t.Fatal("empty fingerprint")
    }
    if fp1 != fp2 {
        t.Fatalf("fingerprints differ: %s != %s", fp1, fp2)
    }
}

func TestDetectShadowAgent(t *testing.T) {
    req := map[string]interface{}{
        "user_agent":     "unknown-agent/1.0",
        "api_key_prefix": "sk_unknown",
        "actor":          "shadow_bot",
    }
    registry := map[string]bool{} // empty registry
    reporter := NewReporter(nil)
    detector := New(registry, reporter)

    result, err := detector.Detect(req)
    if err != nil {
        t.Fatalf("detect failed: %v", err)
    }
    if !result.IsShadow {
        t.Fatal("expected shadow, got registered")
    }
    if result.Fingerprint == "" {
        t.Fatal("empty fingerprint in result")
    }
}

func TestDetectRegisteredAgent(t *testing.T) {
    req := map[string]interface{}{
        "user_agent":     "lelu-approved/1.0",
        "api_key_prefix": "sk_app_legit",
        "actor":          "approved_bot",
    }
    fp := Fingerprint(req)
    registry := map[string]bool{fp: true}
    reporter := NewReporter(nil)
    detector := New(registry, reporter)

    result, err := detector.Detect(req)
    if err != nil {
        t.Fatalf("detect failed: %v", err)
    }
    if result.IsShadow {
        t.Fatal("expected registered, got shadow")
    }
    if result.Reason != "fingerprint registered" {
        t.Fatalf("unexpected reason: %s", result.Reason)
    }
}

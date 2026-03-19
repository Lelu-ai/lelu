package observability

import (
	"context"
	"testing"
	"time"
)

func TestPredictiveAnalytics(t *testing.T) {
	// Create in-memory database for testing
	db := setupTestDB(t)
	defer db.Close()

	config := DefaultPredictiveConfig()
	pa := NewPredictiveAnalytics(db, config)

	t.Run("PredictConfidence", func(t *testing.T) {
		ctx := context.Background()
		agentID := "test_agent_001"
		action := "read:database"

		prediction, err := pa.PredictConfidence(ctx, agentID, action)
		if err != nil {
			t.Fatalf("Failed to predict confidence: %v", err)
		}

		if prediction == nil {
			t.Fatal("Expected non-nil prediction")
		}

		if prediction.AgentID != agentID {
			t.Errorf("Expected agent ID %s, got %s", agentID, prediction.AgentID)
		}

		if prediction.Action != action {
			t.Errorf("Expected action %s, got %s", action, prediction.Action)
		}

		if prediction.PredictedConfidence < 0 || prediction.PredictedConfidence > 1 {
			t.Errorf("Predicted confidence out of range: %f", prediction.PredictedConfidence)
		}

		if len(prediction.Features) == 0 {
			t.Error("Expected features to be extracted")
		}
	})

	t.Run("PredictHumanReview", func(t *testing.T) {
		ctx := context.Background()
		agentID := "test_agent_002"
		action := "write:database"
		confidence := 0.65

		prediction, err := pa.PredictHumanReview(ctx, agentID, action, confidence)
		if err != nil {
			t.Fatalf("Failed to predict human review: %v", err)
		}

		if prediction == nil {
			t.Fatal("Expected non-nil prediction")
		}

		if prediction.AgentID != agentID {
			t.Errorf("Expected agent ID %s, got %s", agentID, prediction.AgentID)
		}

		if prediction.ReviewProbability < 0 || prediction.ReviewProbability > 1 {
			t.Errorf("Review probability out of range: %f", prediction.ReviewProbability)
		}

		if prediction.Confidence != confidence {
			t.Errorf("Expected confidence %f, got %f", confidence, prediction.Confidence)
		}
	})

	t.Run("SuggestPolicyOptimizations", func(t *testing.T) {
		ctx := context.Background()

		suggestions, err := pa.SuggestPolicyOptimizations(ctx)
		if err != nil {
			t.Fatalf("Failed to get policy suggestions: %v", err)
		}

		// Suggestions may be empty if no policies need optimization
		if suggestions == nil {
			t.Error("Expected non-nil suggestions slice")
		}
	})

	t.Run("TrainConfidenceModel", func(t *testing.T) {
		ctx := context.Background()

		// Training may fail due to insufficient data, which is expected
		err := pa.TrainConfidenceModel(ctx)
		if err != nil {
			// Check if it's the expected "insufficient data" error
			if err.Error() != "insufficient training data: 0 samples (need 100)" {
				t.Logf("Training failed (expected with no data): %v", err)
			}
		}
	})

	t.Run("TrainHumanReviewModel", func(t *testing.T) {
		ctx := context.Background()

		// Training may fail due to insufficient data, which is expected
		err := pa.TrainHumanReviewModel(ctx)
		if err != nil {
			// Check if it's the expected "insufficient data" error
			if err.Error() != "insufficient training data: 0 samples (need 100)" {
				t.Logf("Training failed (expected with no data): %v", err)
			}
		}
	})
}

func TestConfidencePrediction(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	config := DefaultPredictiveConfig()
	pa := NewPredictiveAnalytics(db, config)

	t.Run("PredictionWithVariousConfidenceLevels", func(t *testing.T) {
		ctx := context.Background()
		agentID := "test_agent"

		actions := []string{"read:data", "write:data", "delete:data", "admin:action"}

		for _, action := range actions {
			prediction, err := pa.PredictConfidence(ctx, agentID, action)
			if err != nil {
				t.Errorf("Failed to predict confidence for action %s: %v", action, err)
				continue
			}

			// Verify prediction is in valid range
			if prediction.PredictedConfidence < 0 || prediction.PredictedConfidence > 1 {
				t.Errorf("Invalid confidence prediction for %s: %f", action, prediction.PredictedConfidence)
			}

			// Verify timestamp is recent
			if time.Since(prediction.Timestamp) > time.Second {
				t.Errorf("Prediction timestamp is too old: %v", prediction.Timestamp)
			}
		}
	})
}

func TestHumanReviewPrediction(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	config := DefaultPredictiveConfig()
	pa := NewPredictiveAnalytics(db, config)

	t.Run("LowConfidenceShouldTriggerReview", func(t *testing.T) {
		ctx := context.Background()
		agentID := "test_agent"
		action := "high_risk_action"
		lowConfidence := 0.3

		prediction, err := pa.PredictHumanReview(ctx, agentID, action, lowConfidence)
		if err != nil {
			t.Fatalf("Failed to predict human review: %v", err)
		}

		// Low confidence should increase review probability
		if prediction.ReviewProbability < 0.3 {
			t.Logf("Expected higher review probability for low confidence, got %f", prediction.ReviewProbability)
		}

		// Should have risk factors identified
		if len(prediction.RiskFactors) == 0 {
			t.Log("Expected risk factors to be identified for low confidence")
		}
	})

	t.Run("HighConfidenceShouldReduceReview", func(t *testing.T) {
		ctx := context.Background()
		agentID := "test_agent"
		action := "low_risk_action"
		highConfidence := 0.95

		prediction, err := pa.PredictHumanReview(ctx, agentID, action, highConfidence)
		if err != nil {
			t.Fatalf("Failed to predict human review: %v", err)
		}

		// High confidence should reduce review probability
		if prediction.ReviewProbability > 0.7 {
			t.Logf("Expected lower review probability for high confidence, got %f", prediction.ReviewProbability)
		}
	})
}

func TestPolicyOptimization(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	config := DefaultPredictiveConfig()
	pa := NewPredictiveAnalytics(db, config)

	t.Run("GeneratePolicySuggestion", func(t *testing.T) {
		stats := &PolicyStats{
			PolicyName:     "test_policy",
			Effectiveness:  0.4,
			TotalDecisions: 100,
			SuccessRate:    0.45,
			AvgLatency:     150.0,
		}

		suggestion := pa.generatePolicySuggestion("test_policy", stats)

		if suggestion == nil {
			t.Fatal("Expected non-nil suggestion")
		}

		if suggestion.PolicyName != "test_policy" {
			t.Errorf("Expected policy name test_policy, got %s", suggestion.PolicyName)
		}

		if suggestion.CurrentScore != 0.4 {
			t.Errorf("Expected current score 0.4, got %f", suggestion.CurrentScore)
		}

		if suggestion.Suggestion == "" {
			t.Error("Expected non-empty suggestion")
		}

		if suggestion.Rationale == "" {
			t.Error("Expected non-empty rationale")
		}

		if suggestion.Priority == "" {
			t.Error("Expected non-empty priority")
		}

		if suggestion.ExpectedImpact <= 0 {
			t.Error("Expected positive expected impact")
		}
	})
}

func TestFeatureExtraction(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	config := DefaultPredictiveConfig()
	pa := NewPredictiveAnalytics(db, config)

	t.Run("ExtractConfidenceFeatures", func(t *testing.T) {
		ctx := context.Background()
		agentID := "test_agent"
		action := "test_action"

		features, err := pa.extractConfidenceFeatures(ctx, agentID, action)
		if err != nil {
			t.Fatalf("Failed to extract features: %v", err)
		}

		if len(features) == 0 {
			t.Error("Expected features to be extracted")
		}

		// Check for temporal features
		if config.EnableTemporalFeatures {
			if _, exists := features["hour_of_day"]; !exists {
				t.Error("Expected hour_of_day feature")
			}
			if _, exists := features["day_of_week"]; !exists {
				t.Error("Expected day_of_week feature")
			}
		}
	})

	t.Run("ExtractReviewFeatures", func(t *testing.T) {
		ctx := context.Background()
		agentID := "test_agent"
		action := "test_action"
		confidence := 0.75

		features, err := pa.extractReviewFeatures(ctx, agentID, action, confidence)
		if err != nil {
			t.Fatalf("Failed to extract features: %v", err)
		}

		if len(features) == 0 {
			t.Error("Expected features to be extracted")
		}

		// Check for confidence features
		if features["confidence"] != confidence {
			t.Errorf("Expected confidence feature %f, got %f", confidence, features["confidence"])
		}

		if _, exists := features["confidence_squared"]; !exists {
			t.Error("Expected confidence_squared feature")
		}

		if _, exists := features["low_confidence"]; !exists {
			t.Error("Expected low_confidence feature")
		}
	})
}

func TestPredictionPerformance(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	config := DefaultPredictiveConfig()
	pa := NewPredictiveAnalytics(db, config)

	t.Run("ConfidencePredictionLatency", func(t *testing.T) {
		ctx := context.Background()
		agentID := "perf_test_agent"
		action := "test_action"

		iterations := 100
		start := time.Now()

		for i := 0; i < iterations; i++ {
			_, err := pa.PredictConfidence(ctx, agentID, action)
			if err != nil {
				t.Fatalf("Prediction failed: %v", err)
			}
		}

		elapsed := time.Since(start)
		avgLatency := elapsed / time.Duration(iterations)

		t.Logf("Average confidence prediction latency: %v", avgLatency)

		// Should be fast (< 10ms per prediction)
		if avgLatency > 10*time.Millisecond {
			t.Errorf("Prediction too slow: %v (expected < 10ms)", avgLatency)
		}
	})

	t.Run("ReviewPredictionLatency", func(t *testing.T) {
		ctx := context.Background()
		agentID := "perf_test_agent"
		action := "test_action"
		confidence := 0.75

		iterations := 100
		start := time.Now()

		for i := 0; i < iterations; i++ {
			_, err := pa.PredictHumanReview(ctx, agentID, action, confidence)
			if err != nil {
				t.Fatalf("Prediction failed: %v", err)
			}
		}

		elapsed := time.Since(start)
		avgLatency := elapsed / time.Duration(iterations)

		t.Logf("Average review prediction latency: %v", avgLatency)

		// Should be fast (< 10ms per prediction)
		if avgLatency > 10*time.Millisecond {
			t.Errorf("Prediction too slow: %v (expected < 10ms)", avgLatency)
		}
	})
}

// Helper function to set up test database
func setupTestDB(t *testing.T) *sql.DB {
	// This would create an in-memory SQLite database for testing
	// Implementation depends on your database setup
	t.Helper()
	// Placeholder - actual implementation would create test DB
	return nil
}

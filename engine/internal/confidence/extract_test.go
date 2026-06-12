package confidence_test

import (
	"math"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/lelu-auth/lelu/engine/internal/confidence"
)

func TestExtractScore_OpenAILogProbs(t *testing.T) {
	score, err := confidence.ExtractScore(&confidence.Signal{
		Provider:      confidence.ProviderOpenAI,
		TokenLogProbs: []float64{-0.01, -0.03, -0.02},
	})
	require.NoError(t, err)
	assert.Greater(t, score, 0.95)
	assert.LessOrEqual(t, score, 1.0)
}

func TestExtractScore_LocalProbabilities(t *testing.T) {
	score, err := confidence.ExtractScore(&confidence.Signal{
		Provider:           confidence.ProviderLocal,
		TokenProbabilities: []float64{0.9, 0.8, 0.7},
	})
	require.NoError(t, err)
	assert.InDelta(t, 0.8, score, 0.0001)
}

func TestExtractScore_LocalEntropy(t *testing.T) {
	entropy := 0.2
	entropyMax := 1.0
	score, err := confidence.ExtractScore(&confidence.Signal{
		Provider:   confidence.ProviderLocal,
		Entropy:    &entropy,
		EntropyMax: &entropyMax,
	})
	require.NoError(t, err)
	assert.InDelta(t, 0.8, score, 0.0001)
}

func TestExtractScore_InvalidProvider(t *testing.T) {
	_, err := confidence.ExtractScore(&confidence.Signal{Provider: "custom"})
	assert.Error(t, err)
}

func TestExtractScore_NonFinite(t *testing.T) {
	_, err := confidence.ExtractScore(&confidence.Signal{
		Provider:      confidence.ProviderOpenAI,
		TokenLogProbs: []float64{math.NaN()},
	})
	assert.Error(t, err)
}

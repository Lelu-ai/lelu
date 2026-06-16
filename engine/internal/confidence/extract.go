package confidence

import (
	"fmt"
	"math"
)

type Provider string

const (
	ProviderOpenAI    Provider = "openai"
	ProviderAnthropic Provider = "anthropic"
	ProviderBedrock   Provider = "bedrock"
	ProviderLocal     Provider = "local"
)

type Signal struct {
	Provider           Provider  `json:"provider"`
	TokenLogProbs      []float64 `json:"token_logprobs,omitempty"`
	TokenProbabilities []float64 `json:"token_probabilities,omitempty"`
	Entropy            *float64  `json:"entropy,omitempty"`
	EntropyMax         *float64  `json:"entropy_max,omitempty"`
}

func ExtractScore(sig *Signal) (float64, error) {
	if sig == nil {
		return 0, fmt.Errorf("missing confidence signal")
	}

	switch sig.Provider {
	case ProviderOpenAI, ProviderAnthropic:
		return scoreFromLogProbs(sig.TokenLogProbs)
	case ProviderBedrock:
		// Amazon Bedrock fronts many model families; token-level signals are only
		// exposed by some (e.g. Cohere token likelihoods, Llama/Titan logprobs).
		// Accept whichever form the caller's model produced. Models without
		// logprobs — notably Anthropic Claude on Bedrock — cannot yield a verified
		// signal: omit the signal so MissingSignalMode decides, or derive one via
		// self-consistency sampling.
		if len(sig.TokenLogProbs) > 0 {
			return scoreFromLogProbs(sig.TokenLogProbs)
		}
		if len(sig.TokenProbabilities) > 0 {
			return scoreFromProbabilities(sig.TokenProbabilities)
		}
		return 0, fmt.Errorf("provider %q requires token_logprobs or token_probabilities; this Bedrock model may not expose them (e.g. Claude) — omit the signal to use MissingSignalMode", sig.Provider)
	case ProviderLocal:
		if len(sig.TokenProbabilities) > 0 {
			return scoreFromProbabilities(sig.TokenProbabilities)
		}
		if sig.Entropy != nil {
			maxEntropy := 1.0
			if sig.EntropyMax != nil && *sig.EntropyMax > 0 {
				maxEntropy = *sig.EntropyMax
			}
			norm := 1 - (*sig.Entropy / maxEntropy)
			if norm < 0 {
				norm = 0
			}
			if norm > 1 {
				norm = 1
			}
			return norm, nil
		}
		return 0, fmt.Errorf("provider %q requires token_probabilities or entropy", sig.Provider)
	default:
		return 0, fmt.Errorf("unsupported confidence provider %q", sig.Provider)
	}
}

func scoreFromLogProbs(values []float64) (float64, error) {
	if len(values) == 0 {
		return 0, fmt.Errorf("token_logprobs cannot be empty")
	}
	var total float64
	for _, lp := range values {
		if math.IsNaN(lp) || math.IsInf(lp, 0) {
			return 0, fmt.Errorf("token_logprobs contain non-finite values")
		}
		p := math.Exp(lp)
		if p < 0 {
			p = 0
		}
		if p > 1 {
			p = 1
		}
		total += p
	}
	return total / float64(len(values)), nil
}

func scoreFromProbabilities(values []float64) (float64, error) {
	if len(values) == 0 {
		return 0, fmt.Errorf("token_probabilities cannot be empty")
	}
	var total float64
	for _, p := range values {
		if math.IsNaN(p) || math.IsInf(p, 0) {
			return 0, fmt.Errorf("token_probabilities contain non-finite values")
		}
		if p < 0 || p > 1 {
			return 0, fmt.Errorf("token_probabilities must be in [0,1]")
		}
		total += p
	}
	return total / float64(len(values)), nil
}

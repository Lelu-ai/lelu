// Package injection provides a multi-layer prompt injection detector.
//
// Detection pipeline (fastest to slowest, stops on first hit):
//  1. Exact pattern match  — O(n) over 45 known phrases
//  2. Unicode normalization + re-scan — catches homoglyph substitutions
//  3. Fuzzy near-match    — Levenshtein ≤2 against canonical patterns
//  4. Structural analysis — roleplay frames, delimiter injection, context switching
//  5. N-gram entropy      — unusually high instruction density
//
// Total latency: < 0.3ms on modern hardware.
package injection

import (
	"math"
	"strings"
	"unicode"
)

// ─── Patterns ─────────────────────────────────────────────────────────────────

// exactPatterns are downcased canonical injection phrases.
var exactPatterns = []string{
	// Direct override
	"ignore previous instructions",
	"ignore all previous",
	"ignore all prior",
	"disregard all prior",
	"disregard previous",
	"disregard the above",
	"forget your instructions",
	"forget all previous",
	"override your instructions",
	"override policy",
	"override all policies",
	"override the above",
	// System prompt manipulation
	"system prompt",
	"new system prompt",
	"your new instructions",
	"from now on you",
	"you are now",
	// Role-play injection
	"act as if you",
	"act as a",
	"pretend you are",
	"pretend to be",
	"simulate being",
	"imagine you are",
	"roleplay as",
	"you are playing",
	// Jailbreaks
	"jailbreak",
	"do anything now",
	"dan mode",
	"developer mode enabled",
	"god mode",
	"unrestricted mode",
	// Bypass instructions
	"bypass your",
	"ignore your",
	"disregard your",
	"forget you are",
	"without restrictions",
	"no restrictions",
	"no limits",
	"unlock your",
	// Delimiter injection
	"###instruction",
	"[system]",
	"<|system|>",
	"<|im_start|>system",
	"<instructions>",
	"[instructions]",
	// Indirect / context switch
	"the following is a test",
	"this is a test of",
	"ignore safety",
	"ignore ethics",
}

// structuralIndicators are higher-weight phrases found in structured attacks.
var structuralIndicators = []string{
	"ignore",
	"disregard",
	"forget",
	"override",
	"bypass",
	"pretend",
	"roleplay",
	"simulate",
	"act as",
	"from now on",
	"your new",
	"new instructions",
	"without restriction",
}

// homoglyphMap maps common unicode lookalikes to ASCII equivalents.
var homoglyphMap = map[rune]rune{
	'і': 'i', 'ο': 'o', 'е': 'e', 'а': 'a', 'с': 'c',
	'р': 'p', 'х': 'x', 'у': 'y', 'ј': 'j', 'ԁ': 'd',
	'ɡ': 'g', 'ʜ': 'h', 'ᴋ': 'k', 'ʟ': 'l', 'ᴍ': 'm',
	'ɴ': 'n', 'ǫ': 'q', 'ʀ': 'r', 'ꜱ': 's', 'ᴛ': 't',
	'ᴠ': 'v', 'ᴡ': 'w', 'ᴢ': 'z', 'ﬁ': 'f', 'ﬂ': 'f',
	'０': '0', '１': '1', '２': '2', '３': '3', '４': '4',
}

// ─── Result ───────────────────────────────────────────────────────────────────

// Result is the output of a detection run.
type Result struct {
	Detected bool
	Pattern  string
	Source   string
	// Method is which detection layer found the injection.
	Method string
	// Score is a 0–1 confidence that this is an injection attempt.
	Score float64
}

// ─── Detector ─────────────────────────────────────────────────────────────────

// Detect runs the full injection detection pipeline against action and resource values.
func Detect(action string, resource map[string]string) Result {
	// Layer 1 + 2: exact + normalized scan on action.
	if r := fullScan(action, "action"); r.Detected {
		return r
	}

	// Layer 1 + 2: exact + normalized scan on each resource value.
	for _, v := range resource {
		if r := fullScan(v, "resource"); r.Detected {
			return r
		}
	}

	// Layer 4: structural analysis (combined text).
	combined := action
	for _, v := range resource {
		combined += " " + v
	}
	if r := structuralAnalysis(combined); r.Detected {
		return r
	}

	// Layer 5: n-gram entropy check on combined text.
	if r := entropyCheck(combined); r.Detected {
		return r
	}

	return Result{}
}

// DetectRequest runs the full pipeline across every field of an authorize
// request — action, scope, resource values, and (recursively flattened) args —
// with accurate source attribution. Detect only covers action + resource, which
// let injection hidden in args or scope bypass the filter entirely.
func DetectRequest(action, scope string, resource map[string]string, args map[string]interface{}) Result {
	if r := fullScan(action, "action"); r.Detected {
		return r
	}
	if r := fullScan(scope, "scope"); r.Detected {
		return r
	}
	for _, v := range resource {
		if r := fullScan(v, "resource"); r.Detected {
			return r
		}
	}

	argStrings := flattenArgs(args)
	for _, v := range argStrings {
		if r := fullScan(v, "args"); r.Detected {
			return r
		}
	}

	// Layers 4 + 5: structural + entropy over the combined text of all fields.
	var b strings.Builder
	b.WriteString(action)
	b.WriteString(" ")
	b.WriteString(scope)
	for _, v := range resource {
		b.WriteString(" ")
		b.WriteString(v)
	}
	for _, v := range argStrings {
		b.WriteString(" ")
		b.WriteString(v)
	}
	combined := b.String()
	if r := structuralAnalysis(combined); r.Detected {
		return r
	}
	if r := entropyCheck(combined); r.Detected {
		return r
	}

	return Result{}
}

// flattenArgs recursively collects string values from structured args so they
// can be scanned. Non-string scalars are ignored — injection lives in text.
func flattenArgs(args map[string]interface{}) []string {
	if len(args) == 0 {
		return nil
	}
	var out []string
	var walk func(v interface{})
	walk = func(v interface{}) {
		switch t := v.(type) {
		case string:
			out = append(out, t)
		case map[string]interface{}:
			for _, vv := range t {
				walk(vv)
			}
		case []interface{}:
			for _, vv := range t {
				walk(vv)
			}
		}
	}
	for _, v := range args {
		walk(v)
	}
	return out
}

// fullScan runs layers 1, 2, and 3 on a single text field.
func fullScan(text, source string) Result {
	lower := strings.ToLower(text)

	// Layer 1: exact pattern match.
	for _, p := range exactPatterns {
		if strings.Contains(lower, p) {
			return Result{
				Detected: true,
				Pattern:  p,
				Source:   source,
				Method:   "exact",
				Score:    1.0,
			}
		}
	}

	// Layer 2: normalize homoglyphs and re-scan.
	normalized := normalizeHomoglyphs(text)
	if normalized != text {
		lowerNorm := strings.ToLower(normalized)
		for _, p := range exactPatterns {
			if strings.Contains(lowerNorm, p) {
				return Result{
					Detected: true,
					Pattern:  p,
					Source:   source,
					Method:   "homoglyph",
					Score:    0.95,
				}
			}
		}
	}

	// Layer 3: fuzzy match (Levenshtein distance ≤ 2 on word n-grams).
	if r := fuzzyMatch(lower, source); r.Detected {
		return r
	}

	return Result{}
}

// normalizeHomoglyphs replaces unicode lookalikes with ASCII equivalents.
func normalizeHomoglyphs(s string) string {
	var b strings.Builder
	b.Grow(len(s))
	changed := false
	for _, r := range s {
		if mapped, ok := homoglyphMap[r]; ok {
			b.WriteRune(mapped)
			changed = true
		} else {
			b.WriteRune(r)
		}
	}
	if !changed {
		return s
	}
	return b.String()
}

// fuzzyMatch checks each 3–5 word window against canonical patterns using Levenshtein.
func fuzzyMatch(lower, source string) Result {
	words := strings.Fields(lower)
	if len(words) < 2 {
		return Result{}
	}

	// Generate bigrams and trigrams from the input.
	ngrams := make([]string, 0, len(words)*2)
	for i := 0; i < len(words)-1; i++ {
		ngrams = append(ngrams, words[i]+" "+words[i+1])
	}
	for i := 0; i < len(words)-2; i++ {
		ngrams = append(ngrams, words[i]+" "+words[i+1]+" "+words[i+2])
	}

	for _, pattern := range exactPatterns {
		patWords := strings.Fields(pattern)
		if len(patWords) < 2 {
			continue
		}
		// Only fuzzy-check patterns with ≥2 words against same-length ngrams.
		target := strings.Join(patWords, " ")
		for _, ng := range ngrams {
			if len(ng) < 4 {
				continue
			}
			dist := levenshtein(ng, target)
			maxLen := len(target)
			if maxLen < len(ng) {
				maxLen = len(ng)
			}
			// Allow up to 15% edit distance.
			if float64(dist)/float64(maxLen) <= 0.15 && dist <= 3 {
				return Result{
					Detected: true,
					Pattern:  pattern,
					Source:   source,
					Method:   "fuzzy",
					Score:    1.0 - float64(dist)/float64(maxLen),
				}
			}
		}
	}
	return Result{}
}

// structuralAnalysis detects injection via structural indicators and density.
// Two or more structural indicators in close proximity signals an attack.
func structuralAnalysis(text string) Result {
	lower := strings.ToLower(text)
	words := strings.Fields(lower)
	if len(words) < 4 {
		return Result{}
	}

	// Sliding window of 10 words, count indicator hits.
	windowSize := 10
	for i := 0; i <= len(words)-windowSize; i++ {
		window := strings.Join(words[i:i+windowSize], " ")
		hits := 0
		lastHit := ""
		for _, ind := range structuralIndicators {
			if strings.Contains(window, ind) {
				hits++
				lastHit = ind
			}
		}
		if hits >= 2 {
			return Result{
				Detected: true,
				Pattern:  lastHit,
				Source:   "combined",
				Method:   "structural",
				Score:    math.Min(float64(hits)*0.3, 1.0),
			}
		}
	}
	return Result{}
}

// entropyCheck flags text with unusually high density of imperative instruction words.
// Legitimate tool calls are short and task-specific; injections are verbose and directive.
func entropyCheck(text string) Result {
	words := strings.Fields(strings.ToLower(text))
	if len(words) < 10 {
		return Result{}
	}

	imperatives := map[string]bool{
		"ignore": true, "forget": true, "disregard": true, "override": true,
		"bypass": true, "pretend": true, "assume": true, "act": true,
		"behave": true, "respond": true, "always": true, "never": true,
		"must": true, "shall": true, "should": true, "do": true,
	}

	count := 0
	for _, w := range words {
		// Strip punctuation.
		w = strings.TrimFunc(w, func(r rune) bool { return !unicode.IsLetter(r) })
		if imperatives[w] {
			count++
		}
	}

	density := float64(count) / float64(len(words))
	if density > 0.25 && count >= 4 {
		return Result{
			Detected: true,
			Pattern:  "high-imperative-density",
			Source:   "combined",
			Method:   "entropy",
			Score:    math.Min(density*2, 1.0),
		}
	}
	return Result{}
}

// levenshtein computes the edit distance between two strings.
func levenshtein(a, b string) int {
	ra, rb := []rune(a), []rune(b)
	la, lb := len(ra), len(rb)
	if la == 0 {
		return lb
	}
	if lb == 0 {
		return la
	}

	prev := make([]int, lb+1)
	curr := make([]int, lb+1)
	for j := 0; j <= lb; j++ {
		prev[j] = j
	}
	for i := 1; i <= la; i++ {
		curr[0] = i
		for j := 1; j <= lb; j++ {
			cost := 1
			if ra[i-1] == rb[j-1] {
				cost = 0
			}
			curr[j] = minInt(curr[j-1]+1, minInt(prev[j]+1, prev[j-1]+cost))
		}
		prev, curr = curr, prev
	}
	return prev[lb]
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}

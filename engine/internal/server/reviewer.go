package server

import (
	"crypto/subtle"
	"log"
	"net/http"
	"os"
	"sort"
	"strings"
)

// ─── Reviewer credentials ─────────────────────────────────────────────────────
//
// A human_review decision is only worth something if the party who resolves it
// is provably not the party under review. Every other endpoint on this engine
// accepts one credential class, and an agent that gets flagged holds exactly
// that credential — so with nothing else in play, "who approved this" reduces
// to a string the caller puts in the request body, and the agent under review
// can approve itself by writing someone else's name in it (or, before this,
// by omitting the field entirely and being recorded as approved by nobody).
//
// A reviewer credential is a second, separate credential class that agents are
// not given. It is what makes reviewer identity an authentication fact rather
// than a claim: resolved_by is derived from the credential presented, and the
// body's value is ignored.
//
// Configured as LELU_REVIEWER_KEYS="alice:<secret>,bob:<secret>". Presented in
// the X-Lelu-Reviewer-Key header, alongside — not instead of — the ordinary
// API credential, so the endpoint stays behind the engine's normal auth and
// the reviewer credential adds identity on top of it.

const reviewerHeader = "X-Lelu-Reviewer-Key"

type reviewerRegistry struct {
	// names is the reviewer name for each configured secret. Lookup is a
	// linear constant-time comparison rather than a map index: a map lookup
	// on the secret itself is a data-dependent operation on attacker-supplied
	// input, and the list is a handful of entries.
	secrets []reviewerCredential
}

type reviewerCredential struct {
	name   string
	secret string
}

// newReviewerRegistryFromEnv builds the registry from LELU_REVIEWER_KEYS.
// Returns nil when unset, which leaves the engine in the weaker mode where
// reviewer identity is self-asserted — see handleQueueResolve.
func newReviewerRegistryFromEnv() *reviewerRegistry {
	raw := strings.TrimSpace(os.Getenv("LELU_REVIEWER_KEYS"))
	if raw == "" {
		return nil
	}
	reg := &reviewerRegistry{}
	for _, pair := range strings.Split(raw, ",") {
		pair = strings.TrimSpace(pair)
		if pair == "" {
			continue
		}
		name, secret, ok := strings.Cut(pair, ":")
		name, secret = strings.TrimSpace(name), strings.TrimSpace(secret)
		if !ok || name == "" || secret == "" {
			log.Printf("warning: ignoring malformed LELU_REVIEWER_KEYS entry (expected name:secret)")
			continue
		}
		if len(secret) < 16 {
			// A short reviewer secret is worse than none: it looks like a
			// control while being guessable.
			log.Printf("warning: ignoring reviewer credential %q — secret must be at least 16 characters", name)
			continue
		}
		reg.secrets = append(reg.secrets, reviewerCredential{name: name, secret: secret})
	}
	if len(reg.secrets) == 0 {
		return nil
	}
	sort.Slice(reg.secrets, func(i, j int) bool { return reg.secrets[i].name < reg.secrets[j].name })
	return reg
}

// resolve returns the reviewer name for a presented secret.
func (r *reviewerRegistry) resolve(presented string) (string, bool) {
	if r == nil || presented == "" {
		return "", false
	}
	name := ""
	found := false
	// No early return: comparing against every configured credential keeps
	// the work independent of which one (if any) matched.
	for _, c := range r.secrets {
		if subtle.ConstantTimeCompare([]byte(presented), []byte(c.secret)) == 1 {
			name = c.name
			found = true
		}
	}
	return name, found
}

// names lists the configured reviewer names, for startup logging. Never the
// secrets.
func (r *reviewerRegistry) names() []string {
	if r == nil {
		return nil
	}
	out := make([]string, 0, len(r.secrets))
	for _, c := range r.secrets {
		out = append(out, c.name)
	}
	return out
}

// reviewerFromRequest authenticates the reviewer credential on a request.
func (h *Handler) reviewerFromRequest(r *http.Request) (string, bool) {
	return h.reviewers.resolve(strings.TrimSpace(r.Header.Get(reviewerHeader)))
}

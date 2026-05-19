package shadow

import (
	"context"
	"database/sql"
	"log"
)

// Reporter publishes shadow-agent findings to the audit store.
// A nil db produces a no-op reporter (useful in tests).
type Reporter struct {
	store *store
}

// NewReporter returns a Reporter backed by db. Pass nil for a no-op reporter.
func NewReporter(db *sql.DB) *Reporter {
	if db == nil {
		return &Reporter{}
	}
	return &Reporter{store: &store{db: db}}
}

// Report persists a detected shadow agent fingerprint and its request metadata.
// Keys recognised in info: tenant_id, user_agent, api_key_prefix, endpoint.
func (r *Reporter) Report(fingerprint string, info map[string]interface{}) error {
	if r.store == nil {
		return nil
	}

	tenantID, _ := info["tenant_id"].(string)
	userAgent, _ := info["user_agent"].(string)
	apiKeyPrefix, _ := info["api_key_prefix"].(string)
	endpoint, _ := info["endpoint"].(string)

	var endpoints []string
	if endpoint != "" {
		endpoints = []string{endpoint}
	}

	if err := r.store.upsert(context.Background(), fingerprint, tenantID, userAgent, apiKeyPrefix, endpoints); err != nil {
		log.Printf("shadow reporter: upsert %s: %v", fingerprint, err)
		return err
	}
	return nil
}

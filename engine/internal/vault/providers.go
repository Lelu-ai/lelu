package vault

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

// ProviderConfig holds the OAuth 2.0 token endpoint config for a third-party service.
type ProviderConfig struct {
	Name         string // e.g. "google", "github", "slack"
	TokenURL     string
	ClientID     string
	ClientSecret string
}

// RefreshResult is returned by ExchangeRefreshToken.
type RefreshResult struct {
	AccessToken string
	Scopes      string
	ExpiresAt   time.Time // zero if provider does not return expires_in
}

// ExchangeRefreshToken calls the provider's token endpoint with the stored
// refresh token and returns a fresh access token.
func (p *ProviderConfig) ExchangeRefreshToken(ctx context.Context, refreshToken string) (*RefreshResult, error) {
	if p.TokenURL == "" {
		return nil, fmt.Errorf("vault: provider %q has no token URL configured", p.Name)
	}

	body := url.Values{
		"grant_type":    {"refresh_token"},
		"refresh_token": {refreshToken},
		"client_id":     {p.ClientID},
		"client_secret": {p.ClientSecret},
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, p.TokenURL, strings.NewReader(body.Encode()))
	if err != nil {
		return nil, fmt.Errorf("vault: provider %q: build request: %w", p.Name, err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("vault: provider %q: token exchange: %w", p.Name, err)
	}
	defer resp.Body.Close()

	rawBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("vault: provider %q: read response: %w", p.Name, err)
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("vault: provider %q: token exchange failed (%d): %s", p.Name, resp.StatusCode, rawBody)
	}

	var payload struct {
		AccessToken string `json:"access_token"`
		Scope       string `json:"scope"`
		ExpiresIn   int    `json:"expires_in"`
	}
	if err := json.Unmarshal(rawBody, &payload); err != nil {
		return nil, fmt.Errorf("vault: provider %q: parse token response: %w", p.Name, err)
	}
	if payload.AccessToken == "" {
		return nil, fmt.Errorf("vault: provider %q: empty access_token in response", p.Name)
	}

	result := &RefreshResult{
		AccessToken: payload.AccessToken,
		Scopes:      payload.Scope,
	}
	if payload.ExpiresIn > 0 {
		result.ExpiresAt = time.Now().UTC().Add(time.Duration(payload.ExpiresIn) * time.Second)
	}
	return result, nil
}

// BuiltinProviders returns the default provider configs populated from
// environment variables. Only providers with a CLIENT_ID set are included.
//
// Environment variables (per provider):
//
//	VAULT_GOOGLE_CLIENT_ID / VAULT_GOOGLE_CLIENT_SECRET
//	VAULT_GITHUB_CLIENT_ID / VAULT_GITHUB_CLIENT_SECRET
//	VAULT_SLACK_CLIENT_ID  / VAULT_SLACK_CLIENT_SECRET
//	VAULT_SALESFORCE_CLIENT_ID / VAULT_SALESFORCE_CLIENT_SECRET
func BuiltinProviders() []*ProviderConfig {
	defs := []struct {
		name     string
		tokenURL string
		idEnv    string
		secEnv   string
	}{
		{"google", "https://oauth2.googleapis.com/token", "VAULT_GOOGLE_CLIENT_ID", "VAULT_GOOGLE_CLIENT_SECRET"},
		{"github", "https://github.com/login/oauth/access_token", "VAULT_GITHUB_CLIENT_ID", "VAULT_GITHUB_CLIENT_SECRET"},
		{"slack", "https://slack.com/api/oauth.v2.access", "VAULT_SLACK_CLIENT_ID", "VAULT_SLACK_CLIENT_SECRET"},
		{"salesforce", "https://login.salesforce.com/services/oauth2/token", "VAULT_SALESFORCE_CLIENT_ID", "VAULT_SALESFORCE_CLIENT_SECRET"},
		{"notion", "https://api.notion.com/v1/oauth/token", "VAULT_NOTION_CLIENT_ID", "VAULT_NOTION_CLIENT_SECRET"},
		{"linear", "https://api.linear.app/oauth/token", "VAULT_LINEAR_CLIENT_ID", "VAULT_LINEAR_CLIENT_SECRET"},
		{"microsoft", "https://login.microsoftonline.com/common/oauth2/v2.0/token", "VAULT_MICROSOFT_CLIENT_ID", "VAULT_MICROSOFT_CLIENT_SECRET"},
		{"jira", "https://auth.atlassian.com/oauth/token", "VAULT_JIRA_CLIENT_ID", "VAULT_JIRA_CLIENT_SECRET"},
	}

	var out []*ProviderConfig
	for _, d := range defs {
		id := os.Getenv(d.idEnv)
		if id == "" {
			continue
		}
		out = append(out, &ProviderConfig{
			Name:         d.name,
			TokenURL:     d.tokenURL,
			ClientID:     id,
			ClientSecret: os.Getenv(d.secEnv),
		})
	}
	return out
}

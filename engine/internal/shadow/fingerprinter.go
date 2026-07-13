package shadow

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
)

// Fingerprint computes a stable fingerprint for a request map.
// It uses a small set of common fields to remain robust across inputs.
func Fingerprint(req map[string]interface{}) string {
	ua := ""
	if v, ok := req["user_agent"].(string); ok {
		ua = v
	}
	api := ""
	if v, ok := req["api_key_prefix"].(string); ok {
		api = v
	}
	actor := ""
	if v, ok := req["actor"].(string); ok {
		actor = v
	}

	s := fmt.Sprintf("%s|%s|%s", ua, api, actor)
	h := sha256.Sum256([]byte(s))
	return hex.EncodeToString(h[:])
}

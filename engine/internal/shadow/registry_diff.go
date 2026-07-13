package shadow

// IsRegistered checks whether the given fingerprint exists in the provided registry.
// Registry is a simple map for the initial scaffold; later this will query a DB.
func IsRegistered(fp string, registry map[string]bool) bool {
	if registry == nil {
		return false
	}
	return registry[fp]
}

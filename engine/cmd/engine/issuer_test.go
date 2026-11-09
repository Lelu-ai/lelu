package main

import "testing"

func TestDefaultIssuer(t *testing.T) {
	for _, tc := range []struct{ addr, want string }{
		{":8080", "http://localhost:8080"},
		// Reported in the Nauro pilot: an explicit host was appended to
		// "localhost" instead of replacing it.
		{"127.0.0.1:18960", "http://127.0.0.1:18960"},
		{"0.0.0.0:8080", "http://localhost:8080"},
		{"[::]:8080", "http://localhost:8080"},
		{"[::1]:8080", "http://[::1]:8080"},
		{"engine.internal:9000", "http://engine.internal:9000"},
	} {
		if got := defaultIssuer(tc.addr); got != tc.want {
			t.Errorf("defaultIssuer(%q) = %q, want %q", tc.addr, got, tc.want)
		}
	}
}

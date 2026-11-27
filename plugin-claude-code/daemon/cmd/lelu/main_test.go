package main

import "testing"

func TestRole(t *testing.T) {
	cases := []struct {
		args []string
		want string
	}{
		{[]string{"/home/u/.lelu/claude-plugin/bin/0.3.0/lelu-hook"}, "hook"},
		{[]string{"/home/u/.lelu/claude-plugin/bin/0.3.0/lelu-daemon"}, "daemon"},
		{[]string{"lelu", "hook"}, "hook"},
		{[]string{"lelu", "daemon"}, "daemon"},
		{[]string{"lelu"}, ""},
		{[]string{"lelu", "other"}, ""},
	}
	for _, tc := range cases {
		if got := role(tc.args); got != tc.want {
			t.Errorf("role(%q) = %q, want %q", tc.args, got, tc.want)
		}
	}
}

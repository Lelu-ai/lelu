package server

import "testing"

// The payload fingerprint is what a human approval binds to. It covered the
// action, resource, args, acting_for and scope — but not the actor or the
// tenant, so an approval of "invoice_bot, in tenant t1, may refund $10 on
// refund-88" was redeemable by any actor in any tenant.

func TestEffectFingerprint_BindsActor(t *testing.T) {
	approved := agentAuthorizeRequest{
		Actor: "invoice_bot", TenantID: "t1",
		Action: "approve_refunds", Resource: map[string]string{"id": "refund-88"},
	}
	swapped := approved
	swapped.Actor = "attacker_bot"

	if effectFingerprint(approved) == effectFingerprint(swapped) {
		t.Fatal("changing the actor must change the fingerprint: an approval is for a specific agent")
	}
}

func TestEffectFingerprint_BindsTenant(t *testing.T) {
	approved := agentAuthorizeRequest{
		Actor: "invoice_bot", TenantID: "t1",
		Action: "approve_refunds", Resource: map[string]string{"id": "refund-88"},
	}
	swapped := approved
	swapped.TenantID = "victim-tenant"

	if effectFingerprint(approved) == effectFingerprint(swapped) {
		t.Fatal("changing the tenant must change the fingerprint: an approval does not cross tenants")
	}
}

func TestEffectFingerprint_StableForTheSameEffect(t *testing.T) {
	req := agentAuthorizeRequest{
		Actor: "invoice_bot", TenantID: "t1",
		Action: "approve_refunds", Resource: map[string]string{"id": "refund-88"},
		Args: map[string]interface{}{"amount": 10},
	}
	same := req
	if effectFingerprint(req) != effectFingerprint(same) {
		t.Fatal("an identical payload must produce an identical fingerprint")
	}
}

// Confidence telemetry is deliberately excluded: an agent that recomputes its
// confidence between the request and the execution has not changed the effect
// the reviewer approved.
func TestEffectFingerprint_IgnoresConfidence(t *testing.T) {
	req := agentAuthorizeRequest{Actor: "bot", TenantID: "t1", Action: "act"}
	other := req
	score := 0.99
	other.Confidence = &score

	if effectFingerprint(req) != effectFingerprint(other) {
		t.Fatal("confidence telemetry must not affect the fingerprint")
	}
}

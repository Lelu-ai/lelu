# Provider-neutral verified evidence

This fixture shows how a caller can add an externally verified evidence signal
to a Lelu authorization request without adding a provider-specific dependency.

The trusted adapter verifies the external record **before** calling Lelu, then
passes only the normalized signal in `args.external_evidence`:

```json
{
  "provider": "example-provider",
  "observed_at": "2026-10-07T08:00:00Z",
  "declaration_state": "declared_permitted",
  "evidence_ref": "urn:evidence:sha256:example",
  "receipt_digest": "sha256:example"
}
```

Lelu treats these fields as policy input. They are not legal clearance and do
not authorize an action by themselves. A Rego or YAML policy must opt in to
using the signal.

The Go SDK helper `WithVerifiedEvidence` validates the neutral envelope and
adds it to a copy of the existing args map:

```go
args, err := lelu.WithVerifiedEvidence(existingArgs, lelu.VerifiedEvidenceSignal{
    Provider: "example-provider",
    ObservedAt: "2026-10-07T08:00:00Z",
    DeclarationState: "declared_permitted",
    EvidenceRef: "urn:evidence:sha256:example",
    ReceiptDigest: "sha256:example",
})
```

`policy.rego` is deliberately synthetic. Missing or non-permitted evidence
routes to human review; a deployment should map evidence states according to
its own policy.

The full external provider response should stay outside the policy input and
ordinary audit log. Retain the compact evidence reference and digest needed to
correlate the decision with the independently stored evidence.

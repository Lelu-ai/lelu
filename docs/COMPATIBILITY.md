# Which engine and SDK versions work together

The engine, the TypeScript SDK, the Python SDK and the Go SDK are released
together but versioned separately, and a build from `main` can report the same
version number as a published package while containing different code. Use this
page to pick versions that match.

**Rule of thumb: use SDKs from the same release wave as the engine.** If you
upgrade the engine, upgrade the SDKs with it. Upgrading only the engine does not
repair an old SDK.

## Current release set

| Component | Version | Where |
|---|---|---|
| Engine | 0.3.0 | tag `engine-v0.3.0` |
| TypeScript SDK (`lelu-agent-auth`) | 0.1.0 | npm |
| Python SDK (`lelu-agent-auth-sdk`) | 0.4.42 | PyPI |
| Go SDK | 0.1.9 | tag `go-sdk-v0.1.9` |

These four were released together on 2026-11-12. They have **not** been run
together as a full compatibility matrix on the published artifacts yet; the
table below is what has been observed.

## What has been observed

From the Nauro Agents pilot (round 1), run against engine `0.2.1` and against
source at `main@a75d52ec`. "Main" means source, not a published release.

| Engine | SDK | Result |
|---|---|---|
| 0.2.1 | Python 0.4.41 (published or main) | **Fails.** `register`, `list` and `get` on the agent registry raise `ValidationError`. Token, suspend and revoke work if given the agent ID separately. |
| 0.2.1 | TypeScript 0.0.36 (published or main) | **Fails.** Fields such as `agent.id` are `undefined`; passing that to `issueAgentToken` returns 404. |
| main | Python 0.4.41 | Passes the registry calls tested. |
| main | TypeScript 0.0.36 | **Partial.** `id` works, but renamed properties such as `tenantId` are `undefined`. |
| main | Python and TypeScript from main | Passes the calls tested (Python: register, list, get, token, suspend, revoke; TypeScript: register, list, get, token). |

The cause is the agent-registry response change in #77: the engine now returns
the field names the SDKs read, and an older engine returns the old names. So an
engine from before that change does not work with these SDK versions, and a
newer engine does not work fully with TypeScript 0.0.36.

**In practice:** engine 0.3.0 was released with TypeScript 0.1.0 and Python
0.4.42, so use those or later. Avoid mixing engine 0.2.x with the SDK versions
above, and avoid engine 0.3.0 with TypeScript 0.0.x.

## Other changes that depend on the version

| Change | Affects | Detail |
|---|---|---|
| `auth.handler` needs `authenticate` | TypeScript 0.1.0 and later | The mounted handler refuses every route except `GET /ok` until you pass an `authenticate` option, and ignores `resolvedBy` in the request body. Code written for 0.0.x that mounts the handler without it stops working. |
| An API key alone no longer selects the cloud | TypeScript (0.1.0), Python and Go (the release after 0.4.42 / 0.1.9) | Set `base_url` / `baseUrl` / `BaseURL` (or `LELU_BASE_URL`) to the engine you want. With nothing set, the SDK uses a running local `lelu-mcp` engine, else `http://localhost:8080`. |
| Redeem returns a refusal as a result | TypeScript SDK after 0.1.0 | `redeemReview()` returns `{ allowed: false, reason }` on a refused redemption instead of throwing; `reviewId` and `traceId` are mapped to camelCase. |

## Runtime requirements

| Component | Requires |
|---|---|
| TypeScript SDK | Node 18 or later |
| Python SDK | Python 3.11 or later |
| Go SDK | Go 1.22 or later |

## Checking what you are running

```bash
lelu-engine --version                  # engine binary
curl http://localhost:8080/healthz     # the response includes "version"
npm ls lelu-agent-auth                 # TypeScript SDK
pip show lelu-agent-auth-sdk           # Python SDK
```

## Maintainers: keep this page current

Update it in the same change that cuts a release:

1. Replace the "Current release set" table with the versions just released.
2. Add a row under "What has been observed" for any pairing you actually ran,
   and say which artifacts (published or source) it used.
3. Add a row under "Other changes that depend on the version" for every breaking
   change in the generated changelogs.

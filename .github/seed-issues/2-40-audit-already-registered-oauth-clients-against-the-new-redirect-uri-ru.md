---
title: Audit already-registered OAuth clients against the new redirect URI rules
labels: help wanted,security,level-2-intermediate
---
Client registration now refuses `javascript:`, plain-`http` non-loopback, wildcard and fragment redirect URIs, but clients registered before that change keep whatever they stored, and `/oauth/authorize` still sends codes to them.

**What to do**
- At engine start, scan `oauth_clients` and log a warning naming each client whose stored `redirect_uris` would now fail `validateRedirectURI`.
- Optionally add `LELU_OAUTH_PURGE_INVALID_CLIENTS=true` to delete them, and make `/oauth/authorize` refuse an invalid stored URI.
- Add tests with a seeded database.

**Done when** an operator sees which existing clients are unsafe, and authorize cannot redirect to one.

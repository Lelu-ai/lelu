---
title: Generate the JWT and vault keys on first boot; derive the vault key properly
labels: help wanted,security,level-3-advanced
---
With `APP_ENV` unset the engine runs on `JWT_SIGNING_KEY=change-me-in-production`, and the token vault is encrypted under `sha256` of that public constant. Rows were decrypted offline in the audit.

**What to do**
- Generate random keys on first boot and persist them (0600) beside the RSA key.
- Derive the vault key with HKDF and a salt; bind ciphertext to (tenant, agent, provider) with AAD; store a key ID so keys can rotate.
- Write a migration that re-encrypts existing rows.

Audit reference: AUTH-10, V-1, V13.

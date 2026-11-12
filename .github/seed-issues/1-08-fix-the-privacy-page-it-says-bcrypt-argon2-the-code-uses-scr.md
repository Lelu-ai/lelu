---
title: Fix the privacy page: it says bcrypt/argon2, the code uses scrypt
labels: good first issue,documentation,level-1-first-timer
---
`platform/ui/app/privacy/page.tsx` says passwords are hashed with bcrypt or argon2. `platform/ui/lib/auth.ts` uses scrypt. It also says the service "complies with GDPR and CCPA" with no deletion route behind it.

**What to do** correct the hash name and reword the compliance sentence to what is actually implemented. Link the account-deletion issue once it exists.

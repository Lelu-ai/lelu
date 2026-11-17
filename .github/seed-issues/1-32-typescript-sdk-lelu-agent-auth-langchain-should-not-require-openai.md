---
title: TypeScript SDK: `lelu-agent-auth/langchain` should not require `openai` to be installed
labels: good first issue,bug,level-1-first-timer
---
`import "lelu-agent-auth/langchain"` fails with `Cannot find module 'openai'` unless the app has `openai` installed, even if it only wants `SecureTool`. `src/langchain/SemanticPolicyGenerator.ts` imports `OpenAI` at the top of the file, and the subpath's `index.ts` re-exports it. `openai` is only an optional peer dependency.

**What to do**
- Load `openai` lazily inside `SemanticPolicyGenerator` (dynamic `import("openai")` at first use), with a clear error message if it is missing.
- Add a test (or a small script in `sdk/typescript/`) showing `import("lelu-agent-auth/langchain")` works with `openai` absent.

**Done when** `SecureTool` can be imported from `lelu-agent-auth/langchain` in a project that does not have `openai` installed.

Found while smoke-testing the published 0.1.0 package.

---
title: Return compute redirects as `allowed:false` plus a `redirect` object
labels: help wanted,enhancement,level-2-intermediate
---
A compute decision comes back as `allowed:true, compute:true, safe_tool:...`. A client that ignores `compute` runs the original production action.

**What to do** add a `redirect:{tool,args}` field, set `allowed:false` for compute, and keep the old fields for one release behind `LELU_LEGACY_COMPUTE=true`. Update the TypeScript, Python and Go SDKs and the framework wrappers.

Audit reference: POL-04, V22.

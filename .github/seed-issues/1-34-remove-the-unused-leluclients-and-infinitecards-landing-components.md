---
title: Remove the unused `LeluClients` and `InfiniteCards` landing components
labels: good first issue,documentation,level-1-first-timer
---
After the fake testimonials were removed from the landing page, `platform/ui/components/LeluClients.tsx` is not imported anywhere, and `platform/ui/components/ui/InfiniteCards.tsx` is only referenced by itself. `LeluClients` also renders a row of technology logos (`companies` in `platform/ui/data/index.ts`) that reads as a customer list.

**What to do**
- Confirm with a search that nothing imports them.
- Delete both components and the `companies` array if nothing else uses it, along with any logo files only they used.
- Run `npm run build` in `platform/ui` to check nothing breaks.

**Done when** the build passes and the repo no longer contains a customer-looking logo strip that is not backed by real customers.

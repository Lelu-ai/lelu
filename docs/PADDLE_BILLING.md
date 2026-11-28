# Paid plans with Paddle

The hosted dashboard (`platform/ui`) is priced per authorize call, never per
seat or agent. The plans live in `lib/billing/plans.ts`:

| Plan | Price | Calls included / month | Past the included calls | Audit history |
|---|---|---|---|---|
| Free | $0 | 1,000 | declined until the 1st | 30 days |
| Starter | $20 / month | 100,000 | $0.50 per 1,000, billed next invoice | unlimited |
| Growth | $99 / month | 1,000,000 | $0.50 per 1,000, billed next invoice | unlimited |
| Enterprise | custom | `lelu_users.call_limit_override` | custom | unlimited |

Every plan has unlimited agents and team members. The plan is stored in
`lelu_users.plan` (`free`, `starter`, `growth`, `enterprise`; the old value
`paid` is read as `starter`). Paddle is how a user gets a paid plan.

Paddle is a *merchant of record*: it sells to your customer, collects and files
sales tax / VAT, and handles chargebacks. Lelu only needs to know which plan a
user is paying for right now.

This is optional. With no Paddle settings the dashboard still shows usage, just
without the plan buttons. Self-hosted engines are not affected.

## How it works

```
Pricing "Choose Starter"  ->  Paddle.js overlay checkout (that plan's price,
                              user email, custom data { user_id })
Pricing "Choose Growth"   ->  same, or for a current subscriber:
  (already subscribed)        POST /api/billing/paddle/change-plan
                              -> PATCH /subscriptions/{id} with the new price
Paddle                    ->  POST /api/billing/paddle/webhook (subscription.*)
Webhook                   ->  verifies Paddle-Signature, then sets
                              lelu_users.plan from the subscription's price
Authorize calls           ->  checkQuota(): Free stops at its limit,
                              paid plans continue
1st of each month 03:00   ->  Vercel Cron -> GET /api/billing/overage/run
                              -> POST /subscriptions/{id}/charge for last
                                 month's extra calls (next invoice)
```

| Subscription status | Plan |
|---|---|
| `active`, `trialing` | the plan whose price is on the subscription |
| `past_due` | same (grace period while Paddle retries the card) |
| `paused`, `canceled` | free |

A paying subscription whose price is not one of the configured plan prices is
ignored rather than guessed.

Switching plans: upgrades are prorated and charged straight away; downgrades
switch straight away and the unused part of the higher price is credited on the
next bill.

Overage: each account's calls for the previous calendar month are compared with
its plan, and the extra calls are charged in blocks of 1,000 (rounded up) as a
one-time charge on the subscription's next invoice. `lelu_overage_charges` keeps
one row per account per month, so re-running the job never charges twice; a
failed charge is retried on the next run, and a run that died mid-request is
reported under `needsReview` instead of being retried. To bill a month by hand:
`curl -H "Authorization: Bearer $CRON_SECRET" https://<domain>/api/billing/overage/run?period=2026-11`.

Events are applied in order of Paddle's `occurred_at`; a retried or older event
cannot overwrite a newer plan.

## Set up in the sandbox (no approval needed)

1. Create a sandbox account at https://sandbox-vendors.paddle.com/signup. Sandbox
   and live accounts are separate: separate keys, products and notification
   destinations.
2. **Catalog > Products**: create a product (for example "Lelu Cloud") with
   three prices, and copy each price ID (`pri_...`):
   - **Starter**: recurring, monthly, $20.
   - **Growth**: recurring, monthly, $99.
   - **Overage**: one-time (non-recurring), $0.50. One unit is 1,000 calls.
   If you already have the old $20 "Pro" price, use it as Starter (or keep it
   as `PADDLE_PRICE_ID` so existing subscribers stay recognised as Starter).
3. **Developer tools > Authentication**: create a client-side token (starts with
   `test_` in the sandbox) and, for the billing portal, an API key.
4. **Developer tools > Notifications**: add a destination pointing at
   `https://<your-domain>/api/billing/paddle/webhook`, subscribe to the
   `subscription.*` events, and copy its secret (`pdl_ntfset_...`). For local
   testing use a tunnel to your dev server.
5. Set the environment variables (see `.env.example`):

   | Variable | Value |
   |---|---|
   | `PADDLE_ENVIRONMENT` | `sandbox` (default) or `production` |
   | `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` | the client-side token |
   | `PADDLE_PRICE_ID_STARTER` | the Starter price (falls back to the old `PADDLE_PRICE_ID`) |
   | `PADDLE_PRICE_ID_GROWTH` | the Growth price (leave unset to offer Starter only) |
   | `PADDLE_PRICE_ID_OVERAGE` | the overage price (leave unset to turn overage billing off) |
   | `PADDLE_WEBHOOK_SECRET` | the notification destination secret |
   | `PADDLE_API_KEY` | billing portal, plan switching and overage charges |
   | `CRON_SECRET` | any long random string; Vercel Cron sends it to the overage job |

6. Sign in, open **/pricing**, click **Choose Starter**, and pay with the
   sandbox test card `4242 4242 4242 4242` (any future expiry, any CVC). Within
   a few seconds the dashboard's plan card should show **Starter**. Then click
   **Upgrade to Growth** on the dashboard and check it switches to **Growth**.
7. Test overage: set `call_limit_override` on your user to a small number (for
   example 10), make a few more live calls than that, then run the job for the
   current month by hand (`?period=` this month) and check the charge appears
   on the subscription's next invoice in Paddle. Set the override back to NULL.

## Going live

Live checkout needs a Paddle seller account with an approved domain and a payout
account (a bank account or Payoneer, added in the Paddle dashboard). Check that
Paddle supports sellers and payouts in your country before you rely on it.
Switch `PADDLE_ENVIRONMENT` to `production` and replace every sandbox value
(`test_` token, price, secret and API key) with the live one.

## Known limitation

The checkout is opened in the browser, so the `user_id` in its custom data is a
claim the browser makes. `lib/billing/plan.ts` limits the damage: a downgrade is
only accepted from the subscription already recorded for that user. Creating the
transaction on the server (the Paddle API's `POST /transactions` with
`custom_data`) and opening the checkout from its ID would remove the issue
entirely; it needs `PADDLE_API_KEY` on the checkout path.

## Existing Stripe routes

`app/api/billing/{checkout,portal,webhook}` are the original Stripe
implementation. They still work if configured and are untouched. Both set the
same `plan` column, so the quota code does not care which provider is used.

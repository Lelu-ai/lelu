# Paid plans with Paddle

The hosted dashboard (`platform/ui`) has a free plan and a paid plan. The plan
lives in `lelu_users.plan` (`free` or `paid`) and `lib/quota.ts` turns it into a
monthly limit (`PLAN_LIMITS`). Paddle is how a user becomes `paid`.

Paddle is a *merchant of record*: it sells to your customer, collects and files
sales tax / VAT, and handles chargebacks. Lelu only needs to know whether a user
is paying right now.

This is optional. With no Paddle settings the dashboard still shows usage, just
without the Upgrade button. Self-hosted engines are not affected.

## How it works

```
Dashboard "Upgrade"  ->  Paddle.js overlay checkout (price pri_..., user email,
                         custom data { user_id })
Paddle               ->  POST /api/billing/paddle/webhook  (subscription.* events)
Webhook              ->  verifies Paddle-Signature, then sets lelu_users.plan
Authorize calls      ->  checkQuota() reads the plan and enforces the limit
```

| Subscription status | Plan |
|---|---|
| `active`, `trialing` | paid |
| `past_due` | paid (grace period while Paddle retries the card) |
| `paused`, `canceled` | free |

Events are applied in order of Paddle's `occurred_at`; a retried or older event
cannot overwrite a newer plan.

## Set up in the sandbox (no approval needed)

1. Create a sandbox account at https://sandbox-vendors.paddle.com/signup. Sandbox
   and live accounts are separate: separate keys, products and notification
   destinations.
2. **Catalog > Products**: create a product (for example "Lelu Cloud") with a
   recurring monthly price. Copy the price ID (`pri_...`).
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
   | `PADDLE_PRICE_ID` | the `pri_...` price |
   | `PADDLE_WEBHOOK_SECRET` | the notification destination secret |
   | `PADDLE_API_KEY` | only for the "Manage billing" button |

6. Sign in, open the dashboard, click **Upgrade**, and pay with the sandbox test
   card `4242 4242 4242 4242` (any future expiry, any CVC). Within a few seconds
   the card should switch to **Paid**.

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

# Purchase verification service


Run on Node 22+ as one process, bound to loopback behind a managed HTTPS proxy. The server accepts no client-selected product, package or Google endpoint. Both permanent, non-consumable products belong to `com.example.mola`:

| Fixed route | Play product | Entitlement |
| --- | --- | --- |
| `/v1/offline/verify` | `offline_cafe_manager` | Legacy offline café manager entitlement |
| `/v1/no-ads/verify` | `lifetime_no_ads` | Full Unlock: ad removal, offline manager and one 50,000-gold bonus for new offers |


## Private configuration

- `CAFE_GOOGLE_SERVICE_ACCOUNT`: service-account JSON with this app's Play Developer API purchase/acknowledgment access. Never ship it in the app.
- `CAFE_RECEIPT_PRIVATE_KEY`: RSA 2048+ PEM signing key. The matching base64 DER SPKI public key belongs in `billing.config.json`.
- `CAFE_BILLING_LEDGER`: private durable directory. Each purchase has a SHA256-named file containing its token, product, stable activation time and revocation state. Lifetime records also retain the installation assigned the bonus. File mode 0600, directory 0700. Back up securely and never serve this directory.
- `CAFE_BILLING_PORT`: optional port, default 37326.
- `CAFE_BILLING_HOST`: defaults to `127.0.0.1`; only an isolated container with no published host ports should set `0.0.0.0`. Other values fail closed.

Set the verification URLs in `billing.config.json` to the corresponding deployed `/mola-api/v1/.../verify` routes and pin the matching signing public key. Actual store products, prices and a Play-installed test build are also required; the live verifier does not by itself prove a successful purchase.

Start: `node server/billing/server.mjs`. Check `GET /health`; each product route accepts `{purchaseToken, installationId}`. The server fetches current Google purchase state, persists the idempotent entitlement, acknowledges the purchase, and returns an RSA-SHA256 signed JSON receipt. It never consumes either product or invents a price. Pending, invalid, network or acknowledgment failure returns no grant. Refunds/removals return signed revocation. Ledger writes and the directory are synced before acknowledgment. Product-specific ledger keys isolate no-ads from the original offline records; existing offline activation records remain compatible.

## One-time bonus and recovery

New native purchase flows persist their opening time and token offer version, then send `bonusOfferVersion: 2`; a fresh ledger reservation receives 50,000 gold. Unmarked old clients/restores/pending purchases retain the legacy 300,000 offer. The ledger preserves an existing `bonusGold` across retry, restart and restore, and the signed amount is validated by the new native/web code. Previously credited balances and grant IDs are unchanged.

**Rollback constraint:** after any 50,000 grant is reserved, do not run the old `12e3f33` verifier against the current ledger: it can rewrite the amount to 300,000. Use a version-aware verifier; never roll back the ledger or regenerate the signing key.

The server reserves the lifetime purchase's bonus to its first verified installation in the durable ledger. The signed receipt carries a stable purchase hash, `bonusEligible` and `bonusAmount`; another installation can restore ad removal but receives no additional gold grant.

`CafeNoAdsBilling` verifies receipt signature, package, product and installation before exposing `bonusGrantId`, `bonusAmount` and `bonusPending`. The ID is `lifetime_no_ads:` followed by the receipt's 64-character hash. Its native preferences are separate from `CafeBilling`, the original offline SKU remains separate, while the game treats verified Full Unlock as offline access too.

The game must apply the credit once by grant ID, persist the updated game save, and only then call `LifetimeNoAds.acknowledgeBonus(grantId)`. Native acknowledgment durably records the same ID in preferences. If the app closes between save and acknowledgment, the stored game grant ID prevents another credit and acknowledgment can be retried. If a native acknowledgment fails, the pending flag remains available for retry. Claimed flags survive entitlement revocation and ordinary game-save resets.

There are no player accounts or cross-device game saves. Clearing app data or reinstalling creates another installation: a Play restore still unlocks ad removal, but does not multiply or restore the original bonus currency. If the original installation/save is lost after the server reserves the bonus, automatic transfer of that gold is unavailable. Restoring a previously spent wallet or moving the bonus safely between devices would require account-bound cloud saves and server-side wallet records; this implementation does not imply that capability.

The service uses Google's OAuth service-account JWT exchange with a short-lived access token. App code contains only the public key, HTTPS URLs and product IDs. Cached signed entitlements survive network outages; refunds are observed on the next successful online ownership/verification check. A fully offline client cannot observe a refund. Café progress is not uploaded.

## Verification and release gates

The permanent-entitlement test file runs nine local tests using explicit Google doubles and ephemeral signing keys; the combined server command also includes the diamond tests listed below. Lifetime coverage uses a real temporary durable ledger to check repeated verification, restart, second-installation restore, revocation, fixed product routing, pending purchases and acknowledgment failure. Targeted JavaScript purchase tests pass 16 cases (11 existing offline and 5 lifetime); Android unit tests pass receipt-signature validation and bonus-field validation. These are local implementation tests, not evidence of Play acceptance or an on-device purchase.

Before release, create both Play Console one-time products with one permanent buy option and actual regional prices; license-test a Play-installed build; provision least-privilege Google API credentials; deploy HTTPS with bounded request rates and no token/body logging; secure ledger backups/restore; pin the public key; and verify real purchase, pending, cancellation, restore, refund and service-outage recovery. For lifetime ad removal additionally verify a single bonus, closing the app around save/acknowledgment, and second-device restore without another bonus. `scripts/check-release.mjs` requires these checks to be recorded as true under `lifetimeNoAds`: `purchase`, `restore`, `pending`, `cancel`, `refund`, `bonusOnce`, `bonusCrashRecovery`, `secondDeviceRestore`, `regionalPrice`. No evidence file is fabricated by tests.

Decide production proxy logs, hosting region, purchase retention/deletion handling and disclosures. Ensure acknowledgment recovery within Google's window: the client retries next foreground, but long device absence during an acknowledgment outage still needs an operational retry worker/RTDN workflow. These are open release gates.

This file ledger supports one server process only. Multiple replicas require a shared transactional store and distributed idempotency. Permanent entitlement is token-based; the token is a bearer secret and restoring another installation comes through that user's Play purchase query. Production risk review, rate limiting and Play Integrity remain deployment considerations.

Official references: [Billing integration](https://developer.android.com/google/play/billing/integrate), [purchase security](https://developer.android.com/google/play/billing/security), [product status](https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.products), [server authorization](https://developers.google.com/identity/protocols/oauth2/service-account).

## Consumable diamond packs

`/v1/diamonds/verify` is a separate, allowlisted consumable endpoint. It accepts `{purchaseToken, installationId, productId, action}`; action is `verify` or `consume`. The product must be exactly one of:

| Product ID | Diamonds | Target US base price |
| --- | ---: | ---: |
| `diamonds_100` | 100 | USD 1.49 |
| `diamonds_500` | 500 | USD 3.99 |
| `diamonds_5000` | 5,000 | USD 6.99 |
| `diamonds_10000` | 10,000 | USD 9.99 |

These are configuration targets; Play Console must create these four products with one buy option each and real regional pricing. `diamondVerificationUrl` points to the deployed consumable verifier once configured. The game receives localized prices only from Google's freshly queried ProductDetails; a price, currency or amount change aborts that checkout attempt and refreshes the displayed offer. No fallback fake price or web purchase exists.

For a completed, unconsumed Google purchase, verification first durably reserves a stable token-derived `diamonds:<hash>` delivery ID to the current installation. The signed receipt exposes the exact pack amount. The native `CafeDiamondBilling` plugin persists that validated receipt and token before exposing a pending grant through `DiamondStore`. Pending/invalid payments never expose grants. Only the first installation receives the grant; merely restoring the same still-unconsumed token elsewhere does not duplicate it.

The game credits its wallet once by grant ID and persists the wallet and credited IDs before `acknowledgeGrant`. Native acknowledgment first commits its own per-grant delivery flag, then the server consumes the Google purchase. Consumption fulfills acknowledgment and allows the same SKU to be purchased again with a new token. A network failure leaves the receipt/token and native acknowledgment available for retry on foreground. A crash after Google consumption but before the durable server completion is recovered from Google's consumed state and the existing ledger reservation. The server never consumes before an existing durable verified reservation, and the application never requests consumption before game-save acknowledgment.

Already consumed Play purchases are not returned as restorable owned inventory. There are no cloud accounts or wallet backups: reinstalling or losing the local save does **not** restore previously consumed diamond balances. Resetting a game save while retaining native app data also does not mint the pack again. An interrupted, unconsumed purchase assigned to a lost installation requires support/account recovery that this local-wallet implementation does not provide.

Refunds observed before delivery produce signed revocation and no new grant. The server records revocation when queried. Spent diamonds and benefits are not automatically clawed back from an offline local wallet after a later refund, and consumed tokens are no longer polled by the client. Production refund reconciliation needs RTDN/Voided Purchases processing with an account-bound wallet if automatic reversal is required. Do not claim that protection currently exists. Consumption still needs operational recovery within Google's acknowledgment window; a persisted-but-unconsumed purchase can be refunded if the device never returns during an extended server outage.

Additional coverage: seven server tests exercise four exact amounts, token replay/repurchase, consume failure, crash after consumption, pending/invalid states, second-installation delivery and refund. Seven JavaScript bridge tests cover unavailable store, amount validation, pending/price-change responses, save-before-ack recovery and listener races. Two native diamond unit tests check product/amount/hash validation and changed price/currency rejection. Native compilation is validated; no real Play transaction is implied. `npm run test:billing-server` now runs both server files (16 tests total).

The release checker requires real evidence under `diamonds`: `allFourProducts`, `regionalPrices`, `purchase`, `pending`, `cancel`, `consume`, `repeatPurchase`, `consumeRetry`, `crashRecovery`, `refund`. Existing 300,000-gold grants and the original offline entitlement are preserved; new Full Unlock flows use the versioned 50,000 offer described above.

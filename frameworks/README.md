# Once-Pay SDK (npm)

Framework-agnostic payment SDK for the Once-Pay backend. Initiate a payment through any supported Nigerian gateway (Paystack, Flutterwave, Korapay, Monnify, SeerBit) and get notified in-app when the transaction settles — no polling, no page reload.

Works in React, Vue, Svelte, Next.js, Astro, plain ESM — anywhere `fetch` exists.

## Install

```bash
npm install once-pay-sdk
# optional — enables the live transaction listener (otherwise loaded from CDN):
npm install socket.io-client
```

## Quick start

```js
import OncePay from "once-pay-sdk";

const client = new OncePay({
  base_url: "https://oncepay-api.owoade.dev",
  api_key: "pk_xxxx_yyyy", // merchant API key
});

try {
  const response = await client.initiate_transaction({
    amount: 5000,
    email: "customer@example.com",
    payment_gateway: "paystack",           // | flutterwave | korapay | monnify | seerbit
    callback_url: "https://shop.example/thank-you", // optional
    metadata: { order_id: "12" },          // optional
    on_success: ({ reference }) => {       // optional, fires once on settlement
      // e.g. show the success screen
    },
  });

  // Send the shopper to the hosted payment page — framework-agnostic redirect:
  window.location.assign(response.data.payment_link);
} catch (error) {
  error.code;       // backend status code (401, 408, …)
  error.message;    // e.g. "Transaction not found"
}
```

### Redirect helper per framework

The SDK never touches your router. Pick the redirect that fits:

- **Plain / Vue / Svelte:** `window.location.assign(data.payment_link)`
- **Next.js (client):** `router.push(data.payment_link)`, or server-side: `redirect(data.payment_link)`
- **React Router:** `navigate(data.payment_link, { external: true })`

## API

### `new OncePay({ base_url?, api_key })`

- `api_key` — required. Your merchant API key (`pk_...`), sent as a Bearer token.
- `base_url` — backend base URL.

### `client.initiate_transaction(payload) → Envelope<InitiateTransactionData>`

`data` holds `{ payment_link, transaction_reference }`.

Optional `on_success` starts a Socket.IO listener on the backend's `/transactions` namespace; it is invoked **at most once** when the backend broadcasts `{ reference }` for this transaction (duplicate broadcasts are deduped).

### `client.watch_transaction(reference, callback)`

Listen manually for a reference — same once-only semantics.

### Errors

Everything fails by throwing `OncePayError` (`code`, `message`, `response` for the raw envelope). Initiate-side validation (amount, email, gateway) throws before any network call.

## SSR / server components

SSR-safe: importing and instantiating is safe on the server; initiate a transaction from a client component, route handler, or server action by passing `on success` — the listener only loads `socket.io-client` when it will actually use it.

## Notes

- The backend envelope is `{ status, message, data, current_time }`; the SDK returns it unchanged from `initiate_transaction`.
- API keys are merchant secrets — never bundle them in client-facing code you don't trust, and never expose gateway secret keys.
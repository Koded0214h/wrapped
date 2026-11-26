# Chat Wrapped

A full-stack, mobile-first app that parses `.txt` or `.zip` chat exports locally and builds a conversation-specific set of shareable cards.

Production URL: `https://chat-wrapped.kodedlabs.com`

## Run locally

```bash
npm install
cp .env.example .env
npm run dev:full
```

Open `http://localhost:5173`. Choose Friends, Study, or Couple to test without a real export, or upload a real export without media.

## Payment switch

Set the mode, then restart the app:

```env
VITE_PAYMENT_MODE=free
```

The story and its downloads are free in every mode. Payment applies only to customisation.

- `free`: customisation is open too; checkout is disabled. Shared cards keep the product-link watermark.
- `mock`: premium themes, fonts, Savage mode, watermark removal and bonus cards go through a pretend checkout. Never deploy this mode: it unlocks without charging.
- `bachs`: the same items are paid on Bachs' hosted checkout.

Any other value stops the server at startup.

## Bachs setup

1. Set `VITE_PAYMENT_MODE=bachs`, `BACHS_SECRET_KEY` and `PAYMENT_RETURN_URL` in `.env`.
2. In the Bachs dashboard add a webhook endpoint at `https://<your domain>/api/payments/webhook` for `checkout.completed` and `collection.succeeded`, and put its signing secret in `BACHS_WEBHOOK_SECRET`.
3. Run `npm run build` again (the mode is baked into the client), then restart the server.
4. Try one purchase with an `sk_sandbox_` key before switching to the live key.

Prices are set in `server/index.mjs` (what is charged) and `src/config/products.ts` (what is shown). Keep them the same.

The admin dashboard is at `http://127.0.0.1:8787/admin?key=<ADMIN_SECRET>`. Set a non-empty `ADMIN_SECRET` in `.env` first.

## Verify

```bash
npm test
npm run build
```

Keep production secrets server-side. Telegram alerts require a bot token and chat ID. See [PRD.md](./PRD.md) and [docs/MANUAL_TEST_MATRIX.md](./docs/MANUAL_TEST_MATRIX.md).

## Privacy

Parsing and fact computation happen in the browser. Telemetry and payment requests carry no message text, member names, chat names, or file names. With `VITE_AI_PLANNER=on` the server also receives computed facts, and with `VITE_AI_MODE=with-quotes` it receives anonymised message text after the user opts in, which it forwards to OpenAI and does not store. Set `VITE_TELEMETRY=off` for tests and local sessions where telemetry is unwanted.

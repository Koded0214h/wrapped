# Chat Wrapped

A full-stack, mobile-first app that parses `.txt` or `.zip` chat exports locally and builds a conversation-specific set of shareable cards.

Production URL: `https://chat-wrapped.kodedlabs.com`

## Run locally

```bash
npm install
cp .env.example .env
npm run dev:full
```

Open `http://localhost:5173`. Choose Friends, Study, or Couple to test without a real export, or upload a real export without media. With no Paystack key, checkout uses a local server-recorded mock transaction; no money is charged.

The admin dashboard is at `http://127.0.0.1:8787/admin?key=<ADMIN_SECRET>`. Set a non-empty `ADMIN_SECRET` in `.env` first.

## Verify

```bash
npm test
npm run build
```

For real payments, set Paystack test keys and point its webhook at `/api/payments/webhook`. Keep production secrets server-side. Telegram alerts require a bot token and chat ID. See [PRD.md](./PRD.md) and [docs/MANUAL_TEST_MATRIX.md](./docs/MANUAL_TEST_MATRIX.md).

## Privacy

Parsing and fact computation happen in the browser. The backend accepts only guarded operational events and payment metadata; it must never receive message text, member names, chat names, or file names. Set `VITE_TELEMETRY=off` for tests and local sessions where telemetry is unwanted.

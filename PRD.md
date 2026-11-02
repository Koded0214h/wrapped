# Chat Wrapped — Product Requirements

Status: working v0 · target: $1,000 revenue by 31 December 2026

## Product

Chat Wrapped turns a `.txt` or `.zip` chat export into a funny, mobile-first sequence of shareable 9:16 cards. The result is generated from the conversation: it is not a fixed ten-slide template. Users see the cover, the second card, and the most surprising card for free; payment unlocks the complete story and export.

Primary users are Nigerian students and young professionals in active group chats. Couples and close friends using direct messages are secondary users. The job is: “Give me something funny and personal about this chat that I can post now.”

## End-to-end flow

1. Landing and chat-type selection.
2. iOS/Android export guide.
3. Upload `.txt` or `.zip`, or select one of three visibly different demos: friends, study group, couple.
4. Parse locally in a Web Worker with progress, cancellation, a 60-second timeout, a 60,000-message cap, and human-readable error codes.
5. Compute 40–60 candidate facts. Sensitive kinds never enter the planner.
6. Plan an ordered set of 8–10 cards. The UI consumes only `AnalysisResult`, so a deterministic planner can be replaced by AI without UI changes.
7. Show the cover, card two, and highest-surprise “shocker” free. Locked cards contain redacted text only—real names and values are absent from the DOM.
8. Let users preview themes, fonts, and tone inside the customiser before buying. Web Share, PNG/download, and print require payment. Unpaid stories use a best-effort capture shield on Print Screen, window/app switching, and visibility loss; browsers cannot guarantee operating-system screenshot prevention. Free cards retain the product-link footer.
9. Checkout supports Paystack card, bank, and USSD for NGN when credentials are configured; local development uses a server-recorded mock payment. Recovery verifies a payment reference and restores access.
10. Persist analysis in IndexedDB so refreshes and checkout redirects do not discard it.

## Data contract

```ts
type Fact = {
  id: string
  kind: string
  memberIds: string[]
  value: number | string
  detail?: string
  surpriseScore: number
}

type LayoutType =
  | 'bigNumber' | 'leaderboard' | 'versus' | 'quote' | 'timeline'
  | 'award' | 'wordCloud' | 'heatmap' | 'verdict' | 'cover'

type Card = {
  id: string
  layout: LayoutType
  factIds: string[]
  headline: string
  roast: string
  savageRoast?: string
  locked: boolean
}

type AnalysisResult = {
  chatType: ChatType
  chatName: string
  range: DateRange
  totals: Totals
  members: Member[]
  facts: Fact[]
  cards: Card[]
}
```

Numbers and member names are interpolated from referenced facts by application code. Planner output may reference fact IDs only. Plans containing unknown IDs, literal names, or literal numbers fail validation and fall back to the deterministic planner.

## Analysis and card generation

`getAnalysis()` is the only UI entry point. `computeFacts()` produces per-person message share, reply speed, silence, starters, laughter, apologies, media, night activity, repeated phrases, busiest-day, totals, and verdict candidates. `planCards()` filters unsafe fact kinds, ranks surprise, chooses a layout and copy template, and marks free cards.

Ten reusable layout components render exclusively from `Card` plus referenced `Fact` objects: cover, big number, leaderboard, versus, quote, timeline, award, word cloud, heatmap, and verdict.

AI defaults to `facts-only`. In that mode computed facts—not raw message text—may be sent later. `with-quotes` requires an explicit opt-in screen and different privacy copy. AI generation occurs only after payment; pre-payment cards remain deterministic. Input and token cost are capped and recorded. Savage mode is opt-in and can be globally disabled.

## Privacy and safety

- Never send or store chat text, member names, chat names, or file names.
- Telemetry accepts counts, timings, anonymous IDs, payment references, and short error codes only.
- Client and server reject string properties over 40 characters or values matching phone/email patterns. Payment email is the sole server-side exception and is stored only as a hash.
- “Never leaves your phone” appears only in `local-only` privacy mode. `ai-facts` says raw text stays local; `ai-quotes` discloses excerpt transmission after opt-in.
- Sensitive, explicit, and harassment facts are excluded. Group mode also excludes relationship/romance inference.
- Hide Names is prominent before sharing; exports map names consistently to Member 1, Member 2, and so on.
- Root and per-layout error boundaries show support codes without exposing content.

## Payments and recovery

The backend initializes checkout, records channel and expected amount/currency, verifies Paystack webhook HMAC-SHA512 signatures, validates amount/currency, grants an idempotent unlock, and returns webhook `200` immediately. Every transition is appended to `payment_log`. Replaying a webhook or mock completion creates one unlock and records `duplicate_ignored`.

The recovery flow accepts a payment reference, verifies it with the provider where needed, and records `granted_via='recovery'`. A reconciliation job reports paid-but-locked and unlocked-but-unpaid records. USD checkout stays disabled until the payout checklist is marked tested. `CAP_NGN` alerts at 70%, 85%, and 95% of the configured collection cap.

## First-party observability

The client SDK batches events every five seconds or ten events, flushes with `sendBeacon` on page hide, falls back to keepalive fetch, queues offline in IndexedDB, and retries on reconnect. `VITE_TELEMETRY=off` disables it.

The Node collector validates the typed event union, rate-limits by IP, reapplies privacy guards, and writes SQLite tables for events, errors, parse runs, payments, payment trail, unlocks, generated cards, alerts, outreach, and payout checks. Postgres can replace SQLite for a multi-instance deployment.

The secret-protected `/admin` surface covers Overview, Funnel, Errors, Parsing, Payments, Cards, and Alerts. It computes the acquisition/payment/share funnel, revenue, error counts, parse health, card variety, and launch progress. Telegram credentials enable alerts and an 8am summary. No third-party analytics or error service is used.

## Risk controls

- Parsing: format and clock detection, ZIP-without-TXT `P-104`, unreadable export `P-102`, timeout `P-108`, thin-stat messaging, local worker isolation, and device timing.
- Payments: signature/amount verification, unique references, channel success tracking, cap monitor, recovery, reconciliation, payout checklist, and support contacts.
- People: sensitive-kind blocklist, savage kill switch, explicit/harassment exclusion, name hiding, accurate privacy copy, NDPA contact/deletion path.
- Distribution: `?ref=<cardId>`, product footer on free exports, watermark on paid cards unless upgraded, layout/fact variety, cohort conversion.
- AI: fact-ID-only plans, no raw messages in facts-only mode, strict validation/fallback, token/cost limits, and cost alerts.

## Success metrics

- Landing → upload: at least 40%.
- Upload → parse success: at least 90%.
- Paywall → purchase: 8–15%.
- At least two shares per buyer.
- Identical card-sequence share below 30%.
- AI cost per paid order below the configured fraction of price.
- Roughly 500 core unlocks at $1.99, or fewer with upgrades, to reach $1,000.

## Acceptance

- Friends, study, and couple demos have different card layouts/orders.
- Replacing `planCards()` with a validated AI implementation requires no UI change.
- Locked-card DOM contains no real member name or value.
- A full run populates `/admin`; network inspection shows no chat text, member names, file names, or chat names.
- Forced parse failure displays the same code recorded in Errors.
- Replayed payment completion unlocks once and logs `duplicate_ignored`.
- Recovery fixes a successful payment missed by the webhook; reconciliation detects it beforehand.
- A low test `CAP_NGN` triggers the threshold alert.
- `PRIVACY_COPY_MODE=ai-facts` removes “never leaves your phone” everywhere.
- Theme preview, story viewer, share/PNG export, and web/mobile/desktop responsiveness remain intact.

## Build order

1. Payment logging, reconciliation, recovery.
2. Parse diagnostics and error codes.
3. Funnel and daily summary.
4. Card variety, AI cost, launch and distribution controls.

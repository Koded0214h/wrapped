# Product

## Platform and stack

Responsive web app built with React, Vite, TypeScript, Zustand, Framer Motion, `html-to-image`, a Web Worker parser, IndexedDB persistence, a small Node HTTP service, and SQLite. Paystack and Telegram are optional environment-gated integrations.

## Purpose

Chat Wrapped turns an exported conversation into an ordered, conversation-specific set of funny 9:16 cards. Users preview the free reveals, customise the look before paying, unlock the full story, then save or share it.

## Product rules

- Generate 8–10 cards from 40–60 computed facts; never use a fixed slide list.
- Cover, card two, and the highest-surprise card are free.
- Locked cards render placeholders only. Names and values are not present beneath blur or elsewhere in the locked DOM.
- All names and numbers are filled from referenced facts by code.
- Real message parsing happens locally; telemetry never receives message text, names, chat/file names, or quotes.
- Default AI/privacy mode is facts-only. Quote mode requires explicit opt-in.
- Sharing and PNG export require a paid unlock. Customisation preview works before payment.
- Light roast is the default. Savage is opt-in, safety-filtered, and globally disableable.

## Design and accessibility

The established “house-party confession deck” visual system, theme variables, story viewer, customiser, keyboard navigation, focus states, responsive layouts, and reduced-motion handling remain the product foundation.

## Commercial target

Reach $1,000 by 31 December 2026 through a ₦1,500 / $1.99 core unlock and optional upgrades. First-party telemetry, payment recovery, cap monitoring, reconciliation, and a private admin dashboard protect the launch.


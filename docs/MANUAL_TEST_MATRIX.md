# Manual test matrix

Run every row with both a `.txt` export and a `.zip` containing that export. Confirm progress, cancellation, the 60-second fallback, generated card variety, checkout recovery, PNG output, and that DevTools requests contain no message text, member names, file names, or chat names.

| Device | Browser | TXT | ZIP | Parse diagnostics | Payment + recovery | PNG/share | Result |
|---|---|---:|---:|---:|---:|---:|---|
| Real iPhone | Safari | ☐ | ☐ | ☐ | ☐ | ☐ | Pending |
| Real iPhone | Chrome | ☐ | ☐ | ☐ | ☐ | ☐ | Pending |
| Low-end Android | Chrome | ☐ | ☐ | ☐ | ☐ | ☐ | Pending |
| Samsung phone | Samsung Internet | ☐ | ☐ | ☐ | ☐ | ☐ | Pending |

Failure fixtures:

- ZIP with no TXT → `P-104`
- Unrecognised/short export → `P-102`
- Parse beyond 60 seconds → `P-108`
- More than 60,000 messages → every message is analysed; parsing stays under the 60-second limit
- Premium theme selected → download asks for payment; "use the free style" downloads at no charge
- Bachs bank transfer completed after leaving the page → unlock appears on next visit
- Webhook sent twice → one unlock and `duplicate_ignored`
- Webhook disabled after payment → recovery restores unlock; reconciliation initially flags it
- Low `CAP_NGN` → configured threshold alert appears in `/admin`

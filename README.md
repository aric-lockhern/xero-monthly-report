# Xero Shoes — Monthly Report

Fills the monthly paid-media review deck from live data, on a repeatable monthly
cycle. One button: `Monthly Report → Build report + generate deck`.

The framework deck is `template/Xero_Shoes_Monthly_Reporting_Framework.pptx`.

---

## The shape of it

```
   Triple Whale sheet                Google Ads MCC
   (ld-x-tw-script)                  (engine-report.js)
          │                                  │
          │  _store tab                      │  writes _eng_* tabs
          │  (Date × Channel × Campaign,     │  (product taxonomy, PMax search
          │   raw summed components)         │   terms, item revenue,
          │                                  │   sitelinks, impression share)
          ▼                                  ▼
       ┌────────────────────────────────────────────┐
       │        THIS REPOSITORY (apps-script/)      │
       │                                            │
       │   read → classify → sum → derive           │
       │                                            │
       │   Report tab        one RPT_* named range  │
       │                     per deck table         │
       │   Campaign Map      classification + your  │
       │                     manual overrides       │
       │   Reconciliation    why the parts don't    │
       │                     sum to the whole       │
       └────────────────────────────────────────────┘
                             │
                             ▼
                   Google Slides deck
```

**Triple Whale is the backbone, not one source among several.** Its `_store` tab
already carries spend, impressions, clicks, *engine-reported* conversions and
value (`channel_conv` / `channel_cv`), and pixel-attributed orders and revenue —
for Google *and* Microsoft. So slides 3–7 and 13 need nothing else. Google Ads is
pure enrichment for slides 8–12, plus year-ago history that predates the Triple
Whale backfill.

That matters for sequencing: **you can run this today, against the Triple Whale
sheet alone**, and get 8 of the 13 data slides. The MCC script adds the rest.

---

## Two ideas worth knowing before you change anything

**1. Components are summed; ratios are derived at display time.**
Nothing stores a CTR, a CPC or a ROAS. `Metrics.gs` sums raw components (spend,
revenue, orders, clicks, impressions) and computes every ratio at the moment of
rendering. You cannot average a ratio, so this is the only form that reprojects
correctly to any grain — month, tactic, brand, campaign. It is the same design as
the `_store` tab in `ld-x-tw-script`, on purpose. Impression share follows the
same rule: it is rolled up as total impressions ÷ total *eligible* impressions,
never as an average of daily percentages.

**2. A number that cannot be computed is `n/a`, never `0`.**
A zero that means "no data" is how a deck ends up telling a client revenue
collapsed when really a backfill hadn't run. Missing periods, missing sessions,
and engine-only periods all render `n/a`, and the Report tab carries a warning
block explaining each one.

---

## What is real, what is manual

| Deck slide | Source | Status |
|---|---|---|
| 3 Executive summary — stat cards | Triple Whale | automated |
| 4 Blended paid search | Triple Whale | automated |
| 5 Search / Shopping | Triple Whale + classification | automated |
| 6 Search brand vs. non-brand | Triple Whale + classification | automated |
| 7 Shopping brand vs. non-brand | Triple Whale + classification | automated |
| 8 Product category | Google Ads `shopping_performance_view` | automated — Custom label 1 × Custom label 4, changeable on the `Settings` tab |
| 9 Brand impression share (ours) | Google Ads `search_impression_share` | automated |
| 9 Auction insights (competitors) | — | **manual weekly paste — no API exists**; pivoted and charted by week |
| 10 PMax non-brand search terms | Google Ads `campaign_search_term_view` | automated, sorted by traffic; brand excluded on the reading side |
| 11 Top products | Google Ads item-level | automated, images matched from your Shopping feed by title |
| 12 Promotion recap | Triple Whale + Google Ads assets | automated (needs promo dates on the `Promos` tab) |
| 13 ChatGPT Ads | Triple Whale `openai-ads` | automated |
| 3/4–7/12 narrative bullets | you | manual, deliberately |
| 14 Next steps | you | manual |

Narrative stays manual on purpose. A generated sentence about "revenue up 19%
MoM" is exactly the filler a client notices, and the numbers are already on the
slide.

Read [`docs/GAPS.md`](docs/GAPS.md) before promising anyone a fully hands-off
deck — it lists every gap, why it exists, and what it would take to close it.

---

## Pressure test before you deploy anything

The `.gs` files are **one** Apps Script project — Apps Script shares a single
global scope, so the split is organisation only. Two deployments total, and
`clasp` makes the first one command.

Start with zero Google setup at all:

```bash
npm install
npm run sample-store     # synthetic store — no client data, no Google account
npm test
```

To test against the real numbers instead, export the Triple Whale `_store` tab
(File → Download → CSV) to `tools/.store.csv` and re-run `npm test`. Real exports
are gitignored.

```
✓ all 169 invariants hold.
```

`tools/harness.js` loads the real `apps-script/*.gs` into a sandbox with the
Google globals stubbed, builds the entire report in memory, and runs the same
invariants that `Diagnostics → Run self-test` runs in the live sheet — one
definition of "correct" for both (`apps-script/SelfTest.gs`). Non-zero exit on
failure, so it drops into CI as-is.

The suite is non-vacuous: every check in it was validated by injecting the fault it
is supposed to catch and confirming it fails. Two worth naming, because both leave
the deck looking finished: Performance Max folded into Search instead of Shopping
keeps every arithmetic identity valid while silently moving six figures of spend
between slides; and slide 8's two columns headed for the dimensions currently
configured rather than the ones actually queried puts real numbers under the wrong
heading. See [`docs/DEPLOY.md`](docs/DEPLOY.md#after-any-code-change).

## Setup

Staged go-live ladder: [`docs/DEPLOY.md`](docs/DEPLOY.md). Reference detail:
[`docs/SETUP.md`](docs/SETUP.md). The short version:

1. `npm test` locally (above) — no deploy needed.
2. Create the reporting spreadsheet, then either `npm run push` via clasp, or
   paste **both** `dist/Code.gs` and `dist/appsscript.json` (⚙ Project Settings →
   show the manifest). The manifest pins the OAuth scopes, and an explicit list
   there overrides Apps Script's automatic detection — so a stale manifest
   withholds permissions the code needs, with no prompt to tell you.
3. `Monthly Report → Setup → Settings` — fill in `TW_SPREADSHEET_ID` and `REGION`
   on the `Settings` **tab**. Not in `Config.gs`: pasting an updated `dist/Code.gs`
   replaces the whole project, so values in the code are lost on every update.
4. `Monthly Report → Setup → First-run check`. It verifies every prerequisite and
   tells you exactly what to fix.
5. `Monthly Report → Build report`, then `Diagnostics → Run self-test`. Check the
   Reconciliation block.
6. Optional but recommended: convert the deck to Google Slides, set
   `DECK_TEMPLATE_ID`, install the MCC script, then
   `Automation → Set up / repair monthly run`.

Nothing here writes to Google Ads or to the Triple Whale sheet, and the deck
template is copied rather than modified — the realistic worst case is a wrong
number in a draft deck.

**One reporting sheet per region.** Deploy the project twice — once for US, once
for EU — with different `REGION`, `TW_SPREADSHEET_ID` and `DECK_TEMPLATE_ID`.
That mirrors how the Triple Whale sheets are already split, and prevents dollars
being added to euros.

Monthly rhythm: [`docs/MONTHLY-CHECKLIST.md`](docs/MONTHLY-CHECKLIST.md).
Cell-by-cell provenance: [`docs/DATA-DICTIONARY.md`](docs/DATA-DICTIONARY.md).

---

## Layout

```
apps-script/            bound to the reporting spreadsheet
  Config.gs             every knob — defaults for everything below
  Settings.gs           per-deployment settings on a spreadsheet TAB, so they
                        survive pasting an updated dist/Code.gs
  Metrics.gs            the measurement contract: components in, ratios out
  Ingest.gs             read Triple Whale + engine tabs; period/date math
  Classify.gs           campaign → tactic / brand, with manual overrides
  Report.gs             the Report tab; slides 3–7, 13, reconciliation
  ReportDetail.gs       slides 8–12; the manual-input tabs
  ProductImages.gs      slide 11 imagery from the Shopping feed
  Webhook.gs            receives the Microsoft Ads script's POST → _eng_bing
  Slides.gs             fills a copy of the deck from the named ranges
  SelfTest.gs           the invariants — runs live AND in the local harness
  Diagnostics.gs        read-only inspections
  Code.gs               menu, scheduled run, first-run check
  Util.gs               dates, the live _status log

google-ads-script/
  engine-report.js      MCC-level Google Ads Script → _eng_* tabs

microsoft-ads-script/
  engine-report-bing.js Microsoft Advertising Script → POSTs to the Web App

tools/
  harness.js            run the report locally, no Google account needed
  make-sample-store.js  synthetic Triple Whale store, so npm test needs no export
  bundle.js             writes dist/Code.gs + dist/appsscript.json
  fixtures/             synthetic engine data — also the _eng_* tab contract

template/
  Xero_Shoes_Monthly_Reporting_Framework.pptx

docs/
  DEPLOY.md  SETUP.md  DATA-DICTIONARY.md  MONTHLY-CHECKLIST.md  GAPS.md
```

Related: [`ld-x-tw-script`](https://github.com/aric-lockhern/ld-x-tw-script) is
the upstream Triple Whale → Sheets project this reads from.

Lockhern Digital — internal reporting tool.

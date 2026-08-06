# Setup

Two pieces install separately, and the first one is useful on its own:

- **A** — the Apps Script in a reporting spreadsheet. Gives you slides 3–7 and 13
  from Triple Whale alone. ~15 minutes.
- **B** — the Google Ads Script in the MCC. Adds slides 8–12. ~15 minutes.

Do A, confirm the numbers look right, then do B. Repeat both per region.

---

## A · The reporting spreadsheet

### A1. Create the spreadsheet

New Google Sheet, named e.g. `Xero Shoes — Monthly Report (US)`. This is **not**
the Triple Whale sheet — keep them separate so a rebuild here can never touch the
Triple Whale store.

### A2. Paste the code — BOTH files

Extensions → Apps Script.

**File 1 — the code.** Paste `dist/Code.gs` over the default `Code.gs`. That single
file is every `apps-script/*.gs` concatenated; Apps Script shares one global scope,
so it behaves identically to the separate files.

**File 2 — the manifest.** ⚙ Project Settings → tick **"Show appsscript.json
manifest file in editor"**, open `appsscript.json` from the file list, and paste
`dist/appsscript.json`.

> **Both files matter, and the manifest is the one people skip.** An explicit
> `oauthScopes` list in the manifest **OVERRIDES Apps Script's automatic scope
> detection**. So a manifest written before the code needed a permission withholds
> that permission *permanently* — Apps Script believes the existing authorisation
> is sufficient and never prompts, and running from the editor does not help
> either. The symptom is a runtime error like "You do not have permission to call
> UrlFetchApp.fetch" that no amount of re-authorising fixes.
>
> After any update that adds a capability, re-paste **both** files. `npm run
> bundle` writes them side by side for exactly this reason.
>
> If you would rather not think about it: delete the `oauthScopes` key entirely.
> Apps Script then infers scopes from the code on every save, which cannot go
> stale. The explicit list is only there to document what the project needs.

> Time zone must match the Triple Whale project — `America/New_York` — or month
> boundaries can disagree by a day between the two sheets.

### A3. Configure — on the `Settings` TAB, not in the code

Reload the spreadsheet, then **`Monthly Report → Setup → Settings`**. That creates
a `Settings` tab and shows the values currently in effect.

Edit the **Value** column:

| Setting | Value |
|---|---|
| `TW_SPREADSHEET_ID` | US `1TK1xPqrwf4Zr1_DA7GcYVDf-sXKKagla-sS_hs631Cs` · EU `1Qf-YpWXlOLUhSdLE6E1PZ1W37lDH1JPbc-ancEF5w8w` |
| `REGION` | `US` or `EU` |
| `CURRENCY` | `USD` or `EUR` |
| `REPORT_MONTH` | leave **empty** for the last complete month |

Nothing to save beyond the cell — the next build reads it.

> **Why a tab and not `Config.gs`?** Pasting an updated `dist/Code.gs` replaces the
> entire Apps Script project, `Config.gs` included, so anything typed into the code
> is wiped on every update — and the symptom appears a step removed from the cause
> ("Deck generation skipped (DECK_TEMPLATE_ID is not set)"). The Settings tab lives
> in the spreadsheet and survives code updates.
>
> `Config.gs` still holds every constant and those remain the defaults; a non-empty
> cell on the tab overrides one. Things that are genuine code changes —
> classification rules, deck row counts, column order — stay in `Config.gs`, where
> the self-test checks them.

An invalid value is reported and **ignored**, falling back to the `Config.gs`
default, rather than being applied.

The account running this script needs at least **view** access to the Triple Whale
sheet.

### A4. First-run check

Reload the spreadsheet. `Monthly Report → Setup → First-run check`.

It verifies the Triple Whale sheet opens, reports its date coverage, checks which
periods have data, looks for the engine tabs, and validates the deck template.
Anything wrong comes back as a numbered list of fixes. Fix and re-run until it
says **ready**.

### A5. Build

`Monthly Report → Build report`.

You get:

| Tab | What it is |
|---|---|
| `Report` | one block per deck table, each a named range (`RPT_*`) |
| `Campaign Map` | every campaign, its classification, and your override columns |
| `_status` | live run log, newest first |

**Check two things before trusting it:**

1. **The Reconciliation block** at the bottom of `Report`. "In neither tactic
   table" should be small (Demand Gen and stragglers). The two "no brand
   assignment" rows should be ~0 — if not, slides 6–7 are under-reporting their
   slide 5 parent.
2. **Amber rows on `Campaign Map`** — campaigns no rule could place. Pin them
   with the `Tactic (override)` / `Brand (override)` columns. Overrides survive
   every rebuild.

`Diagnostics → List unclassified campaigns` lists the same thing with dollars
attached. Zero-cost rows carrying revenue are normal — that's Triple Whale
attributing late orders to renamed or paused campaigns.

### A6. The manual input tabs

`Monthly Report → Setup → Create the manual input tabs` creates:

- **`Auction Insights`** — competitor auction data. Google exposes this through
  no API at any access level, so slide 9's competitor block is a paste. Google Ads
  → Campaigns → select the brand campaigns → Insights → Auction insights →
  download → paste, with `Month` as `yyyy-MM`.
- **`Promos`** — promo windows (`Promo Name`, `Start`, `End`, dates as
  `yyyy-MM-dd`). Any promo overlapping the report month drives slide 12. Leave it
  empty in months with no promotion.

### A7. The deck (optional)

`SlidesApp` can only write to native Google Slides, so the template must be a
Slides file, not a `.pptx`.

**Easiest:** `Monthly Report → Setup → Find the deck template in Drive`. It
searches for a Google Slides file with "Reporting Framework" in the title and
writes the id to the `Settings` tab for you. If several match it lists them for you
to pick.

**If none is found**, convert it once: upload
`template/Xero_Shoes_Monthly_Reporting_Framework.pptx` to Drive, open it, **File →
Save as Google Slides** — that makes a *new* file — and put that new file's id in
`DECK_TEMPLATE_ID` on the `Settings` tab.

> Use the **converted** file's id, never the `.pptx`'s, and always the **pristine**
> template rather than a previously generated deck: the slide-3 stat cards are
> matched by their `$—` placeholders and only fill on an untouched template.
>
> The template is **copied, never modified** — `writeDeck_` calls `makeCopy()` and
> throws if the copy's id ever equals the template's.

Then `Diagnostics → Validate the deck template`. It checks every table's
dimensions against the block that feeds it. A mismatched table is **skipped** at
build time rather than half-filled — a half-filled client table is worse than an
empty one, because it looks finished.

Now `Monthly Report → Build report + generate deck`. The template is copied, never
modified.

---

## B · The Google Ads Script (slides 8–12)

Runs inside Google Ads: no developer token, no OAuth client, no GCP project.

### B1. Install

Google Ads **MCC** → Tools → Bulk actions → **Scripts** → **+** → paste
`google-ads-script/engine-report.js`.

### B2. Configure

```js
var CONFIG = {
  SPREADSHEET_ID: '1XyZ…',   // the MONTHLY REPORT sheet, not Triple Whale
  CUSTOMER_IDS: [],          // [] = every account under this MCC
  MONTHS_BACK: 14,
  DETAIL_MONTHS_BACK: 3,
  …
};
```

Set `CUSTOMER_IDS` to just the region's accounts, e.g.
`['123-456-7890']`. **Keep US and EU as separate script runs writing to separate
spreadsheets** — mixing currencies in one set of tabs would silently add dollars
to euros.

### B3. Authorise and run

**Preview** first — it will prompt to authorise the spreadsheet. Then **Run**.

Check the `_eng_status` tab in the reporting sheet. Every report is isolated, so
one broken query doesn't take down the run:

| Status | Meaning |
|---|---|
| `OK` | wrote cleanly |
| `PARTIAL` | some accounts failed; see the errors column |
| `FAILED — tab left unchanged` | nothing came back; the previous good data was **kept**, not blanked |

A `FAILED` row almost always means a GAQL field name changed in a newer Google Ads
API version. Fix that one query in `engine-report.js` — the reports are
independent, so the others already landed. The queries are small and each lives in
its own `fetch*_` function.

### B4. Schedule

Schedule the script **monthly, on day 1**. It must run before the Apps Script
side, which defaults to day 3.

---

## C · Automation

`Monthly Report → Automation → Set up / repair monthly run` installs a trigger for
**day 3 of each month at ~07:00**, reporting the previous calendar month.

Why day 3: Triple Whale attributes with a 28-day window, and its own daily sync
reconciles the last 30 days. Day 3 gives the closing month two daily syncs to
settle before this reads it.

The full monthly chain:

| Day | What runs | Where |
|---|---|---|
| daily ~06:00 | Triple Whale sync | `ld-x-tw-script` |
| 1st | Google Ads engine feed | MCC script |
| 3rd ~07:00 | build report + deck | this project |

`Automation → Automation status` shows what's installed. Failures surface in
`_status` and Apps Script emails you.

---

## Troubleshooting

**"Cannot open the Triple Whale spreadsheet"** — wrong ID, or the account running
this script lacks access to it.

**"The Triple Whale `_store` tab is empty"** — run `Triple Whale → Sync now` in
that sheet first.

**Everything reads `n/a`** — the report month isn't covered by the Triple Whale
store. `Diagnostics → Show period coverage` shows the ranges. Either sync that
sheet or pin `REPORT_MONTH` to a month it has.

**`%YoY` is `n/a`** — expected until the Triple Whale backfill reaches a year
back. Set `BACKFILL_START` in `ld-x-tw-script` to the year-ago month's first day
and run its `Rebuild all data — background`. It's one API call per day of history,
so allow time. See [`GAPS.md`](GAPS.md).

**Search + Shopping don't equal Blended** — by design; Demand Gen belongs to
neither. The Reconciliation block quantifies it.

**A deck table stayed empty** — run `Diagnostics → Validate the deck template`.
Either the deck table's shape or the `*_ROWS` constants in `Config.gs` need to
change.

**Slide 3 cards didn't fill** — the writer matches the `$—` / `—x` placeholders,
so it can only fill an *unfilled* template. Make sure `DECK_TEMPLATE_ID` points at
the pristine template, not a previously generated deck.

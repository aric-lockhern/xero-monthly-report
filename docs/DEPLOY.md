# Pressure test, then go live

**There are two deployments, not eleven.** The ten `.gs` files are *one* Apps
Script project — Apps Script shares a single global scope across files, so the
split is organisation only. The second deployment is the Google Ads Script in the
MCC. `clasp` reduces the first to one command.

The ladder below is ordered so each rung is cheap and catches a different class of
problem. Rung 0 needs no Google account at all.

Total: about an hour for US, then ten minutes to clone to EU.

---

## Why the blast radius is small

Worth knowing before you start, because it changes how carefully you need to tread:

- This project **only reads** the Triple Whale sheet. It cannot corrupt it.
- It **only reads** Google Ads. Nothing here writes to a campaign, budget or bid.
- The reporting spreadsheet is **brand new** — nothing to break.
- The deck template is **copied, never modified**.

The realistic worst case is a wrong number in a draft deck. That's what the
self-test is for.

---

## Rung 0 · Local, no deploy  ·  2 minutes

The fastest loop, and the one to use for every future change.

```bash
# One-time
npm install                    # only needs @google/clasp; the harness is dependency-free

# Export the Triple Whale store once
#   In the Triple Whale sheet: right-click the tab strip -> unhide `_store`
#   File -> Download -> Comma-separated values (with _store active)
mv ~/Downloads/*_store.csv tools/.store.csv     # gitignored — real client data

npm test
```

You get the whole report built in memory and all ~100 invariants checked:

```
✓ all 102 invariants hold.
```

The exit code is non-zero on failure, so this drops into CI or a pre-commit hook
unchanged.

| Command | What it does |
|---|---|
| `npm test` | build + self-test, with synthetic engine data so slides 8–12 are exercised |
| `npm run test:bare` | same, without engine fixtures — the state you'll actually be in on day one |
| `npm run test:verbose` | also prints every block, so you can eyeball real numbers |
| `npm run test:eu` | EU region against `tools/.store-eu.csv` |
| `npm run check` | syntax-check every file |

Useful flags: `--month 2026-06` to rebuild a past month, `--blocks RPT_BLENDED`
to print just one table.

**What rung 0 proves:** ingest, classification, component summing, ratio
derivation, block layout, named-range shapes against the real deck's dimensions,
and the `n/a`-never-zero discipline. **What it can't:** that Sheets and Slides
behave as expected. That's rung 2 onward.

### Read the numbers, not just the ticks

Run `npm run test:verbose` once and check three things against the Google Ads and
Triple Whale UIs for the same month: blended **Cost**, **TW Revenue**, and
**Engine Orders**. If those three tie out, the pipeline is sound.

---

## Rung 1 · Create the spreadsheet  ·  5 minutes

New Google Sheet, `Xero Shoes — Monthly Report (US)`. Extensions → Apps Script.
In the new project: Project Settings → **Script ID** → copy it.

```bash
cp .clasp.json.example .clasp.json      # then paste the Script ID into it
npx clasp login                          # once per machine
npm run push                             # pushes all 10 files + the manifest
```

`rootDir` is already `apps-script`, which holds both the `.gs` files and
`appsscript.json` (clasp needs that as the manifest — it sets the time zone and
OAuth scopes).

> If you'd rather not use clasp: create ten files in the editor and paste. Also
> tick Project Settings → "Show appsscript.json" and paste that in. It works, it's
> just tedious, and every later fix is tedious again.

Then configure on the **`Settings` tab**, not in the code:
`Monthly Report → Setup → Settings`.

> Settings live in the spreadsheet because pasting an updated `dist/Code.gs`
> replaces the whole project including `Config.gs`. A value typed into the code is
> lost on every update; a value on the tab survives.

---

## Rung 2 · First-run check  ·  2 minutes

Reload the spreadsheet, then `Monthly Report → Setup → First-run check`.

It verifies the Triple Whale sheet opens, reports its coverage, checks each
period, looks for the engine tabs, and validates the deck template. Failures come
back as a numbered list of fixes. Re-run until it says **ready**.

This is where a wrong ID, a missing share, or a time-zone mismatch surfaces —
cheaply, before anything is built.

---

## Rung 3 · Build the Report tab  ·  5 minutes

`Monthly Report → Build report`, then `Diagnostics → Run self-test`.

**The self-test is the same code as `npm test`** (`apps-script/SelfTest.gs`), so
the tick count should match what you saw at rung 0 — modulo engine checks, since
the real sheet has no `_eng_*` tabs yet.

Then, by hand:

- **Reconciliation block** — "Search with no brand assignment" and "Shopping with
  no brand assignment" should be ~0.
- **`Campaign Map`** — amber rows are campaigns no rule could place. Pin them with
  the override columns.
- **Cross-check** blended Cost / TW Revenue / Engine Orders against the platforms.

Stop here for a day if you like. The Report tab alone is usable — the named ranges
paste straight into the deck.

---

## Rung 4 · The deck  ·  10 minutes

`SlidesApp` can only write native Google Slides, so convert the template once:

1. Upload `template/Xero_Shoes_Monthly_Reporting_Framework.pptx` to Drive.
2. Open it → **File → Save as Google Slides**. This creates a *new* file.
3. Put that new file's ID in `DECK_TEMPLATE_ID` on the **`Settings` tab**. **Not**
   the uploaded `.pptx`'s. Or just run `Setup → Find the deck template in Drive`.

`Diagnostics → Validate the deck template` checks all eleven tables against the
blocks that feed them. **This is the one check the local harness cannot do** — it
compares against the actual converted deck, catching anything the conversion
reshaped.

Then `Monthly Report → Build report + generate deck`.

A mismatched table is **skipped**, not half-filled, and named in `_status`. A
half-filled client table is worse than an empty one because it looks finished.

> The slide-3 stat cards are matched by their `$—` / `—x` placeholders, so the
> writer can only fill a *pristine* template. Keep `DECK_TEMPLATE_ID` pointed at
> the untouched template, never at a generated deck.

---

## Rung 5 · The Google Ads Script  ·  15 minutes

Google Ads **MCC** → Tools → Bulk actions → Scripts → **+** → paste
`google-ads-script/engine-report.js`.

```js
SPREADSHEET_ID: '1XyZ…',        // the MONTHLY REPORT sheet, not Triple Whale
CUSTOMER_IDS: ['123-456-7890'], // just this region's accounts
```

**Preview**, then **Run**.

> Preview does not apply changes to Google Ads entities, but it *does* execute
> `SpreadsheetApp` writes. So a preview will really write the `_eng_*` tabs. That's
> fine and desirable here — this script only reads Ads.

Check `_eng_status`. Every row should say `OK`.

| Status | Meaning |
|---|---|
| `OK` | wrote cleanly |
| `PARTIAL` | some accounts failed; see the errors column |
| `FAILED — tab left unchanged` | previous good data **kept**, not blanked |

A `FAILED` row almost always means a GAQL field name changed in a newer Google Ads
API version. Each report is isolated in its own `fetch*_` function, so fix that
one query — the others already landed. Then re-run rungs 3–4; slides 8–12 fill in.

**To reproduce an engine-tab problem locally**, copy the real tab into a fixture
file shaped like `tools/fixtures/engine-sample.json` and run
`node tools/harness.js --store tools/.store.csv --engine my-fixture.json`.

---

## Rung 6 · Automation  ·  2 minutes

- Google Ads Script → schedule **monthly, day 1**.
- `Monthly Report → Automation → Set up / repair monthly run` → day 3, ~07:00.

Day 3 gives the Triple Whale sheet two daily syncs to settle the closing month's
late attribution.

| Day | What runs |
|---|---|
| daily ~06:00 | Triple Whale sync (`ld-x-tw-script`) |
| 1st | Google Ads engine feed |
| 3rd ~07:00 | this project → Report tab + deck |

Verify with `Automation → Automation status`. Failures land in `_status` and Apps
Script emails you.

---

## Rung 7 · Clone to EU  ·  10 minutes

Everything is already parameterised, so this is config only.

New spreadsheet, then:

```bash
cp .clasp.json .clasp.us.json            # keep the US link
# create .clasp.json with the EU Script ID
npm run push
```

In `Config.gs` on the EU project: `REGION = 'EU'`, `CURRENCY = 'EUR'`, the EU
`TW_SPREADSHEET_ID`, and an EU `DECK_TEMPLATE_ID`. In the Ads script, a second
copy with the EU `CUSTOMER_IDS` and the EU `SPREADSHEET_ID`.

> **Never point both regions at one spreadsheet.** There's no FX conversion
> anywhere — `CURRENCY` only picks a number format — so a shared sheet would add
> euros to dollars silently.

---

## After any code change

```bash
npm run check && npm test && npm run push
```

Then in the sheet: `Build report` → `Diagnostics → Run self-test`.

The self-test is deliberately non-vacuous. It was validated by injecting five real
faults and confirming each is caught:

| Injected fault | Caught by |
|---|---|
| impression share averaged instead of volume-weighted | D |
| Triple Whale columns summing to 0 on engine-only periods | E |
| Performance Max folded into Search instead of Shopping | G |
| `PRODUCT_ROWS` drifting from the deck's 16 | G, A |
| a column dropped from the main table | G, A |

That third one is why check G exists: moving PMax between tactics keeps every
arithmetic identity valid — it's still a partition — while silently moving six
figures of spend between slides 5 and 7. Arithmetic checks alone cannot see it, so
`checkDeckContract_()` pins the deck's *definitions* as well as its numbers.

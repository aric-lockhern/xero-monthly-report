# Monthly checklist

Once automation is installed, most of this happens on its own. What's left is the
review — the part where you catch a renamed campaign before a client does.

Budget ~20 minutes for the data review, then write the narrative.

---

## Automatic (no action)

| Day | What runs |
|---|---|
| daily ~06:00 | Triple Whale sync (`ld-x-tw-script`) |
| 1st | Google Ads engine feed (MCC script) → `_eng_*` tabs |
| 3rd ~07:00 | this project → `Report` tab + generated deck |

---

## 1 · Before the build (do on the 1st or 2nd)

**☐ Paste last month's auction insights.**
Google Ads → Campaigns → select the brand campaigns → Insights → Auction insights
→ download. Paste into the `Auction Insights` tab with `Month` as `yyyy-MM`.
Nothing else can produce this data ([GAPS §1](GAPS.md)).

**☐ Paste last month's PMax search categories.**
Google Ads → Campaigns → Insights → *Search terms insights* → **Download**. Paste
into the `PMax Categories` tab — the export's own headers are fine, and a blank
`Month` counts as the report month. This takes priority over the automated feed and
is the reliable way to fill slide 10 ([GAPS §4](GAPS.md)). Skip it only if
`_eng_pmax_cat` came back populated.

**☐ Add any promo windows.**
`Promos` tab: `Promo Name`, `Start`, `End` as `yyyy-MM-dd`. Skip if there was no
promotion — and delete slide 12 from the deck, as its speaker notes say.

**☐ Confirm the engine feed ran.**
`_eng_status` tab. Every row should say `OK`. A `FAILED` row means slides 8–12 will
be empty or stale — see [SETUP §B3](SETUP.md).

---

## 2 · After the build (on the 3rd)

**☐ Read the warning block** at the top of the `Report` tab. Amber lines explain
anything reading `n/a`.

**☐ Check the Reconciliation block** at the bottom. Three numbers:

| Row | Should be | If not |
|---|---|---|
| In neither tactic table | small — Demand Gen + strays | pin campaigns on `Campaign Map` |
| Search with no brand assignment | **~0** | slides 6 under-report slide 5 — pin them |
| Shopping with no brand assignment | **~0** | slide 7 under-reports slide 5 — pin them |

**☐ Scan `Campaign Map` for amber rows.** Those are campaigns no rule could place.
Use `Tactic (override)` / `Brand (override)` — overrides survive every rebuild.
`Diagnostics → List unclassified campaigns` shows the same list with dollars.

> Zero-cost rows carrying revenue are normal — Triple Whale attributing late orders
> to renamed or paused campaigns. Only pin them if the revenue is material.

**☐ Sanity-check three figures against the platforms.** Blended `Cost`, `TW
Revenue`, and `Engine Orders` for the month. If cost is off, a campaign is
mis-channelled or a Triple Whale day didn't sync.

**☐ If a campaign was renamed mid-month**, Triple Whale will show it as two
campaigns. Both classify fine, so the tables are right — but the `Campaign Map`
will look duplicated. That's expected.

---

## 3 · Finish the deck

The generated deck has every table, the stat cards, the product cards, the cover
dates and the footers. What's left:

**☐ Slide 9 — paste the impression-share chart.** Copy the chart at the bottom of
the `Report` tab, paste over slide 9's placeholder chart. Paste **linked** and
future rebuilds update it in place ([GAPS §7](GAPS.md)).

**☐ Slide 11 — drop in product imagery** from the Shopping feed.

**☐ Slide 12 — add the ad-unit screenshot.** Duplicate the slide per promo if there
was more than one.

**☐ Write the narrative.** Slides 3, 4, 5, 6, 7, 12, 13 have `[…]` placeholders.
Deliberately not generated ([GAPS §5](GAPS.md)) — the numbers are on the slide, the
interpretation is the deliverable.

**☐ Slide 14 — Next Steps.** Four items max, and keep them consistent with the
"Next Month Focus" block on slide 3.

**☐ Delete slides that don't apply this month** (no promo → drop 12; no ChatGPT
spend → drop 13).

---

## Off-cycle

**Rebuilding a past month** — `Monthly Report → Report a specific month…`. Affects
that run only; `Config.gs` isn't modified.

**After renaming campaigns in-platform** — rebuild and re-check `Campaign Map`.
Renames are the single most common cause of a split moving unexpectedly
([GAPS §9](GAPS.md)).

**Before you'll need `%YoY`** — extend the Triple Whale backfill *well* in advance;
it's one API call per day of history ([GAPS §2](GAPS.md)).

**Quarterly** — `Diagnostics → Validate the deck template` after anyone edits the
deck, and skim `_eng_status` for `PARTIAL` rows that have been failing quietly.

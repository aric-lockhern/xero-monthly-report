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

**☐ Paste last month's auction insights — SEGMENTED BY WEEK.**
Google Ads → Campaigns → select the brand campaigns → Insights → Auction insights →
**segment by week** → download. Paste into the `Auction Insights` tab; the export's own
headers work as-is, and the `You` row should stay. Include the week that straddles the
month boundary — it is read into both months on purpose. Nothing else can produce this
data ([GAPS §1](GAPS.md)).

**☐ Slide 10 (PMax search terms) — normally nothing to do.**
The MCC script fills `_eng_pmax_term` from `campaign_search_term_view`. Only if that
tab is empty: Google Ads → Campaigns → Insights → search terms → **Download** → paste
into the `PMax Categories` tab. The export's own headers are fine, a blank `Month`
counts as the report month, and brand terms are filtered out at build time so paste
everything ([GAPS §4](GAPS.md)).

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

**☐ Slide 9 — paste the charts.** Two are generated at the bottom of the `Report` tab:
our brand impression share by day, and competitor impression share by week. Copy the
one the slide needs and paste over slide 9's placeholder chart. Paste **linked** and
future rebuilds update it in place ([GAPS §7](GAPS.md)).

**☐ Slide 11 — check the product photos landed.** They are inserted automatically
from the Shopping feed, matched by product title. Any frame still showing "Product
Image" means no match: run `Setup → Product image status`, which prints the key it
looked for and the closest feed titles, then paste that one `image_url` into the
`Product Images` tab by hand — manual rows survive every refresh.

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

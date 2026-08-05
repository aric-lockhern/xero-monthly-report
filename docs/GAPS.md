# Gaps — what isn't automated, and why

Read this before promising anyone a fully hands-off deck. Each gap says what's
missing, why, and what it would take to close it.

Ordered by how likely it is to bite you.

---

## 1. Auction insights (slide 9, competitor block) — cannot be automated

**Google exposes auction insights through no API and no script surface, at any
access level.** Not the Google Ads API, not Google Ads Scripts, not for Search,
Shopping or Performance Max. Third-party Looker Studio access was cut off in 2024.
A feature request has been open for years.

Everything else on slide 9 *is* automated: `metrics.search_impression_share` gives
our own brand impression share, by day, rolled up correctly.

**Workaround (built in):** the `Auction Insights` tab. Google Ads → Campaigns →
select the brand campaigns → Insights → Auction insights → download → paste, with
`Month` as `yyyy-MM`. The parser handles `42%`, `0.42`, `42` and Google's `< 10%`
floor (read as 10%).

**To close it:** nothing you can build. Watch the Google Ads API release notes.

---

## 2. `%YoY` is `n/a` until Triple Whale backfills a year

The Triple Whale store currently starts **2026-06-01**, because `BACKFILL_START`
is pinned there in `ld-x-tw-script`. The deck asks for `% YoY` on slides 4–7 and 13.

**What happens now:** if Google Ads engine data covers the year-ago month, the
engine columns of the `% YoY` row are computed from it and the Triple Whale columns
read `n/a` — with a warning on the Report tab saying so, and noting that Microsoft
is excluded from that row (the engine feed is Google-only). If neither source
covers it, the whole row reads `n/a`.

It never invents a number. That's the point: an engine-only period summing Triple
Whale revenue to `0` would make `% YoY` claim revenue grew infinitely.

**To close it:** in `ld-x-tw-script/Code.gs`, set

```js
var BACKFILL_START = '2025-06-01';   // or earlier
```

then run `Triple Whale → Rebuild all data — background` and watch its `_status`
tab. It's one API call per day of history — roughly 425 days for a year of extra
depth — so it will span several runs via its own `resumeSync` trigger. Do this
well before you need the YoY row.

For the engine side, `MONTHS_BACK: 14` in `engine-report.js` already covers it.

---

## 3. "TW Sessions" and therefore true CVR (slides 4–7, 13)

The deck has a `TW Sessions` column and defines `TW CVR` against it. The Triple
Whale `_store` tab **does not carry sessions** — `ld-x-tw-script`'s `STORE_FIELDS`
has spend, revenue, orders, new-customer orders/revenue, engine conversions and
value, clicks and impressions.

**What happens now:** `TW Sessions` reads `n/a`, and `TW CVR` is computed as
Triple Whale orders ÷ **clicks**, with a warning on the Report tab. Clicks are a
defensible CVR denominator for paid media — arguably better than sessions, since
it isolates ad performance from onsite redirect loss — but it is **not** the same
number the deck's header implies.

**To close it:**

1. In `ld-x-tw-script`, run `Diagnostics → Discover pixel columns` to find the
   sessions column name in `pixel_joined_tvf()` (likely `sessions` or
   `total_sessions`).
2. Add it to `STORE_FIELDS` and to `sumInto_()` in that project, then rebuild.
3. Here, set `TW_SESSION_FIELD = 'sessions'` (matching the `_store` header) and
   `CVR_BASIS = 'sessions'`.

The ingest reads columns **by header name**, so nothing else needs changing.

If you'd rather source sessions from GA4, that's a third connector and a
`sessionDefaultChannelGroup` mapping problem — worth it only if the client
specifically asks for GA4-consistent CVR.

---

## 4. "Search Volume" on slide 10 — not in the API

`campaign_search_term_insight` returns impressions, clicks, conversions and
conversion value per search category. It does **not** return the bucketed search
volume the Google Ads UI displays.

**What happens now:** the column reads `n/a` and the block's note says why. Use
`Impr.` — it's on the same table — or type the UI figure in by hand.

Also note this resource must be queried **one campaign at a time** (it can't be
scanned across an account), which is why the script lists PMax campaigns first and
loops. And it reports no cost, which is why slide 10 has no spend column.

---

## 5. Narrative bullets — deliberately manual

Slides 3–7 and 12 carry `[Headline #1 — …]` placeholders. The Slides writer leaves
them alone.

This is a choice, not an omission. A generated sentence about "revenue up 19% MoM"
restates the table directly above it, and reads as filler to exactly the audience
you're writing for. The numbers are on the slide; the interpretation is the value
you're being paid for.

Slide 14 (Next Steps) is manual for the same reason.

---

## 6. Imagery — manual

**Slide 11 product cards:** names, orders and revenue are filled from
`RPT_TOP_ITEMS`. The image frames are not. Pull shots from the Shopping feed.

**Slide 12 promo screenshot:** the ad-unit screenshot placeholder is manual.

Automating these would mean fetching product images from the Merchant Center feed
and inserting them into Slides — possible, but a lot of machinery for a 30-second
drag-and-drop.

---

## 7. Slide 9's chart object

The framework deck's chart is a native PowerPoint chart carrying **sample data**.
Once converted to Google Slides, `SlidesApp` cannot rewrite its series.

**What happens now:** the Report tab builds a proper line chart from
`RPT_BRAND_IS` and parks it at the bottom. Copy it and paste it over the
placeholder — which is what the deck's own speaker notes tell you to do. Paste as
**linked** and next month's rebuild updates it in place.

---

## 8. Microsoft Ads engine detail

Triple Whale gives us Bing spend, clicks, impressions, engine-reported
conversions and value, and attributed revenue — so Microsoft **is** in the blended
and Search/Shopping tables.

What's missing is Microsoft-only *detail*: its product taxonomy, its share-of-voice
data, its asset performance. Slides 8–12 are therefore Google-only, which is
consistent with the deck's own footnotes ("Engine data").

**To close it:** the Microsoft Advertising Reporting API. It needs a developer
token and OAuth, and its SOAP/bulk-download reporting flow is materially more work
than the Google Ads Script was. Add it behind the same `_eng_*` tab contract —
write rows with `channel = 'bing'` and nothing downstream changes.

Note the one asymmetry this creates: the engine-only `%YoY` fallback (gap 2) is
Google-only, so it under-reports total spend for that row. The Report tab says so
in its warning.

---

## 9. Classification depends on campaign naming

Triple Whale reports campaign **names**, not types or labels, so the
Search/Shopping and Brand/Non-Brand splits come from regex rules in `Config.gs`.
When the engine tabs are present, campaign *type* comes from
`advertising_channel_type` instead — authoritative beats inferred — but the brand
axis is always name-derived, because brand/non-brand is an agency convention only
the naming carries.

This is genuinely fragile: rename a campaign and a split can move.

**Three things backstop it:**

- `Campaign Map` tab — every campaign, its classification, its spend. Amber rows
  are unclassified.
- Override columns on that tab, which beat the rules and survive rebuilds. This is
  how you pin the legacy Triple Whale rows (`brand`, `nonbrand`, `(not set)`, bare
  campaign ids) that no rule can sensibly match.
- The **Reconciliation block**, which states in dollars how much is unplaced —
  both "in neither tactic table" and "in a tactic table but with no brand
  assignment". The second one is the sneaky one: without it, a campaign can sit in
  Search while appearing in neither the Brand nor the Non-Brand table, and every
  table still looks internally consistent.

**Best long-term fix:** enforce a naming convention, or apply Google Ads **labels**
(`Brand` / `Non-Brand` / `Competitor`) and extend `engine-report.js` to export
`campaign.labels`. Then the brand axis becomes authoritative too. Worth doing —
the US account already shows the drift (`LD - US - BR - Search - Core` vs.
`LD - Brand - Core` vs. legacy `brand`).

---

## 10. Currency

No FX conversion anywhere. `CURRENCY` in `Config.gs` only picks a number format.
One region per spreadsheet, as the README insists. If someone ever wants a
combined global deck, that's a genuine design change — converting at what rate, on
what date, is a real decision, not a formatting one.

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

## 2. `%YoY` — solved for the front end, still limited for attribution

**This changed.** Google Ads and Microsoft Ads are now the SPINE, not enrichment.
Triple Whale is an overlay for attributed metrics only.

That means `%YoY` is **real** for every column the platforms measure — impressions,
clicks, cost, CTR, CPC, engine orders, engine revenue, engine ROAS — as far back as
the engine backfill reaches (`MONTHS_BACK: 26` in `engine-report.js`, two full
years).

What is still limited is the **attributed** columns: TW orders, TW revenue, TW CVR,
TW AOV, TW ROAS. Triple Whale's earliest data is around **May 2026**, with June
2026 the first complete month. Before that those columns read `n/a`.

That is the honest answer and the deck shows it plainly: a `%YoY` row with real
front-end numbers and `n/a` attributed ones, plus a warning saying why.

**Hard ceiling worth knowing:** since June 2026, Google returns a date-range error
for `segments.date` beyond **37 months**. `engine-report.js` refuses to run above
that rather than failing halfway. For history older than 37 months you would need
to switch the queries to `segments.month`.

**If you want attributed YoY too:** lower `BACKFILL_START` in `ld-x-tw-script` and
rebuild. But Triple Whale can only give you what it retained, so ~May 2026 is
probably the floor regardless of configuration. Treat engine-only YoY as the
permanent answer for FY2025 comparisons.

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

## 4. PMax search terms — solved, but not by the obvious resource

Slide 10 is a **Performance Max non-brand search TERMS** table, sorted by traffic.
Getting terms out of PMax needs the right resource, and two of the three obvious
candidates fail in ways that look like "there is no data" rather than like a mistake:

| Resource | What happens |
|---|---|
| `search_term_view` | **No Performance Max rows at all.** It aggregates at ad-group level and PMax has asset groups. The query succeeds and returns nothing. |
| `customer_search_term_insight` / `campaign_search_term_insight` | Returns **category labels** ("barefoot shoes"), not the terms. Also demands a single-resource filter or fails `REQUIRES_FILTER_BY_SINGLE_RESOURCE`, and can hit `RESOURCE_EXHAUSTED` at campaign granularity. |
| **`campaign_search_term_view`** | **This one.** Raw `search_term`, for PMax *and* Search, aggregated at campaign level, with full metrics including cost. |

So `fetchPmaxSearchTerms_` queries `campaign_search_term_view` filtered to
`campaign.advertising_channel_type = 'PERFORMANCE_MAX'`, into `_eng_pmax_term`.

> **Never add a keyword-related segment to that query** — `keyword.info.text` and
> friends. Google documents that doing so filters out every Performance Max row. The
> query still succeeds and still returns Search rows, so the symptom is "PMax
> apparently had no search terms", which is indistinguishable from a quiet account.

**Brand exclusion happens on the reading side**, via `BRAND_TERM_RE` in `Config.gs`,
so redefining brand is a rebuild rather than another 30-minute MCC run. It matches the
brand name and its common misspellings (`xeroshoes`, `zero shoes`) but deliberately
**not** model names like `prio` or `hfs`: those are Xero products, so a case can be
made either way, but treating them as brand empties the slide of exactly the discovery
terms it exists to show. The block's note prints the excluded impressions and cost so
the choice is visible and arguable.

`zero drop` is a trap worth naming — it is Xero's own product category and appears in
genuine non-brand queries, so a regex matching bare `zero` would swallow the single
most on-topic non-brand term on the slide. The self-test pins that.

**Still a paste if you need it.** The `PMax Categories` tab is read with priority over
the automated tab, so a UI export always wins. It accepts a "Search term" or a "Search
category" column, matched loosely.

**Search volume** is not available: the UI shows it as a bucketed range ("10K-100K")
attached to search *categories*, not terms. `Impr.` is the substitute and is what the
slide carries.

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

## 6. Slide 11 product images — automated, from your FEED not Google Ads

**The Google Ads API exposes no product image URL and no product link, on any
resource.** Confirmed by the Google Ads API team and still true.
`shopping_performance_view` gives the item id and title and stops. So no GAQL
query can ever return a photo.

The feed can. Set `PRODUCT_FEED_URL` on the `Settings` tab to your Merchant
Center / Shopping feed and run `Setup → Refresh product images`. It parses a
Google Shopping XML feed (`<g:id>` / `<g:image_link>`) or a TSV/CSV with `id` and
`image_link` columns, and fills a `Product Images` tab. The Slides writer then
inserts each image into slide 11's frames, fitted inside the frame preserving
aspect ratio rather than stretched — product shots are near-square, the frames are
portrait, and a distorted shoe on a client deck is worse than a slightly smaller
one.

Matching is by **title first, then item id** — and the title key is lower-cased with
every non-alphanumeric character stripped.

Both of those are deliberate, and both come from real misses:

- **Title before id.** A Shopping feed carries one row per **size variant**, each with
  its own item id, and an out-of-stock variant drops out of the feed entirely. So the
  exact id Google Ads reports may simply not be in the feed — while its sibling sizes
  are, sharing the title and therefore the photograph. For *imagery* the title is the
  correct key, because everything sharing a title looks identical.
- **Punctuation stripped, not just whitespace collapsed.** The feed and the Ads report
  disagree about punctuation: `Light Gray / Pink Sand` versus `Light Gray/Pink Sand`
  is the same product with different spaces around one slash. Under whitespace-only
  normalisation those are different keys and the frame silently stays empty. Safe to
  collapse this hard because the title carries the colourway, so two genuinely
  different products cannot normalise to the same key.

**Deliberately NOT attempted:** matching on the item id's product-level prefix
(`shopify_us_<product>_<variant>` → `shopify_us_<product>`). One Shopify product can
span several colourways, so that would resolve a pink shoe to a grey one.

When a product still doesn't resolve, `Setup → Product image status` prints the key it
looked for and the **closest titles in the feed**, which separates the two cases that
need opposite fixes: the feed titles this product differently (a long common prefix)
versus the product isn't in the feed at all (nothing close).

**A product with no match keeps its "Product Image" placeholder.** That is
deliberate: a visible gap is obvious and fixable in ten seconds, whereas the wrong
photo beside a product name is not. `Setup → Product image status` lists this
month's five products and ticks the ones that resolved.

Rows you type by hand carry `source=manual` and **survive every refresh**, so a
one-off override for a product the feed has no photo for is permanent.

If the URL 404s or needs a login, that one image is skipped and named in `_status`;
the rest of the deck is unaffected.

**Still manual:** slide 12's ad-unit screenshot.

---

## 6a. Slide 8's product dimensions depend on your FEED, not on Google

`shopping_performance_view` can segment by `product_custom_attribute0..4`,
`product_type_l1..l5`, `product_brand`, `product_condition`, `product_channel`,
`product_item_id` and `product_title`. Google will happily return any of them.

What it **cannot** tell you is which ones hold anything worth putting on a slide.
Custom labels are free text the Shopping feed sets, so a label can hold one value for
every product, or a gender, or a genuinely useful category — and nothing about which is
visible from the API, the docs, or the query.

In this account the answer is **Custom label 1 × Custom label 4**: label 1 is the
category (`shoe` / `boot` / `sandal`) and label 4 is the model (`prio` / `360` /
`dillon` / `scrambler low`). That is the default, confirmed against the account's own
Google Ads report rather than guessed. `product_type` also holds a taxonomy
(`shoes › female › shoes › 5.5`) but its second level is gender, which is not what the
slide is for.

So don't guess. `_eng_product_dims` — written by the MCC script, one query per
dimension — records every dimension's distinct values with spend and conversion
value. `Diagnostics → Show product dimensions` reads it, ranks each dimension by
whether it actually splits spend (a single value splits nothing; mostly `(not set)`
means the feed never populated it), recommends a pair, and prints the values so you
can overrule the recommendation on judgement.

Then set `PRODUCT_DIM_1` / `PRODUCT_DIM_2` on the **`Settings` tab**. Both sides read
those same cells — the Apps Script for the labels, the Google Ads Script for the
query — so there is no code to edit and the two cannot drift into disagreeing about
what the deck's columns mean. Re-run the MCC script, then rebuild.

Between the edit and that re-run, the tab still holds the **old** dimensions. The
block therefore heads its columns from the tab's own `dim1_field` / `dim2_field` and
states the disagreement in its note, rather than labelling real data with the
dimension you just asked for. This is the failure mode worth engineering against
here: the numbers look fine under the wrong heading.

**If no dimension in your feed splits spend usefully**, that is a feed change, not a
code change — populate a custom label with a category, or accept that slide 8 is
better served by the item-level table.

---

## 7. Slide 9's chart object

The framework deck's chart is a native PowerPoint chart carrying **sample data**.
Once converted to Google Slides, `SlidesApp` cannot rewrite its series.

**What happens now:** the Report tab builds a proper line chart from
`RPT_BRAND_IS` and parks it at the bottom. Copy it and paste it over the
placeholder — which is what the deck's own speaker notes tell you to do. Paste as
**linked** and next month's rebuild updates it in place.

---

## 8. Microsoft Ads history — the one real remaining gap

Triple Whale gives us Bing spend, clicks, impressions, engine-reported conversions
and value, and attributed revenue — from **June 2026 onward**. So Microsoft is
fully present in every table for the months Triple Whale covers.

The gap is Microsoft history **before** Triple Whale existed. Bing is ~**9%** of US
spend and ~**11%** of EU spend, so a `%YoY` row without it understates total spend
by roughly that much. The Report tab says so explicitly, with the percentage
computed from the current month.

Three ways to close it, cheapest first:

### (a) One-time paste into `_eng_manual` — recommended

`_eng_manual` has the same columns as `_eng_day` and **no script ever writes or
clears it**. `engine-report.js` refuses to touch it by name. Rows there are read
alongside the automated feed and are indistinguishable downstream.

1. Microsoft Advertising → Reports → Campaign performance
2. Daily granularity, last 2 years, columns: Impressions, Clicks, Spend,
   Conversions, Revenue
3. Export, then paste into `_eng_manual` mapped to these headers:

```
date | channel | account | campaign_id | campaign | channel_type |
channel_sub_type | labels | impressions | clicks | cost | conversions |
conversions_value | search_impression_share
```

Set `channel` to exactly **`bing`** (matching `TW_ADS_CHANNELS`). Leave
`campaign_id`, `labels` and `search_impression_share` blank if you don't have them
— only `date`, `channel`, `campaign` and the metrics are load-bearing.

Fifteen minutes, once, permanently fixes history. Ongoing Bing keeps coming from
Triple Whale automatically.

### (b) Microsoft Advertising Script

Microsoft Advertising has its own Scripts feature, and it *can* reach Google
Sheets — but only through the Sheets REST API with an OAuth access or refresh
token, not a native `SpreadsheetApp`. So it needs a Google Cloud OAuth client and
a refresh token generated and stored in the Bing script. That auth plumbing is the
whole cost; the reporting part is easy.

### (c) Microsoft Ads Reporting API from Apps Script

One codebase, in the same place as everything else. Needs a Microsoft developer
token, an Azure app registration, and a one-time OAuth consent for a refresh
token. The reporting flow is SOAP: submit a report request, poll for completion,
download a ZIP, `Utilities.unzip`, parse the CSV. Perhaps 200 lines, and it cannot
be tested without live credentials.

**Recommendation: (a) now, (c) later if the manual paste ever becomes annoying.**
Both write the same `_eng_*` shape, so swapping one for the other changes nothing
downstream — the Apps Script side does not know or care which produced a row.

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

**Now partly solved.** `engine-report.js` exports `campaign.labels`, and any label
matching `BRAND_LABEL_MAP` in `Config.gs` **beats the name regexes**. A label is
attached to the campaign, so it survives a rename; a regex reads the name, so it
does not.

**So the highest-value thing you can do in Google Ads** is apply three labels —
`Brand`, `Non-Brand`, `Competitor` — to every campaign. The brand axis then becomes
authoritative rather than inferred, and stays correct through any renaming. The US
account already shows the drift that makes this worth doing:
`LD - US - BR - Search - Core` vs. `LD - Brand - Core` vs. legacy `brand`.

Campaign *type* is already authoritative from `advertising_channel_type` wherever
engine data exists.

---

## 10. Currency

No FX conversion anywhere. `CURRENCY` in `Config.gs` only picks a number format.
One region per spreadsheet, as the README insists. If someone ever wants a
combined global deck, that's a genuine design change — converting at what rate, on
what date, is a real decision, not a formatting one.

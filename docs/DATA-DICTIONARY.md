# Data dictionary

Where every number on the deck comes from. Use this when a client asks "how is
this calculated?", or when a figure looks wrong and you need to trace it.

---

## The measurement rule

Nothing stores a ratio. `Metrics.gs` sums **raw components** and derives every
ratio at render time:

| Component | Triple Whale `_store` column | Google Ads (`_eng_day`) |
|---|---|---|
| `spend` | `spend` | `cost` (from `metrics.cost_micros` ÷ 1e6) |
| `impressions` | `impressions` | `metrics.impressions` |
| `clicks` | `clicks` | `metrics.clicks` |
| `eng_conv` | `channel_conv` | `metrics.conversions` |
| `eng_conv_value` | `channel_cv` | `metrics.conversions_value` |
| `tw_orders` | `orders_quantity` | — |
| `tw_revenue` | `order_revenue` | — |
| `tw_nc_orders` | `new_customer_orders` | — |
| `tw_nc_revenue` | `new_customer_order_revenue` | — |
| `sessions` | *(absent — see GAPS.md §3)* | — |
| `is_impr` / `is_eligible` | — | derived from `metrics.search_impression_share` |

`channel_conv` / `channel_cv` are Triple Whale passing through the **engine's own**
reported conversions and value — for Google *and* Bing. That is why the deck's
"Engine Orders / Engine Revenue / Engine ROAS" columns work without the Google Ads
API, and why Microsoft is included in them.

You cannot average a ratio, so summing components is the only form that reprojects
correctly to any grain. Change this and the tables will start disagreeing with each
other.

---

## The main table (slides 4–7)

15 columns. Column order in `tableColumns_()` **is** the deck's column order — the
Slides writer maps by position.

| Deck column | Formula | Source |
|---|---|---|
| Month | period label | derived |
| Impr. | `Σ impressions` | TW |
| Clicks | `Σ clicks` | TW |
| TW Sessions | `Σ sessions` | **`n/a`** — GAPS §3 |
| CTR | `Σ clicks ÷ Σ impressions` | TW |
| CPC | `Σ spend ÷ Σ clicks` | TW |
| Cost | `Σ spend` | TW |
| Engine Orders | `Σ channel_conv` | TW (engine passthrough) |
| Engine Revenue | `Σ channel_cv` | TW (engine passthrough) |
| Engine ROAS | `Σ channel_cv ÷ Σ spend` | TW |
| TW Orders | `Σ orders_quantity` | TW (attributed) |
| TW Revenue | `Σ order_revenue` | TW (attributed) |
| TW CVR | `Σ orders ÷ Σ clicks` | TW — **clicks, not sessions**, GAPS §3 |
| TW AOV | `Σ order_revenue ÷ Σ orders` | TW |
| TW ROAS | `Σ order_revenue ÷ Σ spend` | TW |

**Rows:** current month · prior month · `% MoM` · `% YoY`.

`% MoM` and `% YoY` are `(current − base) ÷ |base|`, computed on the **derived**
values. For ratio metrics that is the change in the ratio, which is what you want.
Returns `n/a` when either side is missing or the base is 0 — a change from zero is
undefined, not infinite growth.

**Attribution** is whatever the Triple Whale sheet is set to — `Last Click` /
`28_days` by default (`MODEL` / `ATTR_WINDOW` in `ld-x-tw-script`). The Report tab
header states this.

---

## Segmentation

Two independent axes, both per campaign, both overridable on `Campaign Map`.

**Tactic** — from `campaign.advertising_channel_type` when the engine tabs are
present, otherwise from `TACTIC_RULES` regexes on the campaign name:

`PMAX` · `SHOPPING` · `SEARCH` · `DSA` · `DEMAND_GEN` · `OTHER`

**Brand** — always from `BRAND_RULES` regexes on the name:

`BRAND` · `NON_BRAND` · `COMPETITOR` · `UNKNOWN`

**Deck group** — how tactics roll into the deck's split, per the framework's own
definition ("Search = text campaigns. Shopping = Standard Shopping + PMax retail"):

| Tactic | Deck group |
|---|---|
| `SEARCH`, `DSA` | Search (slide 5 top, slide 6) |
| `SHOPPING`, `PMAX` | Shopping (slide 5 bottom, slide 7) |
| `DEMAND_GEN`, `OTHER` | neither — blended only |

The deck's **Non-Brand** tables are `NON_BRAND` + `COMPETITOR`. Conquesting is
non-brand spend; splitting it out would leave slides 6/7 not summing to slide 5.

### Why the parts don't sum to the whole

Two gaps, both quantified in the Reconciliation block:

- **Blended ≠ Search + Shopping.** Demand Gen and unclassifiable campaigns are
  real spend in the blended total but belong to neither tactic table.
- **Search ≠ Brand + Non-Brand.** A campaign can have a tactic but no brand
  assignment. Without the reconciliation row this is invisible — every table
  renders and every table is internally consistent, while the brand split quietly
  under-reports. This row should be ~0; if it isn't, pin the campaigns.

---

## Slide by slide

### Slide 3 — Executive summary (`RPT_KPI`)
Four cards from the blended segment: `Total Spend` (`Σ spend`), `TW Revenue`
(`Σ order_revenue`), `Blended ROAS` (`tw_roas`), `TW Orders` (`Σ orders_quantity`),
each with `% MoM`. Filled by matching the `$—` / `—x` / `—` placeholders left to
right. ChatGPT Ads is excluded — it has its own slide.

### Slide 4 — Blended (`RPT_BLENDED`)
All `TW_ADS_CHANNELS` (`google-ads` + `bing`). The anchor table.

### Slide 5 — Search / Shopping (`RPT_SEARCH`, `RPT_SHOPPING`)
Deck group `SEARCH` / `SHOPPING`.

### Slides 6–7 — Brand vs. Non-Brand
`RPT_SEARCH_BRAND`, `RPT_SEARCH_NONBRAND`, `RPT_SHOP_BRAND`, `RPT_SHOP_NONBRAND`.

### Slide 8 — Product category (`RPT_PRODUCT`)
`_eng_product` ← `shopping_performance_view`, segmented by two **configurable**
product dimensions. Top 16 combinations by conversion value. `Avg. CPC` =
`Σ cost ÷ Σ clicks`; `ROAS` = `Σ conv_value ÷ Σ cost`.

**Default: `product_custom_attribute1` × `product_custom_attribute4`** — Custom label
1 × Custom label 4, matching the Google Ads report this slide is modelled on. In this
feed label 1 is the category (`shoe` / `boot` / `sandal`) and label 4 is the model
(`prio` / `360` / `dillon` / `scrambler low`).

Which two is a property of **your Shopping feed**, not of Google: custom labels are
free text the feed sets, so a label can equally well hold one value for every
product. Set `PRODUCT_DIM_1` / `PRODUCT_DIM_2` on the **`Settings` tab** — the Google
Ads Script reads those same cells, so one edit changes both sides and there is no
code to touch. Then re-run the MCC script and rebuild.

`Diagnostics → Show product dimensions` prints what every dimension actually
contains, with spend, and recommends a pair. It reads `_eng_product_dims`, which the
MCC script writes by probing each dimension with its own query (segmenting by
several at once reports the cross-product, not each dimension's own totals).

The two columns are **headed for what the tab holds**, from its `dim1_field` /
`dim2_field` columns — not for what `Settings` currently says. Between changing the
setting and the next MCC run those differ, and the block's note states the
disagreement. Labelling real numbers with a dimension they don't describe is the one
slide-8 failure that looks like success.

### Slide 9 — Impression share (`RPT_BRAND_IS`, `RPT_AUCTION`)
Ours: `metrics.search_impression_share` on brand-search campaigns, by day.

Rolled up as **`Σ impressions ÷ Σ eligible impressions`**, where eligible is
back-calculated per day as `impressions ÷ share`. Averaging daily percentages
would weight a \$2 day the same as a \$2,000 day. Only Search and Shopping
campaigns report this metric — PMax and Demand Gen don't, so the script queries it
separately for those two channel types.

Competitors: manual paste. GAPS §1.

### Slide 10 — PMax non-brand search terms (`RPT_PMAX_CAT`)
Raw Performance Max **search terms**, brand excluded, **sorted by impressions**.

Sources, in priority order:

1. **`PMax Categories`** tab — a hand paste. Column names matched loosely, so a
   Google Ads export works with its own headers; only a "Search term" column is
   required (a "Search category" column is accepted too). Numbers are parsed
   tolerantly (`1,234`, `$1,234.56`, `12%`), because `Number('1,234')` is `NaN` and
   one `NaN` summed into a column is a wrong slide with nothing visibly broken.
2. **`_eng_pmax_term`** ← `campaign_search_term_view`, filtered to
   `campaign.advertising_channel_type = 'PERFORMANCE_MAX'`, **one month** and
   **minimum 5 clicks in the month** (`TERM_MONTHS_BACK` / `TERM_MIN_CLICKS`). Queried
   one calendar month at a time with **no date segment** — with `segments.date` each
   row is a term-*day* and the click threshold would mean "five clicks in one day",
   silently dropping a term with four clicks a day for a month. GAPS §4.
3. **`_eng_pmax_cat`** — the older search-CATEGORIES tab, read only so an existing
   sheet still renders something until the MCC script next runs. The block says so.

> **Why `campaign_search_term_view` and not the obvious resource.** Three candidates,
> one works: `search_term_view` returns **no PMax data at all** (it aggregates at
> ad-group level, and PMax has asset groups — the query succeeds and yields nothing);
> `customer_search_term_insight` / `campaign_search_term_insight` return **category
> labels**, not terms, and demand a single-resource filter or fail
> `REQUIRES_FILTER_BY_SINGLE_RESOURCE`; `campaign_search_term_view` returns the raw
> term for PMax *and* Search with full metrics including cost.
>
> Never add a keyword-related segment (`keyword.info.text` and friends) to that query.
> Google documents that it silently filters out every Performance Max row — the query
> still succeeds and still returns Search rows, so it looks like "PMax had no search
> terms" rather than like a mistake.

**Brand is excluded on the READING side**, by `BRAND_TERM_RE` in `Config.gs`, so
redefining brand is a rebuild rather than another MCC run. It covers the brand name
and its common misspellings (`xeroshoes`, `zero shoes`) but deliberately **not** model
names like `prio` or `hfs` — counting those as brand would empty the slide of exactly
the discovery terms it exists to show. The excluded impressions and cost are printed
in the block's note, so the choice is visible and arguable rather than buried.

`CTR` = `clicks ÷ impressions`; `ROAS` = `Σ conv_value ÷ Σ cost`.

Sorted by **traffic**, not conversion value: a high-impression zero-conversion term
is the most interesting row on a discovery slide, and value-sorting hides it. The
engine feed also truncates by impressions for the same reason.

### Slide 11 — Top products (`RPT_TOP_ITEMS`)
`_eng_item` ← `shopping_performance_view` by `segments.product_item_id` /
`product_title`, top 5 by conversion value. Row 1 is the deck's "top revenue
driver" card. Orders/Revenue here are **engine-reported** — Google does not
attribute Triple Whale revenue to individual items.

Images come from the Shopping feed via the `Product Images` tab, matched in five
escalating strategies because Merchant Center rules rewrite the title and out-of-stock
size variants drop out of the feed. **Parent id narrows to the product; the title picks
the colourway** — parent id alone would put a grey shoe under a coral shoe's name.
Several colourways with no title match resolves to no image on purpose. Every match is
labelled with the strategy that produced it in `Setup → Product image status`.
GAPS §6.

### Slide 12 — Promotion recap (`RPT_PROMO_SUMMARY`, `RPT_PROMO_ASSETS`)
Windows come from the `Promos` tab. For each promo the summary gives four rows:

1. the promo window
2. the **equal-length run-up** immediately before it
3. the **same calendar window last year** (`n/a` if the backfill doesn't reach)
4. **brand text only** within the promo window

Revenue is Triple Whale attributed. The sitelink table is `_eng_asset` ←
`campaign_asset` at daily grain (daily so arbitrary promo windows work), where
`Orders` are engine-reported conversions on the asset.

### Slide 13 — ChatGPT Ads (`RPT_CHATGPT`)
Triple Whale `openai-ads`, channel-level. 12 columns, not 15: OpenAI reports no
conversion value, so the Engine columns are **omitted rather than shown as zeros**,
and `Orders` means Triple Whale orders. The block note states its share of total
paid media investment.

---

## Named ranges

Every block registers one, sized exactly like the deck table it feeds — header row
plus data rows. `Diagnostics → List Report tab named ranges` lists them with
dimensions.

The Slides writer reads **display values**, so the deck shows exactly the formatted
figures you reviewed in the sheet — there is no second formatting path that could
let the deck and the sheet disagree.

| Named range | Slide | Shape |
|---|---|---|
| `RPT_KPI` | 3 | 3 × 5 |
| `RPT_BLENDED` | 4 | 5 × 15 |
| `RPT_SEARCH` / `RPT_SHOPPING` | 5 | 5 × 15 |
| `RPT_SEARCH_BRAND` / `RPT_SEARCH_NONBRAND` | 6 | 5 × 15 |
| `RPT_SHOP_BRAND` / `RPT_SHOP_NONBRAND` | 7 | 5 × 15 |
| `RPT_PRODUCT` | 8 | 17 × 9 |
| `RPT_BRAND_IS` / `RPT_AUCTION` | 9 | variable |
| `RPT_PMAX_CAT` | 10 | 17 × 8 |
| `RPT_TOP_ITEMS` | 11 | 6 × 6 |
| `RPT_PROMO_SUMMARY` / `RPT_PROMO_ASSETS` | 12 | variable / 5 × 5 |
| `RPT_CHATGPT` | 13 | 5 × 12 |
| `RPT_RECONCILIATION` | — | 12 × 3 |

---

## Conventions

**`n/a` never means zero.** A metric that cannot be computed — missing period,
missing source column, zero denominator — is `null`, rendered `n/a`. Enforced in
`derive_()` and `pctChange_()`. A bag built only from engine rows reports the
Triple Whale columns as `n/a`, never `0`.

**Empty periods render `n/a` across the board**, not a row of zeros.

**Dates are text `yyyy-MM-dd` everywhere.** Both writers set `@` format on date
columns. A locale-formatted date value is exactly how this breaks silently.

**Column reads are by header name, never position**, so either upstream project
can add a column without breaking this one.

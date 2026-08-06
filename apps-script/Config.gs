/**
 * Xero Shoes — Monthly Report  ·  CONFIG
 * =============================================================================
 * Every knob lives here. Nothing else in the project should hold a constant you
 * might want to change per region or per month.
 *
 * DO NOT EDIT THE PER-DEPLOYMENT IDs HERE — use the `Settings` TAB instead.
 * Pasting a new dist/Code.gs replaces this whole file, so anything typed here is
 * lost on every code update. The Settings tab lives in the spreadsheet and
 * survives that; a non-empty value there overrides the constant below.
 * Run: Monthly Report → Setup → Settings.
 *
 * These values remain the defaults, and everything NOT on the Settings tab —
 * classification rules, deck row counts, column order — is a genuine code change
 * and belongs here.
 *
 * ONE SHEET PER REGION. Deploy this project twice — once bound to the US
 * reporting spreadsheet, once to the EU one — and change REGION +
 * TW_SPREADSHEET_ID + DECK_TEMPLATE_ID below. That mirrors how the Triple Whale
 * sheets are already split, and keeps currency and campaign naming coherent.
 */

// ============================== IDENTITY ===================================

// Region label. Appears on the Report tab and in the generated deck title.
var REGION = 'US';                      // 'US' | 'EU'

// Currency of the reporting spreadsheet. Used for number formats only — no FX
// conversion happens anywhere in this project.
var CURRENCY = 'USD';                   // 'USD' | 'EUR' | 'GBP'

var CLIENT_NAME = 'Xero Shoes';
var AGENCY_NAME = 'Lockhern Digital';

// ============================== SOURCES ====================================

// The Triple Whale spreadsheet produced by the `ld-x-tw-script` project. This
// project reads its hidden `_store` tab directly (raw summed components, one row
// per Date × Channel × Campaign) and never re-queries the Triple Whale API.
//
// The spreadsheet ID is the part of its URL between /d/ and /edit.
//
//   US  "Xero | US | TripleWhale | v2"  1TK1xPqrwf4Zr1_DA7GcYVDf-sXKKagla-sS_hs631Cs
//   EU  "Xero | EU | TripleWhale | v2"  1Qf-YpWXlOLUhSdLE6E1PZ1W37lDH1JPbc-ancEF5w8w
//
// Set this to the one matching REGION above. It is an identifier, not a
// credential — access is governed by Drive sharing, so it is safe in git.
var TW_SPREADSHEET_ID = '1TK1xPqrwf4Zr1_DA7GcYVDf-sXKKagla-sS_hs631Cs';   // US
var TW_STORE_SHEET    = '_store';

// Triple Whale channel ids, as they appear in the `Channel` column of `_store`.
// ADS_CHANNELS is the paid-search program (the blended table). OPENAI_CHANNELS
// is the ChatGPT Ads test, reported separately on its own slide and deliberately
// EXCLUDED from blended paid search.
var TW_ADS_CHANNELS    = ['google-ads', 'bing'];
var TW_OPENAI_CHANNELS = ['openai-ads'];

// ============================== REPORTING PERIOD ===========================

// Month to report, as 'yyyy-MM'. Leave '' to use the last COMPLETE calendar
// month — which is what you want for a scheduled monthly run.
var REPORT_MONTH = '';

// Comparison periods are derived from the report month and are not configurable:
//   prior = the preceding calendar month
//   yoy   = the same calendar month one year earlier
//
// Triple Whale history is bounded by BACKFILL_START in the ld-x-tw-script
// project. If the year-ago month is not covered there, the %YoY row renders
// 'n/a' for Triple Whale columns rather than a wrong number. See docs/GAPS.md.

// ============================== DECK OUTPUT ================================

// A Google SLIDES copy of template/Xero_Shoes_Monthly_Reporting_Framework.pptx.
// Upload the .pptx to Drive, open it, File → Save as Google Slides, then paste
// that file's ID here. It is used as a template and never modified: each run
// copies it. Leave '' to skip deck generation and use the Report tab only.
var DECK_TEMPLATE_ID = '';

// Drive folder for generated decks. Leave '' for the template's own folder.
var DECK_OUTPUT_FOLDER_ID = '';

// ============================== METRIC DEFINITIONS =========================

// Denominator for "TW CVR".
//   'clicks'   — Triple Whale orders ÷ ad clicks. Always available. This is the
//                default because it needs nothing beyond what `_store` holds.
//   'sessions' — Triple Whale orders ÷ TW sessions. Matches the deck's column
//                header literally, but requires the sessions column below.
var CVR_BASIS = 'clicks';

// Name of a sessions column in the Triple Whale `_store` tab, if you add one.
// The ld-x-tw-script project does not store sessions today (see docs/GAPS.md for
// how to add it). While this is '', the "TW Sessions" column renders 'n/a' and
// CVR falls back to clicks regardless of CVR_BASIS.
var TW_SESSION_FIELD = '';

// Shopping feed URL, used only to resolve slide 11's product images. Set it on
// the Settings tab. The Google Ads API exposes no product image URL on any
// resource, so the feed is the only automated source — see ProductImages.gs.
var PRODUCT_FEED_URL = '';

// ============================== CLASSIFICATION =============================
// Campaign names are the only segmentation signal Triple Whale gives us, so
// every campaign is classified by regex against its name. Rules are evaluated
// TOP TO BOTTOM and the FIRST match wins — order matters.
//
// Anything a rule set does not match lands in UNKNOWN / OTHER, is reported in
// the Reconciliation block, and is listed on the `Campaign Map` tab where you
// can pin it by hand. Manual overrides on that tab always beat these rules.

// Google Ads LABELS are the authoritative brand signal when present — a label
// survives a campaign rename, which a regex on the name does not. The engine feed
// exports campaign labels; any label matching a key here (case-insensitive) wins
// over the name rules below. Applying these three labels in Google Ads is the
// single highest-value thing you can do to make segmentation robust.
var BRAND_LABEL_MAP = {
  'brand':      'BRAND',
  'non-brand':  'NON_BRAND',
  'nonbrand':   'NON_BRAND',
  'competitor': 'COMPETITOR',
  'conquesting':'COMPETITOR',
};

// Brand axis. The deck's "Non-Brand" tables include COMPETITOR (conquesting).
var BRAND_RULES = [
  [/conquest|competitor|\bcomp\b/i,               'COMPETITOR'],
  [/(^|[^a-z])nb([^a-z]|$)|non-?brand/i,          'NON_BRAND'],
  [/(^|[^a-z])br([^a-z]|$)|brand/i,               'BRAND'],
];

// Tactic axis — what the campaign actually is.
var TACTIC_RULES = [
  [/pmax|performance max|(^|[^a-z])pm([^a-z]|$)/i, 'PMAX'],
  [/shopping/i,                                    'SHOPPING'],
  [/demand ?gen|discovery/i,                       'DEMAND_GEN'],
  [/dsa|dynamic search/i,                          'DSA'],
  [/search|conquest|core|models|shoes|troas/i,     'SEARCH'],
];

// How tactics roll up into the deck's Search vs. Shopping split (slides 5–7).
// Per the framework deck: "Search = text campaigns. Shopping = Standard
// Shopping + PMax retail." Demand Gen is in blended totals but belongs to
// neither table — it lands in OTHER and is surfaced in Reconciliation.
var DECK_GROUP_OF_TACTIC = {
  SEARCH: 'SEARCH', DSA: 'SEARCH',
  SHOPPING: 'SHOPPING', PMAX: 'SHOPPING',
  DEMAND_GEN: 'OTHER', OTHER: 'OTHER',
};

// ============================== ENGINE ENRICHMENT ==========================
// Slides 8–12 need Google Ads data that Triple Whale does not carry (product
// taxonomy, PMax search categories, item-level revenue, sitelink assets,
// impression share). Those tabs are written by google-ads-script/engine-report.js
// running in the MCC. This project only READS them, so it degrades gracefully:
// any missing tab renders as an empty, clearly-labelled block.
var ENGINE_DAY_SHEET     = '_eng_day';       // Date × Campaign engine metrics + impression share
// Same columns as _eng_day, but NEVER written or cleared by any script. This is
// where hand-imported engine history goes — most usefully a one-time Microsoft
// Ads export covering the months before Triple Whale existed. Read alongside
// _eng_day, so a channel imported here behaves exactly like an automated one.
var ENGINE_MANUAL_SHEET  = '_eng_manual';
// Written only by the webhook receiver in Webhook.gs, fed by the Microsoft
// Advertising Script. Read alongside the other two, so Bing engine rows behave
// exactly like Google ones.
var ENGINE_BING_SHEET    = '_eng_bing';
var ENGINE_PRODUCT_SHEET = '_eng_product';   // product_type_l1 × l2   (slide 8)
var ENGINE_PMAXCAT_SHEET = '_eng_pmax_cat';  // PMax search categories (slide 10)
var ENGINE_ITEM_SHEET    = '_eng_item';      // item id × title        (slide 11)
var ENGINE_ASSET_SHEET   = '_eng_asset';     // sitelinks / assets     (slide 12)

// Row counts the deck's tables are built for. Changing these changes how many
// rows the Report tab emits; the Slides writer trims the deck table to match.
var PRODUCT_ROWS   = 16;   // slide 8  — top product sub-categories

// The two dimensions slide 8 breaks product performance down by.
//
// Google's custom labels are ZERO-indexed in the API but ONE-indexed in the UI's
// naming: the UI's "Custom label 1" is segments.product_custom_attribute1, and
// "Custom label 0" is attribute0. So the numbers line up here — but if you ever
// switch to label 0, remember the UI calls it "Custom label 0" too.
//
// Valid dimensions: custom_attribute0..4, product_type_l1..l5, product_brand,
// product_condition, product_channel, product_item_id, product_title.
// LABEL is what the deck's column header should read; the Slides writer rewrites
// slide 8's first two header cells to match, so the deck can never disagree with
// the data underneath it.
// Which two dimensions is a per-feed question, not a Google one — custom labels
// are free text the Shopping feed sets, so whether label 1 holds a category or the
// single word "shoes" depends on the feed. Set these on the SETTINGS TAB, not
// here: the Google Ads Script reads the same tab, so one cell changes both sides.
// `Diagnostics → Show product dimensions` prints what each one actually contains.
var PRODUCT_DIM_1 = { field: 'product_type_l1',  label: 'Product Type 1' };
var PRODUCT_DIM_2 = { field: 'product_type_l2',  label: 'Product Type 2' };

/**
 * Every product dimension `shopping_performance_view` can segment by, and the
 * deck column header each should read. Also the validator for the Settings tab.
 *
 * Custom labels are ZERO-indexed in the API and the UI agrees — the UI's "Custom
 * label 1" is segments.product_custom_attribute1 — so the numbers line up.
 */
var PRODUCT_DIM_VOCAB = [
  ['product_custom_attribute0', 'Custom Label 0'],
  ['product_custom_attribute1', 'Custom Label 1'],
  ['product_custom_attribute2', 'Custom Label 2'],
  ['product_custom_attribute3', 'Custom Label 3'],
  ['product_custom_attribute4', 'Custom Label 4'],
  ['product_type_l1', 'Product Type 1'],
  ['product_type_l2', 'Product Type 2'],
  ['product_type_l3', 'Product Type 3'],
  ['product_type_l4', 'Product Type 4'],
  ['product_type_l5', 'Product Type 5'],
  ['product_brand', 'Brand'],
  ['product_condition', 'Condition'],
  ['product_channel', 'Channel'],
  ['product_item_id', 'Item ID'],
  ['product_title', 'Product Title'],
];

/**
 * Accept a dimension written any of the ways someone would reasonably write it —
 * the API field, the UI's label, or shorthand — and return { field, label }, or
 * null if it is not a real dimension.
 *
 * Tolerant on input because this is typed into a spreadsheet cell by hand, and a
 * rejected value silently falls back to the default, which is worse than
 * accepting "custom label 4".
 */
function resolveProductDim_(input) {
  var s = String(input === null || input === undefined ? '' : input)
    .trim().toLowerCase().replace(/[\s_\-.]/g, '');
  if (!s) return null;

  for (var i = 0; i < PRODUCT_DIM_VOCAB.length; i++) {
    var field = PRODUCT_DIM_VOCAB[i][0], label = PRODUCT_DIM_VOCAB[i][1];
    if (s === field.replace(/_/g, '')) return { field: field, label: label };
    if (s === label.toLowerCase().replace(/\s/g, '')) return { field: field, label: label };
  }

  // Shorthand: cl3 / label3 / customlabel3 → attribute3;  pt2 / type2 / l2 → l2.
  var m = s.match(/^(?:cl|customlabel|label|attr|attribute|customattribute)(\d)$/);
  if (m && Number(m[1]) <= 4) return dimByField_('product_custom_attribute' + m[1]);
  m = s.match(/^(?:pt|producttype|type|l)(\d)$/);
  if (m && Number(m[1]) >= 1 && Number(m[1]) <= 5) return dimByField_('product_type_l' + m[1]);

  return null;
}

function dimByField_(field) {
  for (var i = 0; i < PRODUCT_DIM_VOCAB.length; i++) {
    if (PRODUCT_DIM_VOCAB[i][0] === field) {
      return { field: field, label: PRODUCT_DIM_VOCAB[i][1] };
    }
  }
  // An unknown field is still readable — the engine tab is the authority on what
  // it holds, so label it with the raw field rather than dropping it.
  return { field: field, label: field };
}

var PMAX_CAT_ROWS  = 16;   // slide 10 — top PMax search categories
var TOP_ITEM_ROWS  = 5;    // slide 11 — product cards
var PROMO_ROWS     = 3;    // slide 12 — promo sitelinks (a Grand Total row is added)

// ============================== TABS =======================================

var REPORT_SHEET   = 'Report';           // slide-shaped output blocks
var MAP_SHEET      = 'Campaign Map';     // classification review + overrides
var AUCTION_SHEET  = 'Auction Insights'; // manual paste (no API — see docs/GAPS.md)
var PROMO_SHEET    = 'Promos';           // manual promo windows
// Manual paste for slide 10, from the Google Ads UI's "Search terms insights"
// panel Download button. Read with PRIORITY over the API tab: if you pasted it,
// you looked at it, so it beats whatever a query shape guessed at.
var PMAXCAT_MANUAL_SHEET = 'PMax Categories';
var PRODUCT_DIMS_SHEET   = '_eng_product_dims';  // dimension discovery (read-only here)
var STATUS_SHEET   = '_status';          // live run log

// ============================== PRESENTATION ===============================

var HEAD_BG = '#1b2a4a', HEAD_FG = '#ffffff';
var SUBHEAD_BG = '#eef1f6';
var NA = 'n/a';                          // rendered when a period has no data

function currencyFormat_(decimals) {
  var sym = CURRENCY === 'EUR' ? '€' : (CURRENCY === 'GBP' ? '£' : '$');
  return '"' + sym + '"#,##0' + (decimals ? '.00' : '');
}

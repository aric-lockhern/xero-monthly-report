/**
 * Xero Shoes — Monthly Report  ·  CONFIG
 * =============================================================================
 * Every knob lives here. Nothing else in the project should hold a constant you
 * might want to change per region or per month.
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
// Paste the spreadsheet ID from its URL:
//   docs.google.com/spreadsheets/d/  <THIS PART>  /edit
var TW_SPREADSHEET_ID = '';             // REQUIRED
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

// ============================== CLASSIFICATION =============================
// Campaign names are the only segmentation signal Triple Whale gives us, so
// every campaign is classified by regex against its name. Rules are evaluated
// TOP TO BOTTOM and the FIRST match wins — order matters.
//
// Anything a rule set does not match lands in UNKNOWN / OTHER, is reported in
// the Reconciliation block, and is listed on the `Campaign Map` tab where you
// can pin it by hand. Manual overrides on that tab always beat these rules.

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
var ENGINE_PRODUCT_SHEET = '_eng_product';   // product_type_l1 × l2   (slide 8)
var ENGINE_PMAXCAT_SHEET = '_eng_pmax_cat';  // PMax search categories (slide 10)
var ENGINE_ITEM_SHEET    = '_eng_item';      // item id × title        (slide 11)
var ENGINE_ASSET_SHEET   = '_eng_asset';     // sitelinks / assets     (slide 12)

// Row counts the deck's tables are built for. Changing these changes how many
// rows the Report tab emits; the Slides writer trims the deck table to match.
var PRODUCT_ROWS   = 16;   // slide 8  — top product sub-categories
var PMAX_CAT_ROWS  = 16;   // slide 10 — top PMax search categories
var TOP_ITEM_ROWS  = 5;    // slide 11 — product cards
var PROMO_ROWS     = 3;    // slide 12 — promo sitelinks (a Grand Total row is added)

// ============================== TABS =======================================

var REPORT_SHEET   = 'Report';           // slide-shaped output blocks
var MAP_SHEET      = 'Campaign Map';     // classification review + overrides
var AUCTION_SHEET  = 'Auction Insights'; // manual paste (no API — see docs/GAPS.md)
var PROMO_SHEET    = 'Promos';           // manual promo windows
var STATUS_SHEET   = '_status';          // live run log

// ============================== PRESENTATION ===============================

var HEAD_BG = '#1b2a4a', HEAD_FG = '#ffffff';
var SUBHEAD_BG = '#eef1f6';
var NA = 'n/a';                          // rendered when a period has no data

function currencyFormat_(decimals) {
  var sym = CURRENCY === 'EUR' ? '€' : (CURRENCY === 'GBP' ? '£' : '$');
  return '"' + sym + '"#,##0' + (decimals ? '.00' : '');
}

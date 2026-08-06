/**
 * ============================================================================
 * XERO SHOES — MONTHLY REPORT   ·   single-file build
 * ============================================================================
 *
 * GENERATED FILE — do not edit here.
 *
 * This is every apps-script/*.gs file concatenated, so it can be pasted into
 * one Apps Script file. Apps Script shares one global scope across a project,
 * so this behaves identically to the ten separate files.
 *
 * To change anything, edit the source file in apps-script/ and re-run:
 *     node tools/bundle.js
 *
 * Section markers below show which source file each block came from.
 *
 * Source: github.com/aric-lockhern/xero-monthly-report
 * Lockhern Digital — internal reporting tool.
 */

// ==========================================================================
// SOURCE FILE: apps-script/Config.gs
// ==========================================================================

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


// ==========================================================================
// SOURCE FILE: apps-script/Metrics.gs
// ==========================================================================

/**
 * Xero Shoes — Monthly Report  ·  METRICS
 * =============================================================================
 * The measurement contract for the whole project, in one file.
 *
 * THE RULE: we store and sum RAW COMPONENTS (spend, revenue, orders, clicks,
 * impressions) and derive every ratio at the moment of display. You cannot
 * average a ratio — summing components is the only form that reprojects
 * correctly to any grain (month, tactic, brand, campaign). This mirrors the
 * `_store` design in the ld-x-tw-script project, deliberately.
 *
 * A metric that cannot be computed is `null`, which renders as 'n/a'. It is
 * never 0 and never blank: a zero that means "no data" is how a deck ends up
 * telling a client revenue collapsed when really a backfill just hadn't run.
 */

/**
 * WHICH SOURCE OWNS WHICH COMPONENT
 * -----------------------------------------------------------------------------
 * Google Ads and Microsoft Ads are the SPINE. They own everything the platforms
 * measure directly — spend, impressions, clicks, and the engine's own reported
 * conversions and value — and they have years of history, so these columns are
 * real for every month in the backfill.
 *
 * Triple Whale is an OVERLAY. It owns only what the pixel attributes: orders,
 * revenue, new customers, sessions. It covers only the months it has synced.
 *
 * The two are combined PER CHANNEL and then summed, never row-by-row. Row-level
 * joining would need campaign names to match exactly between the engine and
 * Triple Whale, and they don't: Google Ads reports a campaign's CURRENT name for
 * all history, while Triple Whale stored whatever the name was on the day it
 * synced. One rename and the join silently drops a campaign. Both sources
 * classify into the same segments, so summing per segment is robust to renames.
 *
 * Per channel matters for a subtler reason: if the engine feed covers Google but
 * not Microsoft, taking cost from the engine while taking revenue from Triple
 * Whale (which includes Microsoft) would divide blended revenue by Google-only
 * cost and overstate ROAS. Combining per channel means a channel the engine
 * doesn't cover falls back to Triple Whale for its front end too, so the
 * numerator and denominator always describe the same spend.
 */
var FRONT_COMPONENTS = ['spend', 'impressions', 'clicks', 'eng_conv', 'eng_conv_value',
                        'is_impr', 'is_eligible'];
var BACK_COMPONENTS  = ['tw_orders', 'tw_revenue', 'tw_nc_orders', 'tw_nc_revenue', 'sessions'];

// Raw components. These are summed; nothing here is a ratio.
var COMPONENTS = [
  'spend',            // ad cost
  'impressions',
  'clicks',
  'sessions',         // Triple Whale sessions, if TW_SESSION_FIELD is configured
  'eng_conv',         // engine-reported conversions  (TW: channel_conv)
  'eng_conv_value',   // engine-reported revenue      (TW: channel_cv)
  'tw_orders',        // Triple Whale attributed orders
  'tw_revenue',       // Triple Whale attributed revenue
  'tw_nc_orders',     // ... new-customer orders
  'tw_nc_revenue',    // ... new-customer revenue
  'is_impr',          // impressions on days where impression share was reported
  'is_eligible',      // eligible impressions = is_impr / impression_share
];

/**
 * The deck's main 15-column table (slides 4–7), minus the leading Month column.
 * [ deck header, metric key, number format ]
 *
 * This array IS the column order in the deck. Do not reorder it without
 * reordering the deck tables — the Slides writer maps by position.
 */
function tableColumns_() {
  return [
    ['Impr.',          'impressions',  '#,##0'],
    ['Clicks',         'clicks',       '#,##0'],
    ['TW Sessions',    'sessions',     '#,##0'],
    ['CTR',            'ctr',          '0.00%'],
    ['CPC',            'cpc',          currencyFormat_(true)],
    ['Cost',           'cost',         currencyFormat_(false)],
    ['Engine Orders',  'eng_orders',   '#,##0'],
    ['Engine Revenue', 'eng_revenue',  currencyFormat_(false)],
    ['Engine ROAS',    'eng_roas',     '#,##0.00'],
    ['TW Orders',      'tw_orders',    '#,##0'],
    ['TW Revenue',     'tw_revenue',   currencyFormat_(false)],
    ['TW CVR',         'tw_cvr',       '0.00%'],
    ['TW AOV',         'tw_aov',       currencyFormat_(true)],
    ['TW ROAS',        'tw_roas',      '#,##0.00'],
  ];
}

/**
 * The ChatGPT Ads table (slide 13). Intentionally lighter: OpenAI reports no
 * engine conversion value, so the Engine columns are dropped rather than shown
 * as zeros, and "Orders" means Triple Whale orders.
 */
function chatgptColumns_() {
  return [
    ['Impr.',       'impressions', '#,##0'],
    ['Clicks',      'clicks',      '#,##0'],
    ['TW Sessions', 'sessions',    '#,##0'],
    ['CTR',         'ctr',         '0.00%'],
    ['CPC',         'cpc',         currencyFormat_(true)],
    ['Cost',        'cost',        currencyFormat_(false)],
    ['Orders',      'tw_orders',   '#,##0'],
    ['TW Revenue',  'tw_revenue',  currencyFormat_(false)],
    ['TW CVR',      'tw_cvr',      '0.00%'],
    ['TW AOV',      'tw_aov',      currencyFormat_(true)],
    ['TW ROAS',     'tw_roas',     '#,##0.00'],
  ];
}

// ============================== SUMMING ====================================

function emptyComponents_() {
  var g = {};
  for (var i = 0; i < COMPONENTS.length; i++) g[COMPONENTS[i]] = 0;
  g._rows = 0;               // how many source rows fed this bag
  g._hasSessions = false;    // did any source row actually carry a sessions value
  g._hasIs = false;          // ... an impression share value
  g._twPresent = false;      // did any source row come from Triple Whale
  return g;
}

/**
 * Add one source row's components into a bag. Mutates and returns `bag`.
 *
 * `row.src` matters. Google Ads engine rows carry no attributed revenue, so a
 * bag built only from them must report the Triple Whale columns as 'n/a' — if it
 * summed them to 0 instead, a year-ago month covered by Google Ads but not yet
 * by the Triple Whale backfill would render as $0 attributed revenue, and the
 * %YoY row would claim revenue grew infinitely.
 */
function addComponents_(bag, row) {
  for (var i = 0; i < COMPONENTS.length; i++) {
    var k = COMPONENTS[i];
    bag[k] += num_(row[k]);
  }
  bag._rows++;
  if (row.src !== 'eng') bag._twPresent = true;
  if (row.sessions !== null && row.sessions !== undefined && row.sessions !== '') bag._hasSessions = true;
  if (num_(row.is_eligible) > 0) bag._hasIs = true;
  return bag;
}

/** Sum an array of source rows into one component bag. */
function sumComponents_(rows) {
  var bag = emptyComponents_();
  for (var i = 0; i < rows.length; i++) addComponents_(bag, rows[i]);
  return bag;
}

// ============================== SOURCE COMBINATION =========================

/**
 * Combine one channel's engine bag with its Triple Whale bag, for one period.
 *
 * Front-end and engine-reported components come from the engine. Attributed
 * components come from Triple Whale. Both spend figures are retained so
 * reconciliation can check that the two sources describe the same program.
 */
function combineChannelBags_(engBag, twBag, frontSource) {
  var out = emptyComponents_();
  var eng = engBag || emptyComponents_();
  var tw  = twBag  || emptyComponents_();

  // `frontSource` is decided ONCE PER CHANNEL for the whole period, by the
  // caller, from the complete row set — never per segment from that segment's own
  // rows.
  //
  // Deciding per segment is subtly wrong. Suppose the engine covers google-ads
  // but a campaign appears only in Triple Whale (a rename: the engine reports the
  // new name for all history, Triple Whale stored the old one). At blended level
  // the engine wins for that channel, so the campaign's spend is excluded — which
  // is correct, because the engine already reports that spend under the new name,
  // and adding it would double-count. But a segment containing ONLY that campaign
  // has no engine rows, so it would fall back to Triple Whale and count the spend
  // after all. The segments then don't sum to blended, and the Reconciliation
  // block contradicts itself.
  //
  // Fixing the source per channel makes every segment agree. Attributed revenue
  // is unaffected either way — it always comes from Triple Whale, so a renamed
  // campaign's revenue is never lost.
  var frontFromEngine = (frontSource === 'engine');
  var front = frontFromEngine ? eng : tw;

  for (var i = 0; i < FRONT_COMPONENTS.length; i++) out[FRONT_COMPONENTS[i]] = num_(front[FRONT_COMPONENTS[i]]);
  for (var j = 0; j < BACK_COMPONENTS.length;  j++) out[BACK_COMPONENTS[j]]  = num_(tw[BACK_COMPONENTS[j]]);

  out._rows        = eng._rows + tw._rows;
  out._twPresent   = tw._rows > 0;
  out._hasSessions = !!tw._hasSessions;
  out._hasIs       = !!front._hasIs;
  out._frontSource = front._rows ? frontSource : 'none';

  // Diagnostics, not display.
  out._engRows  = eng._rows;
  out._twRows   = tw._rows;
  out._engSpend = eng._rows ? num_(eng.spend) : null;
  out._twSpend  = tw._rows  ? num_(tw.spend)  : null;
  return out;
}

/** Sum already-combined per-channel bags into one bag for the segment. */
function mergeBags_(bags) {
  var out = emptyComponents_();
  var sources = {}, engSpend = null, twSpend = null;

  for (var b = 0; b < bags.length; b++) {
    var bag = bags[b];
    if (!bag || !bag._rows) continue;
    for (var i = 0; i < COMPONENTS.length; i++) out[COMPONENTS[i]] += num_(bag[COMPONENTS[i]]);
    out._rows        += bag._rows;
    out._twPresent    = out._twPresent    || bag._twPresent;
    out._hasSessions  = out._hasSessions  || bag._hasSessions;
    out._hasIs        = out._hasIs        || bag._hasIs;
    if (bag._frontSource && bag._frontSource !== 'none') sources[bag._frontSource] = true;
    if (bag._engSpend !== null && bag._engSpend !== undefined) engSpend = num_(engSpend) + bag._engSpend;
    if (bag._twSpend  !== null && bag._twSpend  !== undefined) twSpend  = num_(twSpend)  + bag._twSpend;
  }

  var names = Object.keys(sources);
  out._frontSource = names.length === 0 ? 'none' : (names.length === 1 ? names[0] : 'mixed');
  out._engSpend = engSpend;
  out._twSpend  = twSpend;
  return out;
}

// ============================== DERIVATION =================================

/** Safe divide. Returns null (→ 'n/a') rather than 0 or Infinity. */
function div_(a, b) {
  a = Number(a); b = Number(b);
  if (!isFinite(a) || !isFinite(b) || b === 0) return null;
  return a / b;
}

/**
 * Turn a component bag into the display metrics the deck asks for.
 *
 * An EMPTY bag (no source rows at all) derives every metric as null, so a period
 * with no data reads 'n/a' across the board instead of a row of zeros.
 */
function derive_(bag) {
  if (!bag || !bag._rows) {
    var blank = {};
    var cols = tableColumns_().concat(chatgptColumns_());
    for (var i = 0; i < cols.length; i++) blank[cols[i][1]] = null;
    // Keys not in either column set, so they'd otherwise come back undefined.
    blank.tw_nc_orders = null;
    blank.tw_nc_revenue = null;
    blank.is_share = null;
    return blank;
  }

  // Sessions are only real if the source actually carried them. Summing a column
  // of blanks to 0 and dividing by it would silently invent a 0% CVR.
  var sessions = bag._hasSessions ? bag.sessions : null;
  var cvrBase  = (CVR_BASIS === 'sessions' && sessions) ? sessions : bag.clicks;

  // No Triple Whale row fed this bag → its attributed columns are unknown, not 0.
  var tw = function (v) { return bag._twPresent ? v : null; };

  return {
    impressions: bag.impressions,
    clicks:      bag.clicks,
    sessions:    sessions,
    ctr:         div_(bag.clicks, bag.impressions),
    cpc:         div_(bag.spend, bag.clicks),
    cost:        bag.spend,
    eng_orders:  bag.eng_conv,
    eng_revenue: bag.eng_conv_value,
    eng_roas:    div_(bag.eng_conv_value, bag.spend),
    tw_orders:   tw(bag.tw_orders),
    tw_revenue:  tw(bag.tw_revenue),
    tw_cvr:      tw(div_(bag.tw_orders, cvrBase)),
    tw_aov:      tw(div_(bag.tw_revenue, bag.tw_orders)),
    tw_roas:     tw(div_(bag.tw_revenue, bag.spend)),

    // Not in the deck's main table, but used by the exec KPIs and slide 9.
    tw_nc_orders:  tw(bag.tw_nc_orders),
    tw_nc_revenue: tw(bag.tw_nc_revenue),
    // Impression share rolled up the only correct way: total impressions over
    // total ELIGIBLE impressions. Averaging daily percentages would weight a
    // $2 day the same as a $2,000 day.
    is_share:    bag._hasIs ? div_(bag.is_impr, bag.is_eligible) : null,
  };
}

// ============================== PERIOD DELTAS ==============================

/**
 * Percent change between two derived values.
 *
 * Returns null when it cannot be stated honestly: either side missing, or a base
 * of zero (where the change is undefined, not "infinite growth").
 */
function pctChange_(current, base) {
  if (current === null || current === undefined || current === '') return null;
  if (base === null || base === undefined || base === '' || Number(base) === 0) return null;
  var c = Number(current), b = Number(base);
  if (!isFinite(c) || !isFinite(b)) return null;
  return (c - b) / Math.abs(b);
}

/**
 * Build the deck's four-row table body — Current, Prior, %MoM, %YoY — for one
 * segment, given that segment's component bag per period.
 *
 * `periods` is { current, prior, yoy } of component bags.
 * `cols` is tableColumns_() or chatgptColumns_().
 *
 * Returns { rows: [[label, v, v, ...] x4], derived: {current, prior, yoy} }
 * where every cell is a number, null ('n/a'), or a percentage number.
 */
function periodRows_(periods, cols, labels) {
  var cur = derive_(periods.current);
  var pri = derive_(periods.prior);
  var yoy = derive_(periods.yoy);

  var rowCur = [labels.current], rowPri = [labels.prior], rowMoM = ['% MoM'], rowYoY = ['% YoY'];
  for (var i = 0; i < cols.length; i++) {
    var k = cols[i][1];
    rowCur.push(cur[k]);
    rowPri.push(pri[k]);
    rowMoM.push(pctChange_(cur[k], pri[k]));
    rowYoY.push(pctChange_(cur[k], yoy[k]));
  }
  return {
    rows: [rowCur, rowPri, rowMoM, rowYoY],
    derived: { current: cur, prior: pri, yoy: yoy },
  };
}

// ============================== HELPERS ====================================

function num_(v) {
  if (v === null || v === undefined || v === '') return 0;
  var x = Number(v);
  return isFinite(x) ? x : 0;
}


// ==========================================================================
// SOURCE FILE: apps-script/Util.gs
// ==========================================================================

/**
 * Xero Shoes — Monthly Report  ·  UTILITIES
 * =============================================================================
 * Date arithmetic and the live `_status` log. The status tab is the same idea as
 * in the ld-x-tw-script project: a long run is opaque unless it narrates itself,
 * and after the fact you want proof the scheduled run happened and what it did.
 */

// ============================== DATE ARITHMETIC ============================

function parseYmd_(s) {
  var m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function dateAdd_(ds, delta) {
  var d = parseYmd_(ds);
  if (!d) return '';
  d.setDate(d.getDate() + delta);
  return Utilities.formatDate(d, tz_(), 'yyyy-MM-dd');
}

/** Whole days from a → b. Negative if b precedes a. */
function daysBetween_(a, b) {
  var da = parseYmd_(a), db = parseYmd_(b);
  if (!da || !db) return 0;
  return Math.round((db.getTime() - da.getTime()) / (24 * 3600 * 1000));
}

function todayStr_() { return Utilities.formatDate(new Date(), tz_(), 'yyyy-MM-dd'); }

// ============================== STATUS LOG =================================

var STATUS_KEEP = 60;   // activity lines retained

/**
 * Append a line to `_status` and to the execution log.
 *
 * Never throws: a status write failing (a locked sheet, a mid-run permission
 * prompt) must not take down the run it is only narrating.
 */
function progress_(msg) {
  try { Logger.log(msg); } catch (e) {}
  try { setStatus_(msg); } catch (e) {}
}

function setStatus_(msg) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(STATUS_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(STATUS_SHEET);
    sheet.setColumnWidth(1, 900);
  }

  var stamp = Utilities.formatDate(new Date(), tz_(), 'yyyy-MM-dd HH:mm:ss');

  // Read the existing log before rewriting the header block.
  var existing = [];
  if (sheet.getLastRow() > 5) {
    existing = sheet.getRange(6, 1, Math.min(sheet.getLastRow() - 5, STATUS_KEEP), 1).getValues();
  }

  sheet.clearContents();
  sheet.getRange(1, 1).setValue('Monthly Report — status  ·  ' + REGION)
    .setFontWeight('bold').setFontSize(12);
  sheet.getRange(2, 1).setValue(msg).setFontWeight('bold');
  sheet.getRange(3, 1).setValue('as of ' + stamp).setFontColor('#6b7280');
  sheet.getRange(5, 1).setValue('Recent activity (newest first):').setFontColor('#6b7280');

  var lines = [[stamp + '   ' + msg]];
  for (var i = 0; i < existing.length && lines.length < STATUS_KEEP; i++) {
    if (String(existing[i][0] || '').trim()) lines.push([existing[i][0]]);
  }
  sheet.getRange(6, 1, lines.length, 1).setValues(lines);
  SpreadsheetApp.flush();
}

// ============================== UI HELPERS =================================

/** Alert that works from the menu and no-ops from a trigger (where there is no UI). */
function tell_(title, body) {
  progress_(title + (body ? ' — ' + String(body).split('\n')[0] : ''));
  try {
    SpreadsheetApp.getUi().alert(title + (body ? '\n\n' + body : ''));
  } catch (e) { /* running headless from a trigger */ }
}

function ask_(title, prompt) {
  var ui = SpreadsheetApp.getUi();
  var res = ui.prompt(title, prompt, ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return null;
  return String(res.getResponseText() || '').trim();
}


// ==========================================================================
// SOURCE FILE: apps-script/Ingest.gs
// ==========================================================================

/**
 * Xero Shoes — Monthly Report  ·  INGEST
 * =============================================================================
 * Reads the two sources this project depends on and normalises them into one
 * row shape. Nothing downstream knows where a number came from.
 *
 *   Triple Whale  →  the `_store` tab of the ld-x-tw-script spreadsheet.
 *                    Spend, impressions, clicks, engine-reported conversions and
 *                    value, and attributed orders/revenue. This is the backbone:
 *                    slides 3–7 and 13 need nothing else.
 *
 *   Google Ads    →  `_eng_*` tabs written by google-ads-script/engine-report.js.
 *                    Purely additive enrichment for slides 8–12 (product
 *                    taxonomy, PMax search categories, item revenue, sitelink
 *                    assets, impression share) plus year-ago engine history that
 *                    predates the Triple Whale backfill.
 *
 * Columns are read BY HEADER NAME, never by position, so either upstream project
 * can add a column without breaking this one.
 */

// Triple Whale `_store` column name → our component key.
var TW_FIELD_MAP = {
  'spend':                      'spend',
  'impressions':                'impressions',
  'clicks':                     'clicks',
  'channel_conv':               'eng_conv',
  'channel_cv':                 'eng_conv_value',
  'orders_quantity':            'tw_orders',
  'order_revenue':              'tw_revenue',
  'new_customer_orders':        'tw_nc_orders',
  'new_customer_order_revenue': 'tw_nc_revenue',
};

// ============================== TRIPLE WHALE ===============================

/**
 * Read the Triple Whale store.
 *
 * Returns { rows: [...], minDate: 'yyyy-MM-dd', maxDate: 'yyyy-MM-dd' } where
 * each row is { date, channel, campaign, <components> }.
 */
function readTripleWhale_() {
  if (!TW_SPREADSHEET_ID) {
    throw new Error('TW_SPREADSHEET_ID is not set in Config.gs. Paste the ID of the ' +
      'Triple Whale reporting spreadsheet (the one the ld-x-tw-script project writes to).');
  }

  var ss;
  try {
    ss = SpreadsheetApp.openById(TW_SPREADSHEET_ID);
  } catch (e) {
    throw new Error('Cannot open the Triple Whale spreadsheet (' + TW_SPREADSHEET_ID + '). ' +
      'Check the ID, and make sure this account has at least view access. Original error: ' + e.message);
  }

  var sheet = ss.getSheetByName(TW_STORE_SHEET);
  if (!sheet) {
    throw new Error('The Triple Whale spreadsheet has no "' + TW_STORE_SHEET + '" tab. ' +
      'It is hidden by design — unhide it to confirm, or check TW_STORE_SHEET in Config.gs.');
  }
  if (sheet.getLastRow() < 2) {
    throw new Error('The Triple Whale "' + TW_STORE_SHEET + '" tab is empty. Run a sync in ' +
      'that spreadsheet first (Triple Whale → Sync now).');
  }

  var values = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();
  var header = values[0].map(function (h) { return String(h || '').trim(); });
  var idx = {};
  for (var h = 0; h < header.length; h++) idx[header[h].toLowerCase()] = h;

  var iDate = idx['date'], iChan = idx['channel'], iCamp = idx['campaign'];
  if (iDate === undefined || iChan === undefined) {
    throw new Error('The Triple Whale "' + TW_STORE_SHEET + '" tab is missing a Date or ' +
      'Channel column. Found: ' + header.join(', '));
  }

  // Resolve component columns once.
  var colFor = {};
  Object.keys(TW_FIELD_MAP).forEach(function (src) {
    var at = idx[src.toLowerCase()];
    if (at !== undefined) colFor[TW_FIELD_MAP[src]] = at;
  });
  if (TW_SESSION_FIELD) {
    var si = idx[String(TW_SESSION_FIELD).toLowerCase()];
    if (si !== undefined) colFor.sessions = si;
    else progress_('TW_SESSION_FIELD is set to "' + TW_SESSION_FIELD + '" but that column is not ' +
      'in ' + TW_STORE_SHEET + '. TW Sessions will render n/a. Columns present: ' + header.join(', '));
  }

  var rows = [], minDate = null, maxDate = null;
  for (var r = 1; r < values.length; r++) {
    var date = normDate_(values[r][iDate]);
    if (!date) continue;

    var rec = {
      date: date,
      channel: String(values[r][iChan] || '').trim(),
      campaign: String(iCamp === undefined ? '' : (values[r][iCamp] === null ? '' : values[r][iCamp])).trim(),
    };
    for (var i2 = 0; i2 < COMPONENTS.length; i2++) {
      var key = COMPONENTS[i2];
      rec[key] = (colFor[key] === undefined) ? null : values[r][colFor[key]];
    }
    rows.push(rec);
    if (!minDate || date < minDate) minDate = date;
    if (!maxDate || date > maxDate) maxDate = date;
  }

  return { rows: rows, minDate: minDate, maxDate: maxDate, sessionsAvailable: colFor.sessions !== undefined };
}

// ============================== ENGINE TABS ================================

/**
 * Read one `_eng_*` tab into objects keyed by lower-cased header name.
 * A missing tab is not an error — it means the Google Ads Script has not run
 * yet, and the slides that need it render as clearly-labelled empty blocks.
 */
function readEngineTab_(name) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet || sheet.getLastRow() < 2) return [];

  var values = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();
  var header = values[0].map(function (h) { return String(h || '').trim().toLowerCase(); });
  var out = [];
  for (var r = 1; r < values.length; r++) {
    var rec = {}, any = false;
    for (var c = 0; c < header.length; c++) {
      if (!header[c]) continue;
      rec[header[c]] = values[r][c];
      if (values[r][c] !== '' && values[r][c] !== null) any = true;
    }
    if (any) out.push(rec);
  }
  return out;
}

/**
 * Daily engine rows, normalised into the same shape as Triple Whale rows so they
 * can share the aggregation code. Also yields the authoritative campaign types
 * used by the classifier.
 */
function readEngineDays_() {
  // Automated feed plus any hand-imported history. The manual tab is read second
  // but is not special-cased: a Microsoft Ads month imported by hand and a Google
  // Ads month written by the script are the same kind of row from here on.
  var raw = readEngineTab_(ENGINE_DAY_SHEET).concat(readEngineTab_(ENGINE_MANUAL_SHEET));
  var rows = [], types = {};

  for (var i = 0; i < raw.length; i++) {
    var r = raw[i];
    var date = normDate_(r.date);
    if (!date) continue;
    var channel  = String(r.channel || 'google-ads').trim();
    var campaign = String(r.campaign === null || r.campaign === undefined ? '' : r.campaign).trim();

    // Impression share is a ratio, so store its components: the impressions it
    // was reported against, and the eligible impressions they imply.
    var impr = num_(r.impressions);
    var share = Number(r['search_impression_share']);
    var hasShare = isFinite(share) && share > 0;

    rows.push({
      date: date, channel: channel, campaign: campaign,
      spend:          num_(r.cost),
      impressions:    impr,
      clicks:         num_(r.clicks),
      sessions:       null,
      eng_conv:       num_(r.conversions),
      eng_conv_value: num_(r.conversions_value),
      tw_orders: 0, tw_revenue: 0, tw_nc_orders: 0, tw_nc_revenue: 0,
      is_impr:     hasShare ? impr : 0,
      is_eligible: hasShare ? impr / share : 0,
    });

    if (r.channel_type || r.labels) {
      types[classKey_(channel, campaign)] = {
        channelType: String(r.channel_type || ''),
        subType: String(r.channel_sub_type || ''),
        labels: String(r.labels || ''),
      };
    }
  }
  return { rows: rows, types: types };
}

// ============================== PERIOD FILTERING ===========================

/** Rows whose date falls inside a { start, end } month window (inclusive). */
function rowsInPeriod_(rows, period) {
  var out = [];
  for (var i = 0; i < rows.length; i++) {
    var d = rows[i].date;
    if (d >= period.start && d <= period.end) out.push(rows[i]);
  }
  return out;
}

function isAdsChannel_(ch)    { return TW_ADS_CHANNELS.indexOf(ch) !== -1; }
function isOpenAiChannel_(ch) { return TW_OPENAI_CHANNELS.indexOf(ch) !== -1; }

// ============================== DATE / MONTH MATH ==========================

/** Anything the sheet might hold in a date cell → 'yyyy-MM-dd', or '' if unusable. */
function normDate_(v) {
  if (v === null || v === undefined || v === '') return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return Utilities.formatDate(v, tz_(), 'yyyy-MM-dd');
  }
  var s = String(v).trim();
  var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[1] + '-' + m[2] + '-' + m[3];
  var d = new Date(s);
  if (!isNaN(d.getTime())) return Utilities.formatDate(d, tz_(), 'yyyy-MM-dd');
  return '';
}

function tz_() { return Session.getScriptTimeZone(); }

/** The month being reported: REPORT_MONTH, or the last COMPLETE calendar month. */
function resolveReportMonth_() {
  if (REPORT_MONTH) {
    if (!/^\d{4}-\d{2}$/.test(REPORT_MONTH)) {
      throw new Error('REPORT_MONTH must be "yyyy-MM" (e.g. "2026-07") or "" for the last ' +
        'complete month. Got: "' + REPORT_MONTH + '"');
    }
    return REPORT_MONTH;
  }
  var now = new Date();
  var firstOfThis = new Date(now.getFullYear(), now.getMonth(), 1);
  var lastComplete = new Date(firstOfThis.getTime() - 24 * 3600 * 1000);
  return Utilities.formatDate(lastComplete, tz_(), 'yyyy-MM');
}

/** 'yyyy-MM' → { month, start, end, label } with an inclusive day range. */
function monthPeriod_(month) {
  var y = Number(month.slice(0, 4)), m = Number(month.slice(5, 7));
  var start = new Date(y, m - 1, 1);
  var end   = new Date(y, m, 0);                    // day 0 of next month = last day of this
  return {
    month: month,
    start: Utilities.formatDate(start, tz_(), 'yyyy-MM-dd'),
    end:   Utilities.formatDate(end,   tz_(), 'yyyy-MM-dd'),
    label: Utilities.formatDate(start, tz_(), 'MMMM yyyy'),
    shortLabel: Utilities.formatDate(start, tz_(), 'MMM yyyy'),
  };
}

function addMonths_(month, delta) {
  var y = Number(month.slice(0, 4)), m = Number(month.slice(5, 7)) - 1 + delta;
  var d = new Date(y, m, 1);
  return Utilities.formatDate(d, tz_(), 'yyyy-MM');
}

/** The three periods every table compares: current, prior month, same month LY. */
function resolvePeriods_() {
  var month = resolveReportMonth_();
  return {
    current: monthPeriod_(month),
    prior:   monthPeriod_(addMonths_(month, -1)),
    yoy:     monthPeriod_(addMonths_(month, -12)),
  };
}

/**
 * Which periods the source data actually covers. Used to render 'n/a' rather
 * than a misleading zero, and to warn on the Report tab and in `_status`.
 */
function coverage_(rows, periods) {
  var has = function (p) {
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].date >= p.start && rows[i].date <= p.end) return true;
    }
    return false;
  };
  return {
    current: has(periods.current),
    prior:   has(periods.prior),
    yoy:     has(periods.yoy),
  };
}


// ==========================================================================
// SOURCE FILE: apps-script/Classify.gs
// ==========================================================================

/**
 * Xero Shoes — Monthly Report  ·  CLASSIFICATION
 * =============================================================================
 * Triple Whale reports campaign NAMES, not campaign types or labels. So the
 * Search/Shopping and Brand/Non-Brand splits on slides 5–7 are produced by
 * classifying names with the regex rules in Config.gs.
 *
 * That is fragile on its own, so it is backed by three things:
 *
 *   1. A visible `Campaign Map` tab listing every campaign seen in the reporting
 *      window with its auto-classification and its spend, so a wrong call is
 *      obvious at a glance rather than buried in a total.
 *   2. Two override columns on that tab. A value there WINS over the rules, and
 *      survives every rebuild. This is how you pin the legacy Triple Whale rows
 *      ('brand', 'nonbrand', '(not set)', bare campaign ids) that no rule can
 *      sensibly match.
 *   3. A Reconciliation block on the Report tab that states, in dollars, how
 *      much spend and revenue is UNKNOWN or OTHER. Slides 5–7 will not sum to
 *      slide 4 whenever that number is non-zero, and the deck reader deserves
 *      to know why.
 *
 * If the Google Ads engine tabs are present, campaign type comes from
 * `advertising_channel_type` instead of a regex — authoritative beats inferred.
 * Names are still used for the brand axis, because brand/non-brand is an agency
 * convention that only the naming carries.
 */

var MAP_HEADER = [
  'Channel', 'Campaign',
  'Tactic (auto)', 'Brand (auto)',
  'Tactic (override)', 'Brand (override)',
  'Effective Tactic', 'Effective Brand', 'Deck Group',
  'Cost (report month)', 'TW Revenue (report month)', 'Seen in',
];

var VALID_TACTICS = ['SEARCH', 'SHOPPING', 'PMAX', 'DSA', 'DEMAND_GEN', 'OTHER'];
var VALID_BRANDS  = ['BRAND', 'NON_BRAND', 'COMPETITOR', 'UNKNOWN'];

// ============================== RULE APPLICATION ===========================

function applyRules_(rules, name, fallback) {
  var s = String(name || '');
  for (var i = 0; i < rules.length; i++) {
    if (rules[i][0].test(s)) return rules[i][1];
  }
  return fallback;
}

function autoTactic_(campaign)  { return applyRules_(TACTIC_RULES, campaign, 'OTHER'); }
function autoBrand_(campaign)   { return applyRules_(BRAND_RULES,  campaign, 'UNKNOWN'); }

/**
 * Brand from Google Ads labels, when the engine feed exported any.
 *
 * A label is attached to the campaign, so it survives a rename; a regex reads the
 * name, so it does not. Returns '' when no label maps, and the name rules apply.
 */
function brandFromLabels_(labels) {
  if (!labels) return '';
  var parts = String(labels).split(/[|,;]/);
  for (var i = 0; i < parts.length; i++) {
    var key = parts[i].trim().toLowerCase();
    if (BRAND_LABEL_MAP[key]) return BRAND_LABEL_MAP[key];
  }
  return '';
}

/** Google Ads advertising_channel_type → our tactic vocabulary. */
function tacticFromChannelType_(channelType, subType) {
  var t = String(channelType || '').toUpperCase();
  var s = String(subType || '').toUpperCase();
  if (t === 'PERFORMANCE_MAX') return 'PMAX';
  if (t === 'SHOPPING')        return 'SHOPPING';
  if (t === 'DEMAND_GEN' || t === 'DISCOVERY') return 'DEMAND_GEN';
  if (t === 'SEARCH')          return s.indexOf('DYNAMIC') !== -1 ? 'DSA' : 'SEARCH';
  return '';   // unrecognised → fall back to the name rules
}

function deckGroupOf_(tactic) {
  return DECK_GROUP_OF_TACTIC[tactic] || 'OTHER';
}

// ============================== CLASSIFIER =================================

/**
 * Build a classifier closure over the current overrides and engine campaign
 * types. Call once per run and reuse — it caches per campaign key.
 *
 * `engineTypes` is an optional { 'channel||campaign': {channelType, subType} }
 * from the engine tabs.
 */
function makeClassifier_(overrides, engineTypes) {
  var cache = {};
  overrides  = overrides  || {};
  engineTypes = engineTypes || {};

  return function (channel, campaign) {
    var key = classKey_(channel, campaign);
    if (cache[key]) return cache[key];

    var ov = overrides[key] || {};
    var eng = engineTypes[key] || {};

    var autoT = tacticFromChannelType_(eng.channelType, eng.subType) || autoTactic_(campaign);
    var autoB = brandFromLabels_(eng.labels) || autoBrand_(campaign);

    var tactic = ov.tactic || autoT;
    var brand  = ov.brand  || autoB;

    var out = {
      channel: channel, campaign: campaign,
      autoTactic: autoT, autoBrand: autoB,
      tactic: tactic, brand: brand,
      deckGroup: deckGroupOf_(tactic),
      overridden: !!(ov.tactic || ov.brand),
    };
    cache[key] = out;
    return out;
  };
}

function classKey_(channel, campaign) {
  return String(channel || '') + '||' + String(campaign || '');
}

/** Deck "Non-Brand" tables include conquesting. */
function isDeckNonBrand_(brand) { return brand === 'NON_BRAND' || brand === 'COMPETITOR'; }
function isDeckBrand_(brand)    { return brand === 'BRAND'; }

// ============================== CAMPAIGN MAP TAB ===========================

/** Read the override columns. Unknown values are ignored, not silently applied. */
function readOverrides_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MAP_SHEET);
  var out = {};
  if (!sheet || sheet.getLastRow() < 2) return out;

  var vals = sheet.getRange(2, 1, sheet.getLastRow() - 1, MAP_HEADER.length).getValues();
  var rejected = [];
  for (var i = 0; i < vals.length; i++) {
    var channel = String(vals[i][0] || '').trim();
    var campaign = String(vals[i][1] || '').trim();
    if (!channel && !campaign) continue;

    var t = String(vals[i][4] || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
    var b = String(vals[i][5] || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
    var rec = {};
    if (t) {
      if (VALID_TACTICS.indexOf(t) !== -1) rec.tactic = t;
      else rejected.push('row ' + (i + 2) + ' tactic "' + vals[i][4] + '"');
    }
    if (b) {
      if (VALID_BRANDS.indexOf(b) !== -1) rec.brand = b;
      else rejected.push('row ' + (i + 2) + ' brand "' + vals[i][5] + '"');
    }
    if (rec.tactic || rec.brand) out[classKey_(channel, campaign)] = rec;
  }
  if (rejected.length) {
    progress_('Campaign Map: ignored ' + rejected.length + ' invalid override(s) — ' +
      rejected.slice(0, 5).join('; ') + (rejected.length > 5 ? ' …' : '') +
      '. Valid tactics: ' + VALID_TACTICS.join('/') + '. Valid brands: ' + VALID_BRANDS.join('/') + '.');
  }
  return out;
}

/**
 * Rewrite the Campaign Map tab from the campaigns seen in the report month,
 * PRESERVING every override already typed there — including overrides for
 * campaigns that no longer ran (kept at the bottom so history isn't lost when a
 * campaign pauses for a month and comes back).
 */
/**
 * `rows` comes from campaignMapRows_() and is already one row per campaign, from
 * BOTH sources, with cost taken from the engine where it exists.
 *
 * The "Seen in" column is the useful new signal: a campaign showing
 * "Triple Whale only" with real revenue and no engine rows is either a rename
 * (the engine reports the current name, Triple Whale stored the old one) or a
 * channel with no engine feed. Either way the segment sums stay right, because
 * the two sources are combined per channel rather than joined per row.
 */
function renderCampaignMap_(rows, classify) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(MAP_SHEET) || ss.insertSheet(MAP_SHEET);
  var overrides = readOverrides_();

  var seen = {};
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    seen[classKey_(r.channel, r.campaign)] = {
      channel: r.channel, campaign: r.campaign,
      cost: num_(r.spend), rev: num_(r.tw_revenue),
      source: r.source || '',
    };
  }

  var out = [];
  var keys = Object.keys(seen).sort(function (a, b) { return seen[b].cost - seen[a].cost; });
  for (var j = 0; j < keys.length; j++) {
    out.push(mapRow_(seen[keys[j]], classify, overrides, keys[j]));
  }

  // Carry forward overrides for campaigns absent this month.
  var carried = 0;
  Object.keys(overrides).forEach(function (k) {
    if (seen[k]) return;
    var parts = k.split('||');
    out.push(mapRow_({ channel: parts[0], campaign: parts[1], cost: null, rev: null, source: 'not this month' },
      classify, overrides, k));
    carried++;
  });

  sheet.clear();
  sheet.getRange(1, 1, 1, MAP_HEADER.length).setValues([MAP_HEADER])
    .setFontWeight('bold').setBackground(HEAD_BG).setFontColor(HEAD_FG);
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(2);

  if (out.length) {
    sheet.getRange(2, 1, out.length, MAP_HEADER.length).setValues(out);
    sheet.getRange(2, 10, out.length, 1).setNumberFormat(currencyFormat_(false));
    sheet.getRange(2, 11, out.length, 1).setNumberFormat(currencyFormat_(false));

    // Tint the rows that need a human: nothing matched the rules.
    for (var k2 = 0; k2 < out.length; k2++) {
      if (out[k2][7] === 'UNKNOWN' || out[k2][6] === 'OTHER') {
        sheet.getRange(k2 + 2, 1, 1, MAP_HEADER.length).setBackground('#fff4e5');
      }
    }
  }

  // The override columns are the only editable ones — make that visible.
  sheet.getRange(1, 5, 1, 2).setBackground('#0f7b6c');
  var note = 'EDITABLE. Type one of: ' + VALID_TACTICS.join(', ') +
    ' (tactic) / ' + VALID_BRANDS.join(', ') + ' (brand). ' +
    'An override here beats the regex rules in Config.gs and survives every rebuild. ' +
    'Amber rows are unclassified — they are excluded from the Search/Shopping tables ' +
    'and reported in the Reconciliation block.';
  sheet.getRange(1, 5).setNote(note);
  sheet.getRange(1, 6).setNote(note);

  for (var c = 1; c <= MAP_HEADER.length; c++) sheet.autoResizeColumn(c);
  progress_('Campaign Map: ' + keys.length + ' campaign(s) this month' +
    (carried ? ', ' + carried + ' carried-forward override(s)' : '') + '.');
}

function mapRow_(s, classify, overrides, key) {
  var cls = classify(s.channel, s.campaign);
  var ov = overrides[key] || {};
  return [
    s.channel, s.campaign,
    cls.autoTactic, cls.autoBrand,
    ov.tactic || '', ov.brand || '',
    cls.tactic, cls.brand, cls.deckGroup,
    s.cost, s.rev, s.source || '',
  ];
}


// ==========================================================================
// SOURCE FILE: apps-script/Report.gs
// ==========================================================================

/**
 * Xero Shoes — Monthly Report  ·  REPORT TAB
 * =============================================================================
 * Builds the `Report` tab: one block per deck table, shaped EXACTLY like the
 * table it feeds, each registered as a named range (`RPT_*`).
 *
 * Why an intermediate tab instead of writing straight into the deck: you get to
 * look at the numbers, and reconcile them, before they reach a client. The
 * Slides writer then reads these same named ranges, so what you checked is
 * literally what ships.
 *
 * Block → slide map:
 *   RPT_KPI              slide 3   executive summary stat cards
 *   RPT_BLENDED          slide 4   blended paid search (the anchor table)
 *   RPT_SEARCH           slide 5   search
 *   RPT_SHOPPING         slide 5   shopping (Standard Shopping + PMax retail)
 *   RPT_SEARCH_BRAND     slide 6   search · brand
 *   RPT_SEARCH_NONBRAND  slide 6   search · non-brand (includes conquesting)
 *   RPT_SHOP_BRAND       slide 7   shopping · brand
 *   RPT_SHOP_NONBRAND    slide 7   shopping · non-brand
 *   RPT_PRODUCT          slide 8   product category performance
 *   RPT_BRAND_IS         slide 9   our brand impression share, by day
 *   RPT_AUCTION          slide 9   competitor auction insights (manual paste)
 *   RPT_PMAX_CAT         slide 10  PMax search categories
 *   RPT_TOP_ITEMS        slide 11  top products by revenue
 *   RPT_PROMO_SUMMARY    slide 12  promo window totals
 *   RPT_PROMO_ASSETS     slide 12  promo sitelinks
 *   RPT_CHATGPT          slide 13  ChatGPT Ads
 *   RPT_RECONCILIATION   —         why the parts do not sum to the whole
 */

var PCT_FORMAT = '+0.0%;-0.0%;0.0%';

// ============================== ENTRY POINT ================================

function buildReport() {
  var ctx = buildReportContext_();
  renderReportTab_(ctx);
  renderCampaignMap_(ctx.mapRows, ctx.classify);
  progress_('Report built for ' + ctx.periods.current.label + ' (' + REGION + ').');
  return ctx;
}

/**
 * Do all the reading, classifying and summing. Returns everything both the
 * Report tab and the Slides writer need, so neither recomputes anything.
 */
function buildReportContext_() {
  var periods = resolvePeriods_();
  progress_('Reporting ' + periods.current.label + '  ·  prior ' + periods.prior.shortLabel +
    '  ·  YoY ' + periods.yoy.shortLabel);

  progress_('Reading Triple Whale store…');
  var tw = readTripleWhale_();
  progress_('Triple Whale: ' + tw.rows.length + ' rows, ' + tw.minDate + ' → ' + tw.maxDate + '.');

  var eng = readEngineDays_();
  if (eng.rows.length) progress_('Google Ads engine tab: ' + eng.rows.length + ' rows.');
  else progress_('No ' + ENGINE_DAY_SHEET + ' tab — slides 8–12 and YoY engine history will be empty. ' +
    'Run the MCC Google Ads Script to populate them.');

  var classify = makeClassifier_(readOverrides_(), eng.types);

  // Tag and classify every row once.
  var twAds = [], twOpenAi = [];
  for (var i = 0; i < tw.rows.length; i++) {
    var r = tw.rows[i];
    r.src = 'tw';
    if (isAdsChannel_(r.channel))        { r.cls = classify(r.channel, r.campaign); twAds.push(r); }
    else if (isOpenAiChannel_(r.channel)) { twOpenAi.push(r); }
  }
  for (var j = 0; j < eng.rows.length; j++) {
    eng.rows[j].src = 'eng';
    eng.rows[j].cls = classify(eng.rows[j].channel, eng.rows[j].campaign);
  }

  var twCoverage  = coverage_(twAds, periods);
  var engCoverage = coverage_(eng.rows, periods);

  // Which channels each source covers, per period. Drives the honest disclosure
  // about Microsoft being absent from months the engine backfill doesn't reach.
  var channelCoverage = channelCoverage_(twAds, eng.rows, periods);

  // Front-end source per channel per period, decided from ALL rows for that
  // channel — not per segment. See combineChannelBags_ for why that distinction
  // is load-bearing.
  var frontSource = {};
  ['current', 'prior', 'yoy'].forEach(function (p) {
    frontSource[p] = {};
    channelCoverage[p].triplewhale.forEach(function (ch) { frontSource[p][ch] = 'triplewhale'; });
    channelCoverage[p].engine.forEach(function (ch) { frontSource[p][ch] = 'engine'; });
  });

  /**
   * Component bags per period for one segment.
   *
   * The engine is the spine and Triple Whale is the overlay, combined PER
   * CHANNEL and then summed — see the note above FRONT_COMPONENTS in Metrics.gs
   * for why per channel rather than row-by-row.
   */
  var bagsFor = function (pred) {
    var out = {};
    ['current', 'prior', 'yoy'].forEach(function (p) {
      var period = periods[p];
      var byChannel = {};
      var bucket = function (ch) {
        return byChannel[ch] || (byChannel[ch] = { eng: [], tw: [] });
      };

      var engIn = rowsInPeriod_(eng.rows, period);
      for (var i = 0; i < engIn.length; i++) if (pred(engIn[i])) bucket(engIn[i].channel).eng.push(engIn[i]);

      var twIn = rowsInPeriod_(twAds, period);
      for (var j = 0; j < twIn.length; j++) if (pred(twIn[j])) bucket(twIn[j].channel).tw.push(twIn[j]);

      var combined = Object.keys(byChannel).map(function (ch) {
        return combineChannelBags_(sumComponents_(byChannel[ch].eng),
                                   sumComponents_(byChannel[ch].tw),
                                   frontSource[p][ch] || 'none');
      });
      out[p] = mergeBags_(combined);
    });
    return out;
  };

  var isSearch   = function (r) { return r.cls.deckGroup === 'SEARCH'; };
  var isShopping = function (r) { return r.cls.deckGroup === 'SHOPPING'; };

  var segments = {
    blended:         bagsFor(function () { return true; }),
    search:          bagsFor(isSearch),
    shopping:        bagsFor(isShopping),
    searchBrand:     bagsFor(function (r) { return isSearch(r)   && isDeckBrand_(r.cls.brand); }),
    searchNonBrand:  bagsFor(function (r) { return isSearch(r)   && isDeckNonBrand_(r.cls.brand); }),
    shopBrand:       bagsFor(function (r) { return isShopping(r) && isDeckBrand_(r.cls.brand); }),
    shopNonBrand:    bagsFor(function (r) { return isShopping(r) && isDeckNonBrand_(r.cls.brand); }),
    // Completes the tactic partition: every row is SEARCH, SHOPPING or OTHER, so
    // the three must sum to blended exactly. Asserted in the self-test.
    other:           bagsFor(function (r) { return r.cls.deckGroup === 'OTHER'; }),
    unclassified:    bagsFor(function (r) { return r.cls.deckGroup === 'OTHER' || r.cls.brand === 'UNKNOWN'; }),
  };

  // ChatGPT Ads is Triple Whale only — OpenAI has no engine tab here.
  var chatgpt = {};
  ['current', 'prior', 'yoy'].forEach(function (p) {
    chatgpt[p] = sumComponents_(rowsInPeriod_(twOpenAi, periods[p]));
  });

  return {
    periods: periods,
    classify: classify,
    twAds: twAds, twOpenAi: twOpenAi, engRows: eng.rows,
    twMeta: tw,
    twCoverage: twCoverage, engCoverage: engCoverage, channelCoverage: channelCoverage,
    frontSource: frontSource,
    segments: segments, chatgpt: chatgpt,
    mapRows: campaignMapRows_(twAds, eng.rows, periods.current),
    warnings: coverageWarnings_(twCoverage, engCoverage, channelCoverage, periods, tw, segments),
  };
}

/**
 * Which channels each source has rows for, per period, plus each channel's share
 * of current-month spend — so a warning about a missing channel can say how much
 * of the program it actually represents.
 */
function channelCoverage_(twRows, engRows, periods) {
  var out = {};
  ['current', 'prior', 'yoy'].forEach(function (p) {
    var eng = {}, tw = {};
    rowsInPeriod_(engRows, periods[p]).forEach(function (r) { eng[r.channel] = true; });
    rowsInPeriod_(twRows,  periods[p]).forEach(function (r) { tw[r.channel]  = true; });
    out[p] = { engine: Object.keys(eng).sort(), triplewhale: Object.keys(tw).sort() };
  });

  // Current-month spend per channel, engine preferred over Triple Whale so a
  // channel present in both is not counted twice.
  var spend = {}, total = 0;
  var engByChannel = {}, twByChannel = {};
  rowsInPeriod_(engRows, periods.current).forEach(function (r) {
    engByChannel[r.channel] = num_(engByChannel[r.channel]) + num_(r.spend);
  });
  rowsInPeriod_(twRows, periods.current).forEach(function (r) {
    twByChannel[r.channel] = num_(twByChannel[r.channel]) + num_(r.spend);
  });
  var channels = {};
  Object.keys(engByChannel).forEach(function (c) { channels[c] = true; });
  Object.keys(twByChannel).forEach(function (c) { channels[c] = true; });
  Object.keys(channels).forEach(function (c) {
    spend[c] = engByChannel[c] !== undefined ? engByChannel[c] : num_(twByChannel[c]);
    total += spend[c];
  });

  out.currentSpend = spend;
  out.currentSpendTotal = total;
  // Kept separately so the cross-source check can compare only the channels both
  // sources actually cover. Comparing totals would flag a 22% "drift" purely
  // because the engine feed is Google-only while Triple Whale includes Bing —
  // which is not drift, it is the fallback working as designed.
  out.currentEngSpend = engByChannel;
  out.currentTwSpend = twByChannel;
  return out;
}

/**
 * One row per campaign for the Campaign Map, from BOTH sources.
 *
 * Cost prefers the engine (the spine); Triple Whale revenue always comes from
 * Triple Whale. Adding both spends would double-count every campaign that
 * appears in both, so the engine figure wins when present.
 */
function campaignMapRows_(twRows, engRows, period) {
  var acc = {};
  var get = function (channel, campaign) {
    var key = classKey_(channel, campaign);
    return acc[key] || (acc[key] = {
      channel: channel, campaign: campaign,
      engCost: 0, twCost: 0, tw_revenue: 0, engRows: 0, twRows: 0,
    });
  };

  rowsInPeriod_(engRows, period).forEach(function (r) {
    var a = get(r.channel, r.campaign);
    a.engCost += num_(r.spend);
    a.engRows++;
  });
  rowsInPeriod_(twRows, period).forEach(function (r) {
    var a = get(r.channel, r.campaign);
    a.twCost     += num_(r.spend);
    a.tw_revenue += num_(r.tw_revenue);
    a.twRows++;
  });

  return Object.keys(acc).map(function (k) {
    var a = acc[k];
    a.spend = a.engRows ? a.engCost : a.twCost;
    a.source = a.engRows && a.twRows ? 'both' : (a.engRows ? 'engine only' : 'Triple Whale only');
    return a;
  });
}

function coverageWarnings_(twCov, engCov, chanCov, periods, tw, segments) {
  var w = [];
  var cur = derive_(segments.blended.current);

  if (!engCov.current && !twCov.current) {
    w.push('NO data at all for ' + periods.current.label + '. Triple Whale covers ' +
      tw.minDate + ' → ' + tw.maxDate + ' and the engine tab is empty. Sync the Triple Whale ' +
      'sheet, run the MCC Google Ads Script, or set REPORT_MONTH in Config.gs to a covered month.');
  } else if (!engCov.current) {
    w.push('No Google Ads engine data for ' + periods.current.label + ', so front-end columns ' +
      '(impressions, clicks, cost, engine orders/revenue) fall back to Triple Whale for this ' +
      'month. Run the MCC Google Ads Script to make the engine the spine as intended.');
  } else if (!twCov.current) {
    w.push('No Triple Whale data for ' + periods.current.label + ' — front-end and engine ' +
      'columns are real, but every attributed column (TW orders/revenue/AOV/CVR/ROAS) reads n/a.');
  }

  // The gap that matters most: engine history exists but Triple Whale's doesn't.
  ['prior', 'yoy'].forEach(function (p) {
    var label = periods[p].label;
    var which = p === 'prior' ? '%MoM' : '%YoY';
    if (twCov[p]) return;
    if (engCov[p]) {
      w.push(label + ' has engine data but no Triple Whale data, so the ' + which + ' row is real ' +
        'for the front-end and engine columns and n/a for the attributed ones. That is expected ' +
        'until the Triple Whale backfill reaches ' + periods[p].start + ' — see docs/GAPS.md.');
    } else {
      w.push(label + ' has no data from either source, so the whole ' + which + ' row reads n/a. ' +
        'Extend the engine backfill (MONTHS_BACK in engine-report.js) to cover it.');
    }
  });

  // Channels the engine misses in a period Triple Whale cannot cover either.
  ['prior', 'yoy'].forEach(function (p) {
    if (twCov[p] || !engCov[p]) return;      // already reported above
    var engChannels = chanCov[p].engine;
    var missing = TW_ADS_CHANNELS.filter(function (ch) { return engChannels.indexOf(ch) === -1; });
    if (!missing.length) return;
    var share = missingChannelShare_(chanCov, missing);
    w.push(periods[p].label + ' engine data covers ' + engChannels.join(' + ') + ' but not ' +
      missing.join(' + ') + ', so that row understates total spend. ' +
      (share === null ? '' : 'Those channels are ' + (share * 100).toFixed(0) +
        '% of current-month spend. ') +
      'See docs/GAPS.md §8 for the two ways to close this.');
  });

  if (!TW_SESSION_FIELD) {
    w.push('TW Sessions is not available (TW_SESSION_FIELD is unset), so that column reads n/a ' +
      'and TW CVR is computed on clicks. See docs/GAPS.md.');
  }
  return w;
}

/**
 * Share of current-month spend sitting in the channels a past period is missing.
 * Uses the current month as the yardstick because it is the only month we can be
 * sure has all channels — which is exactly why the past period is a problem.
 */
function missingChannelShare_(chanCov, missing) {
  var total = num_(chanCov.currentSpendTotal);
  if (!total) return null;
  var sum = 0;
  for (var i = 0; i < missing.length; i++) sum += num_(chanCov.currentSpend[missing[i]]);
  return sum > 0 ? sum / total : null;
}

// ============================== SHEET WRITER ===============================

/**
 * A cursor over the Report tab that emits titled blocks and registers a named
 * range over each one (header row + data rows — the exact shape of the deck
 * table it feeds).
 */
function newWriter_(sheet) {
  var cursor = 1;
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // Existing named ranges, read ONCE.
  //
  // Do not be tempted by removeNamedRange()-then-setNamedRange(): that throws
  // ("The named range X does not exist") whenever the name isn't already there,
  // which is every name on a first build. Worse, Apps Script batches writes, so
  // the throw can surface at the next flush() rather than at the call site —
  // a try/catch around it is not a reliable guard. Updating an existing
  // NamedRange in place via setRange() avoids the whole problem.
  var existingRanges = {};
  ss.getNamedRanges().forEach(function (nr) { existingRanges[nr.getName()] = nr; });
  var emitted = {};

  return {
    heading: function (text, sub) {
      sheet.getRange(cursor, 1).setValue(text)
        .setFontSize(14).setFontWeight('bold').setFontColor('#1b2a4a');
      cursor++;
      if (sub) {
        sheet.getRange(cursor, 1).setValue(sub).setFontSize(9).setFontColor('#6b7280');
        cursor++;
      }
      cursor++;
      return this;
    },

    lines: function (items, color) {
      for (var i = 0; i < items.length; i++) {
        sheet.getRange(cursor, 1).setValue(items[i]).setFontColor(color || '#6b7280').setFontSize(9);
        cursor++;
      }
      if (items.length) cursor++;
      return this;
    },

    /**
     * opts = { name, slide, title, header, rows, colFormats, rowFormats, note }
     *   colFormats  per-column number format (index parallel to header)
     *   rowFormats  per-data-row override applied across all value columns
     *               (used for the %MoM / %YoY rows)
     */
    block: function (opts) {
      var label = opts.title + (opts.slide ? '   ·   slide ' + opts.slide : '');
      sheet.getRange(cursor, 1).setValue(label).setFontWeight('bold').setFontColor('#374151');
      cursor++;
      if (opts.note) {
        sheet.getRange(cursor, 1).setValue(opts.note).setFontSize(9).setFontColor('#9ca3af');
        cursor++;
      }

      var header = opts.header, rows = opts.rows || [];
      var width = header.length;
      var top = cursor;

      sheet.getRange(top, 1, 1, width).setValues([header])
        .setFontWeight('bold').setBackground(HEAD_BG).setFontColor(HEAD_FG)
        .setVerticalAlignment('middle').setWrap(true);

      if (rows.length) {
        var grid = [];
        for (var r = 0; r < rows.length; r++) {
          var row = [];
          for (var c = 0; c < width; c++) {
            var v = rows[r][c];
            row.push((v === null || v === undefined) ? NA : v);
          }
          grid.push(row);
        }
        sheet.getRange(top + 1, 1, grid.length, width).setValues(grid);

        // Column formats first, then per-row overrides on top.
        if (opts.colFormats) {
          for (var c2 = 0; c2 < width; c2++) {
            if (opts.colFormats[c2]) {
              sheet.getRange(top + 1, c2 + 1, grid.length, 1).setNumberFormat(opts.colFormats[c2]);
            }
          }
        }
        if (opts.rowFormats) {
          for (var r2 = 0; r2 < grid.length; r2++) {
            if (opts.rowFormats[r2] && width > 1) {
              sheet.getRange(top + 1 + r2, 2, 1, width - 1).setNumberFormat(opts.rowFormats[r2]);
              sheet.getRange(top + 1 + r2, 1, 1, width).setFontStyle('italic').setFontColor('#4b5563');
            }
          }
        }
        sheet.getRange(top, 1, grid.length + 1, width).setBorder(true, true, true, true, true, true,
          '#d1d5db', SpreadsheetApp.BorderStyle.SOLID);
      }

      var rangeRows = rows.length + 1;
      if (opts.name) {
        if (emitted[opts.name]) {
          throw new Error('Block "' + opts.name + '" was emitted twice in one build. ' +
            'Every RPT_* name must be unique, or the second one silently wins.');
        }
        emitted[opts.name] = true;

        var range = sheet.getRange(top, 1, rangeRows, width);
        var existing = existingRanges[opts.name];
        if (existing) existing.setRange(range);        // repoint, no remove
        else          ss.setNamedRange(opts.name, range);
      }

      cursor = top + rangeRows + 2;
      return this;
    },

    at: function () { return cursor; },
  };
}

// ============================== RENDER =====================================

function renderReportTab_(ctx) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(REPORT_SHEET) || ss.insertSheet(REPORT_SHEET);

  // Clearing formats too: last month's blocks may have been taller. Charts are
  // not covered by clear(), so they'd otherwise stack up one per rebuild.
  sheet.clear();
  sheet.clearNotes();
  sheet.getCharts().forEach(function (c) { sheet.removeChart(c); });
  var maxRows = sheet.getMaxRows();
  if (maxRows > 1) sheet.getRange(1, 1, maxRows, sheet.getMaxColumns()).setBackground(null);

  var p = ctx.periods;
  var w = newWriter_(sheet);

  w.heading(CLIENT_NAME + ' — Monthly Performance Review  ·  ' + REGION,
    p.current.label + '   |   prior: ' + p.prior.label + '   |   YoY: ' + p.yoy.label +
    '   |   built ' + Utilities.formatDate(new Date(), tz_(), 'yyyy-MM-dd HH:mm') +
    '   |   attribution: whatever the Triple Whale sheet is set to (Last Click / 28-day by default)');

  if (ctx.warnings.length) w.lines(ctx.warnings.map(function (s) { return '⚠  ' + s; }), '#b45309');

  renderKpiBlock_(w, ctx);
  renderMainTables_(w, ctx);
  renderProductBlock_(w, ctx);
  renderImpressionShareBlocks_(w, ctx);
  renderPmaxCategoryBlock_(w, ctx);
  renderTopItemsBlock_(w, ctx);
  renderPromoBlocks_(w, ctx);
  renderChatgptBlock_(w, ctx);
  renderReconciliationBlock_(w, ctx);
  renderBrandIsChart_(sheet, w.at());

  sheet.setColumnWidth(1, 230);
  for (var c = 2; c <= 16; c++) sheet.setColumnWidth(c, 92);
  sheet.setFrozenColumns(1);
  if (sheet.getFilter()) sheet.getFilter().remove();
}

// ---- slide 3: executive summary stat cards ----

function renderKpiBlock_(w, ctx) {
  var cur = derive_(ctx.segments.blended.current);
  var pri = derive_(ctx.segments.blended.prior);

  var kpis = [
    ['TOTAL SPEND',  'cost',       currencyFormat_(false)],
    ['TW REVENUE',   'tw_revenue', currencyFormat_(false)],
    ['BLENDED ROAS', 'tw_roas',    '#,##0.00'],
    ['TW ORDERS',    'tw_orders',  '#,##0'],
  ];

  var header = ['Metric'], values = ['Value'], moms = ['% MoM'];
  for (var i = 0; i < kpis.length; i++) {
    header.push(kpis[i][0]);
    values.push(cur[kpis[i][1]]);
    moms.push(pctChange_(cur[kpis[i][1]], pri[kpis[i][1]]));
  }

  w.block({
    name: 'RPT_KPI', slide: '3', title: 'Executive Summary — stat cards',
    note: 'Blended paid search: Google Ads + Microsoft Ads. ChatGPT Ads is excluded (it has its own slide).',
    header: header,
    rows: [values, moms],
    colFormats: [null, kpis[0][2], kpis[1][2], kpis[2][2], kpis[3][2]],
    rowFormats: [null, PCT_FORMAT],
  });
}

// ---- slides 4–7: the main comparison tables ----

function renderMainTables_(w, ctx) {
  var cols = tableColumns_();
  var header = ['Month'].concat(cols.map(function (c) { return c[0]; }));
  var colFormats = [null].concat(cols.map(function (c) { return c[2]; }));
  var labels = { current: ctx.periods.current.shortLabel, prior: ctx.periods.prior.shortLabel };

  var tables = [
    ['RPT_BLENDED',         '4', 'Blended Paid Search',      'blended',
      'The anchor table. Every other table must reconcile back to this one.'],
    ['RPT_SEARCH',          '5', 'Search',                   'search',
      'Text campaigns, including DSA.'],
    ['RPT_SHOPPING',        '5', 'Shopping',                 'shopping',
      'Standard Shopping + Performance Max retail, per the deck definition.'],
    ['RPT_SEARCH_BRAND',    '6', 'Search · Brand',           'searchBrand', ''],
    ['RPT_SEARCH_NONBRAND', '6', 'Search · Non-Brand',       'searchNonBrand',
      'Includes conquesting/competitor campaigns.'],
    ['RPT_SHOP_BRAND',      '7', 'Shopping · Brand',         'shopBrand', ''],
    ['RPT_SHOP_NONBRAND',   '7', 'Shopping · Non-Brand',     'shopNonBrand', ''],
  ];

  for (var i = 0; i < tables.length; i++) {
    var t = tables[i];
    var built = periodRows_(ctx.segments[t[3]], cols, labels);
    w.block({
      name: t[0], slide: t[1], title: t[2], note: t[4],
      header: header, rows: built.rows,
      colFormats: colFormats,
      rowFormats: [null, null, PCT_FORMAT, PCT_FORMAT],
    });
  }
}

// ---- slide 13: ChatGPT Ads ----

function renderChatgptBlock_(w, ctx) {
  var cols = chatgptColumns_();
  var header = ['Month'].concat(cols.map(function (c) { return c[0]; }));
  var built = periodRows_(ctx.chatgpt, cols, {
    current: ctx.periods.current.shortLabel, prior: ctx.periods.prior.shortLabel,
  });

  var spend = derive_(ctx.chatgpt.current).cost;
  var blended = derive_(ctx.segments.blended.current).cost;
  var share = div_(spend, num_(blended) + num_(spend));

  w.block({
    name: 'RPT_CHATGPT', slide: '13', title: 'ChatGPT Ads (OpenAI) — test channel',
    note: 'Triple Whale openai-ads channel. OpenAI reports no conversion value, so the Engine ' +
      'columns are omitted rather than shown as zeros. Share of total paid media investment: ' +
      (share === null ? NA : (share * 100).toFixed(1) + '%') + '.',
    header: header, rows: built.rows,
    colFormats: [null].concat(cols.map(function (c) { return c[2]; })),
    rowFormats: [null, null, PCT_FORMAT, PCT_FORMAT],
  });
}

// ---- reconciliation ----

/**
 * The block that makes the deck defensible.
 *
 * Two gaps can open up, and both are reported in dollars:
 *
 *   slide 4 vs. slide 5 — Demand Gen and unclassifiable campaigns are in the
 *     blended total but belong to neither the Search nor the Shopping table.
 *
 *   slide 5 vs. slides 6/7 — a campaign can land in Search or Shopping and still
 *     have no brand assignment, in which case it appears in the tactic table but
 *     in NEITHER the Brand nor the Non-Brand one. Without this row that campaign
 *     is invisible: every table renders, every table is internally consistent,
 *     and the brand split quietly under-reports.
 */
function renderReconciliationBlock_(w, ctx) {
  var d = function (seg) { return derive_(ctx.segments[seg].current); };
  var blended = d('blended'), search = d('search'), shopping = d('shopping');
  var sBr = d('searchBrand'), sNb = d('searchNonBrand');
  var hBr = d('shopBrand'),   hNb = d('shopNonBrand');
  var unc = d('unclassified');

  // Rounded to cents: these are differences of large sums, so float residue would
  // otherwise render a perfectly reconciled month as '-0.0000'.
  var gap = function (whole, parts) {
    var v = num_(whole) - parts.reduce(function (a, p) { return a + num_(p); }, 0);
    return Math.round(v * 100) / 100;
  };

  var tacticGapCost = gap(blended.cost, [search.cost, shopping.cost]);
  var tacticGapRev  = gap(blended.tw_revenue, [search.tw_revenue, shopping.tw_revenue]);
  var searchGapCost = gap(search.cost, [sBr.cost, sNb.cost]);
  var shopGapCost   = gap(shopping.cost, [hBr.cost, hNb.cost]);

  var rows = [
    ['Blended  (slide 4)',                       blended.cost,  blended.tw_revenue],
    ['  Search  (slide 5)',                       search.cost,   search.tw_revenue],
    ['  Shopping  (slide 5)',                     shopping.cost, shopping.tw_revenue],
    ['  In neither tactic table',                 tacticGapCost, tacticGapRev],
    ['    — of which unclassified / Demand Gen',  unc.cost,      unc.tw_revenue],
    ['Search · Brand  (slide 6)',                 sBr.cost,      sBr.tw_revenue],
    ['Search · Non-Brand  (slide 6)',             sNb.cost,      sNb.tw_revenue],
    ['  Search with no brand assignment',         searchGapCost, gap(search.tw_revenue, [sBr.tw_revenue, sNb.tw_revenue])],
    ['Shopping · Brand  (slide 7)',               hBr.cost,      hBr.tw_revenue],
    ['Shopping · Non-Brand  (slide 7)',           hNb.cost,      hNb.tw_revenue],
    ['  Shopping with no brand assignment',       shopGapCost,   gap(shopping.tw_revenue, [hBr.tw_revenue, hNb.tw_revenue])],
  ];

  // Do the two sources actually describe the same program? This is the check
  // that catches a broken engine backfill, a missing channel, or a Triple Whale
  // sync that stalled — none of which the per-segment sums would reveal, because
  // each source is internally consistent on its own.
  var bag = ctx.segments.blended.current;
  var engSpend = bag._engSpend, twSpend = bag._twSpend;
  var agreement = (engSpend === null || twSpend === null) ? null : div_(engSpend - twSpend, twSpend);

  rows.push(['Engine cost (spine)',            engSpend, null]);
  rows.push(['Triple Whale spend (overlay)',   twSpend,  null]);
  rows.push(['  engine vs TW difference',
    (engSpend === null || twSpend === null) ? null : Math.round((engSpend - twSpend) * 100) / 100, null]);

  var pct = function (v, base) {
    var p = div_(v, base);
    return p === null ? '—' : (p * 100).toFixed(1) + '%';
  };

  var note = 'Search + Shopping do not sum to Blended by design: Demand Gen and any campaign the ' +
    'classifier could not place belong to neither table, but both are real spend and stay in the ' +
    'blended total. That gap is ' + pct(tacticGapCost, blended.cost) + ' of blended cost.  ' +
    'The brand rows should sum to their tactic exactly — "no brand assignment" is ' +
    pct(searchGapCost, search.cost) + ' of Search and ' + pct(shopGapCost, shopping.cost) +
    ' of Shopping. Anything materially above zero there means slides 6–7 under-report their ' +
    'slide 5 parent; fix it with the override columns on the "' + MAP_SHEET + '" tab (amber rows).' +
    '\n\nFront-end source this month: ' + (bag._frontSource || 'none') + '. ' +
    (agreement === null
      ? 'Only one source covers this month, so there is nothing to cross-check.'
      : 'Engine cost runs ' + (agreement * 100).toFixed(1) + '% vs Triple Whale spend. A few percent ' +
        'is normal (different currency conversion and refresh timing). More than ~5% means one side ' +
        'is missing a channel or a sync stalled — check Diagnostics → Check data sources.');

  w.block({
    name: 'RPT_RECONCILIATION', title: 'Reconciliation — why the parts do not sum to the whole',
    note: note,
    header: ['Segment', 'Cost', 'TW Revenue'],
    rows: rows,
    colFormats: [null, currencyFormat_(false), currencyFormat_(false)],
  });
}


// ==========================================================================
// SOURCE FILE: apps-script/ReportDetail.gs
// ==========================================================================

/**
 * Xero Shoes — Monthly Report  ·  DETAIL BLOCKS (slides 8–12)
 * =============================================================================
 * These five slides need Google Ads data that Triple Whale does not carry, so
 * they read the `_eng_*` tabs written by google-ads-script/engine-report.js.
 *
 * Every block here degrades to an empty, labelled table when its tab is absent —
 * a deck that renders with a visible "no data, run the MCC script" note is far
 * better than one that silently drops a slide.
 *
 * The two manual-input tabs are created here too:
 *   `Auction Insights` — competitor auction data. Google exposes NO auction
 *                        insights through any API, at any access level. There is
 *                        no script that can fetch this. Paste it. See docs/GAPS.md.
 *   `Promos`           — promo windows, so slide 12 knows what dates to measure.
 */

// ============================== SHARED HELPERS =============================

/** Sum a set of engine detail rows into one bag keyed by `keyFn`. */
function groupEngine_(rows, keyFn) {
  var groups = {}, order = [];
  for (var i = 0; i < rows.length; i++) {
    var k = keyFn(rows[i]);
    if (k === null) continue;
    if (!groups[k]) { groups[k] = { key: k, row: rows[i], impressions: 0, clicks: 0, cost: 0, conversions: 0, conversions_value: 0 }; order.push(k); }
    var g = groups[k];
    g.impressions       += num_(rows[i].impressions);
    g.clicks            += num_(rows[i].clicks);
    g.cost              += num_(rows[i].cost);
    g.conversions       += num_(rows[i].conversions);
    g.conversions_value += num_(rows[i].conversions_value);
  }
  return order.map(function (k) { return groups[k]; });
}

function byValueDesc_(a, b) { return b.conversions_value - a.conversions_value; }

/** Pad a row list out to `n` rows with blanks, so the deck table always fills. */
function padRows_(rows, n, width) {
  var out = rows.slice(0, n);
  while (out.length < n) {
    var blank = [];
    for (var c = 0; c < width; c++) blank.push('');
    out.push(blank);
  }
  return out;
}

function monthOf_(v) {
  var s = String(v || '').trim();
  var m = s.match(/^(\d{4})-(\d{2})/);
  if (m) return m[1] + '-' + m[2];
  var d = normDate_(v);
  return d ? d.slice(0, 7) : '';
}

function emptyNote_(tab) {
  return 'No data in the "' + tab + '" tab. Run the MCC Google Ads Script ' +
    '(google-ads-script/engine-report.js) to populate it — see docs/SETUP.md.';
}

// ============================== SLIDE 8: PRODUCT CATEGORY ==================

function renderProductBlock_(w, ctx) {
  var month = ctx.periods.current.month;
  var raw = readEngineTab_(ENGINE_PRODUCT_SHEET).filter(function (r) { return monthOf_(r.month) === month; });

  var groups = groupEngine_(raw, function (r) {
    return String(r.product_type_l1 || '(not set)') + '||' + String(r.product_type_l2 || '(not set)');
  }).sort(byValueDesc_);

  var rows = groups.map(function (g) {
    var parts = g.key.split('||');
    return [
      parts[0], parts[1],
      g.impressions, g.clicks, g.cost,
      div_(g.cost, g.clicks),
      g.conversions, g.conversions_value,
      div_(g.conversions_value, g.cost),
    ];
  });

  w.block({
    name: 'RPT_PRODUCT', slide: '8', title: 'Product Category Performance',
    note: raw.length
      ? 'Google Ads engine data, shopping_performance_view segmented by product type. Sorted by ' +
        'conversion value, top ' + PRODUCT_ROWS + ' sub-categories.'
      : emptyNote_(ENGINE_PRODUCT_SHEET),
    header: ['Product Type (1st)', 'Product Type (2nd)', 'Impr.', 'Clicks', 'Cost',
             'Avg. CPC', 'Conversions', 'Conv. Value', 'ROAS'],
    rows: padRows_(rows, PRODUCT_ROWS, 9),
    colFormats: [null, null, '#,##0', '#,##0', currencyFormat_(false),
                 currencyFormat_(true), '#,##0', currencyFormat_(false), '#,##0.00'],
  });
}

// ============================== SLIDE 9: IMPRESSION SHARE ==================

function renderImpressionShareBlocks_(w, ctx) {
  // ---- our own brand impression share, by day, from the engine tab ----
  var period = ctx.periods.current;
  var brandSearch = [];
  for (var i = 0; i < ctx.engRows.length; i++) {
    var r = ctx.engRows[i];
    if (r.date < period.start || r.date > period.end) continue;
    if (!isDeckBrand_(r.cls.brand)) continue;
    if (r.cls.deckGroup !== 'SEARCH') continue;
    brandSearch.push(r);
  }

  var byDate = {};
  for (var j = 0; j < brandSearch.length; j++) {
    var d = brandSearch[j].date;
    (byDate[d] || (byDate[d] = [])).push(brandSearch[j]);
  }
  var dates = Object.keys(byDate).sort();
  var isRows = dates.map(function (dt) {
    var bag = sumComponents_(byDate[dt]);
    return [dt, derive_(bag).is_share];
  });

  var monthShare = brandSearch.length ? derive_(sumComponents_(brandSearch)).is_share : null;

  w.block({
    name: 'RPT_BRAND_IS', slide: '9', title: 'Brand Impression Share — ours, by day',
    note: brandSearch.length
      ? 'Google Ads metrics.search_impression_share on brand search campaigns. Rolled up as total ' +
        'impressions ÷ total eligible impressions, never as an average of daily percentages. ' +
        'Month: ' + (monthShare === null ? NA : (monthShare * 100).toFixed(1) + '%') + '.'
      : emptyNote_(ENGINE_DAY_SHEET) + ' (Needs search_impression_share on brand search campaigns.)',
    header: ['Date', 'Xero Shoes Impr. Share'],
    rows: isRows.length ? isRows : [['', null]],
    colFormats: [null, '0.0%'],
  });

  // ---- competitors: manual paste, because no API exposes this ----
  var auction = readEngineTab_(AUCTION_SHEET);
  var thisMonth = auction.filter(function (r) { return monthOf_(r.month) === period.month; });
  var rows = thisMonth.map(function (r) {
    return [
      String(r.domain || ''),
      toRatio_(r['impr. share'] !== undefined ? r['impr. share'] : r['impression share']),
      toRatio_(r['overlap rate']),
      toRatio_(r['position above rate']),
      toRatio_(r['top of page rate']),
      toRatio_(r['outranking share']),
    ];
  }).sort(function (a, b) { return num_(b[1]) - num_(a[1]); });

  w.block({
    name: 'RPT_AUCTION', slide: '9', title: 'Auction Insights — competitors (manual)',
    note: 'Google exposes NO auction insights data through the Google Ads API or Google Ads ' +
      'Scripts, for any campaign type. This block is fed by hand: Google Ads → Campaigns → select ' +
      'the brand campaigns → Insights → Auction insights → download, then paste into the "' +
      AUCTION_SHEET + '" tab. See docs/GAPS.md.' +
      (thisMonth.length ? '' : '  ⚠  Nothing pasted for ' + period.label + ' yet.'),
    header: ['Display URL Domain', 'Impr. Share', 'Overlap Rate', 'Position Above Rate',
             'Top of Page Rate', 'Outranking Share'],
    rows: rows.length ? rows : [['', null, null, null, null, null]],
    colFormats: [null, '0.0%', '0.0%', '0.0%', '0.0%', '0.0%'],
  });
}

/**
 * A line chart of our brand impression share, parked at the bottom of the Report
 * tab. Slide 9's chart is a native PowerPoint chart carrying sample data, and
 * SlidesApp cannot rewrite a converted chart's series — so the workflow the
 * deck's own speaker notes describe is the one that works: copy this chart and
 * paste it over the placeholder, linked.
 */
function renderBrandIsChart_(sheet, anchorRow) {
  var range = SpreadsheetApp.getActiveSpreadsheet().getRangeByName('RPT_BRAND_IS');
  if (!range || range.getNumRows() < 3) return;   // header + at least two points

  var chart = sheet.newChart()
    .asLineChart()
    .addRange(range)
    .setNumHeaders(1)
    .setPosition(anchorRow, 1, 0, 0)
    .setOption('title', 'Brand Impression Share — ' + CLIENT_NAME + ' (' + REGION + ')')
    .setOption('legend', { position: 'none' })
    .setOption('width', 900)
    .setOption('height', 320)
    .setOption('pointSize', 0)
    .setOption('lineWidth', 3)
    .setOption('colors', ['#1b2a4a'])
    .setOption('vAxis', { format: 'percent', viewWindow: { min: 0, max: 1 } })
    .setOption('hAxis', { slantedText: true, slantedTextAngle: 45 })
    .build();

  sheet.insertChart(chart);
}

/** Accept 0.42, '42%', '42' or '< 10%' from a pasted auction insights export. */
function toRatio_(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return v > 1 ? v / 100 : v;
  var s = String(v).trim();
  if (/^<\s*10%?$/.test(s)) return 0.1;          // Google's "< 10%" floor
  var m = s.match(/-?[\d.]+/);
  if (!m) return null;
  var n = Number(m[0]);
  if (!isFinite(n)) return null;
  return s.indexOf('%') !== -1 ? n / 100 : (n > 1 ? n / 100 : n);
}

// ============================== SLIDE 10: PMAX SEARCH CATEGORIES ===========

function renderPmaxCategoryBlock_(w, ctx) {
  var month = ctx.periods.current.month;
  var raw = readEngineTab_(ENGINE_PMAXCAT_SHEET).filter(function (r) { return monthOf_(r.month) === month; });

  var groups = groupEngine_(raw, function (r) {
    var c = String(r.category || '').trim();
    return c || null;
  }).sort(byValueDesc_);

  var rows = groups.map(function (g) {
    return [
      g.key,
      null,                                   // Search Volume — see note below
      g.conversions, g.clicks, g.impressions, g.conversions_value,
      div_(g.clicks, g.impressions),
      div_(g.conversions, g.clicks),
    ];
  });

  w.block({
    name: 'RPT_PMAX_CAT', slide: '10', title: 'Top PMax Search Categories',
    note: (raw.length
      ? 'Google Ads campaign_search_term_insight, aggregated across Performance Max campaigns and ' +
        'sorted by conversions. '
      : emptyNote_(ENGINE_PMAXCAT_SHEET) + ' ') +
      'The deck\'s "Search Volume" column reads n/a on purpose: the search-term-insights API returns ' +
      'impressions, clicks, conversions and conversion value, but not the bucketed search volume the ' +
      'Google Ads UI shows. Use Impr. instead, or type the UI value in by hand.',
    header: ['Search Category', 'Search Volume', 'Conversions', 'Clicks', 'Impr.',
             'Conv. Value', 'CTR', 'Conv. Rate'],
    rows: padRows_(rows, PMAX_CAT_ROWS, 8),
    colFormats: [null, '#,##0', '#,##0', '#,##0', '#,##0', currencyFormat_(false), '0.00%', '0.00%'],
  });
}

// ============================== SLIDE 11: TOP PRODUCTS =====================

function renderTopItemsBlock_(w, ctx) {
  var month = ctx.periods.current.month;
  var raw = readEngineTab_(ENGINE_ITEM_SHEET).filter(function (r) { return monthOf_(r.month) === month; });

  var groups = groupEngine_(raw, function (r) {
    return String(r.item_id || r.title || '').trim() || null;
  }).sort(byValueDesc_);

  var rows = groups.map(function (g) {
    var title = String(g.row.title || '').trim() || g.key;
    return [title, g.key, g.conversions, g.conversions_value, g.cost, div_(g.conversions_value, g.cost)];
  });

  w.block({
    name: 'RPT_TOP_ITEMS', slide: '11', title: 'Performance Max — Top Products by Revenue',
    note: raw.length
      ? 'Google Ads engine data at item level, sorted by conversion value. Row 1 is the deck\'s ' +
        '"top revenue driver" card. Product imagery is not automated — drop shots from the Shopping ' +
        'feed into the deck\'s image frames.'
      : emptyNote_(ENGINE_ITEM_SHEET),
    header: ['Product Name', 'Item ID', 'Orders', 'Revenue', 'Cost', 'ROAS'],
    rows: padRows_(rows, TOP_ITEM_ROWS, 6),
    colFormats: [null, null, '#,##0', currencyFormat_(false), currencyFormat_(false), '#,##0.00'],
  });
}

// ============================== SLIDE 12: PROMOTION RECAP ==================

function renderPromoBlocks_(w, ctx) {
  var promos = readPromos_(ctx.periods.current);
  var noPromoNote = 'No promo windows listed for ' + ctx.periods.current.label + ' on the "' +
    PROMO_SHEET + '" tab. Add one (Promo Name, Start, End) to build this block — or delete slide 12 ' +
    'for months with no promotion, as the deck\'s speaker notes suggest.';

  // ---- window totals: the promo, the equal-length run-up, and last year ----
  var rows = [];
  for (var i = 0; i < promos.length; i++) {
    var pr = promos[i];
    rows.push(promoRow_(pr.name + ' (' + pr.start + ' → ' + pr.end + ')', ctx.twAds, pr.start, pr.end));
    rows.push(promoRow_('— prior ' + pr.days + ' days', ctx.twAds, pr.priorStart, pr.priorEnd));
    rows.push(promoRow_('— same window last year', ctx.twAds, pr.lyStart, pr.lyEnd));
    rows.push(promoRow_('— brand text only, promo window', ctx.twAds, pr.start, pr.end, function (r) {
      return r.cls.deckGroup === 'SEARCH' && isDeckBrand_(r.cls.brand);
    }));
  }

  w.block({
    name: 'RPT_PROMO_SUMMARY', slide: '12', title: 'Promotion Recap — window totals',
    note: promos.length
      ? 'Triple Whale attributed revenue over each promo window, with the equal-length run-up ' +
        'before it and the same calendar window last year for context. "n/a" on the last-year row ' +
        'means the Triple Whale backfill does not reach that far.'
      : noPromoNote,
    header: ['Window', 'Days', 'Cost', 'TW Revenue', 'TW ROAS', 'TW Orders', 'TW AOV'],
    rows: rows.length ? rows : [['', null, null, null, null, null, null]],
    colFormats: [null, '#,##0', currencyFormat_(false), currencyFormat_(false), '#,##0.00',
                 '#,##0', currencyFormat_(true)],
  });

  // ---- sitelink / extension detail from the engine asset tab ----
  // Always emitted, even with no promo: the deck's slide 12 table is mapped to
  // this range, and an unregistered range makes the Slides writer report a
  // missing block rather than a blank-but-correct one.
  var first = promos.length ? promos[0] : null;
  var inWindow = [];
  if (first) {
    inWindow = readEngineTab_(ENGINE_ASSET_SHEET).filter(function (r) {
      var d = normDate_(r.date);
      return d && d >= first.start && d <= first.end;
    });
  }

  var groups = groupEngine_(inWindow, function (r) {
    return String(r.asset_text || '').trim() || null;
  }).sort(byValueDesc_);

  var assetRows = padRows_(groups.map(function (g) {
    return [g.key, g.impressions, g.clicks, g.cost, g.conversions];
  }), PROMO_ROWS, 5);

  var totals = groups.reduce(function (a, g) {
    return [a[0] + g.impressions, a[1] + g.clicks, a[2] + g.cost, a[3] + g.conversions];
  }, [0, 0, 0, 0]);
  assetRows.push(['Grand Total'].concat(groups.length ? totals : [null, null, null, null]));

  w.block({
    name: 'RPT_PROMO_ASSETS', slide: '12', title: 'Promotion Recap — sitelinks / extensions',
    note: (!first
      ? noPromoNote + ' '
      : (inWindow.length
          ? 'Google Ads asset performance over ' + first.name + ' (' + first.start + ' → ' + first.end + '). '
          : emptyNote_(ENGINE_ASSET_SHEET) + ' ')) +
      'Orders here are ENGINE-reported conversions on the asset — Google does not attribute Triple ' +
      'Whale revenue to individual sitelinks, so use the window totals above for the revenue story.' +
      (promos.length > 1 ? '  Showing the first of ' + promos.length + ' promo windows; duplicate ' +
        'deck slide 12 per promo and re-run with the others reordered on the ' + PROMO_SHEET + ' tab.' : ''),
    header: ['Sitelink / Extension', 'Impr.', 'Clicks', 'Spend', 'Orders'],
    rows: assetRows,
    colFormats: [null, '#,##0', '#,##0', currencyFormat_(false), '#,##0'],
  });
}

function promoRow_(label, rows, start, end, pred) {
  if (!start || !end) return [label, null, null, null, null, null, null];
  var kept = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (r.date < start || r.date > end) continue;
    if (pred && !pred(r)) continue;
    kept.push(r);
  }
  var m = derive_(sumComponents_(kept));
  return [label, daysBetween_(start, end) + 1, m.cost, m.tw_revenue, m.tw_roas, m.tw_orders, m.tw_aov];
}

/** Promo windows overlapping the report month, with their comparison windows. */
function readPromos_(period) {
  var raw = readEngineTab_(PROMO_SHEET);
  var out = [];
  for (var i = 0; i < raw.length; i++) {
    var name = String(raw[i]['promo name'] || raw[i].promo || raw[i].name || '').trim();
    var start = normDate_(raw[i].start), end = normDate_(raw[i].end);
    if (!name || !start || !end) continue;
    if (end < period.start || start > period.end) continue;      // no overlap with the month
    var days = daysBetween_(start, end) + 1;
    out.push({
      name: name, start: start, end: end, days: days,
      priorStart: dateAdd_(start, -days), priorEnd: dateAdd_(start, -1),
      lyStart: dateAdd_(start, -365), lyEnd: dateAdd_(end, -365),
    });
  }
  return out.sort(function (a, b) { return a.start < b.start ? -1 : 1; });
}

// ============================== INPUT TABS =================================

/** Create the two hand-fed tabs, with headers and guidance, if they don't exist. */
function ensureInputTabs_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  if (!ss.getSheetByName(AUCTION_SHEET)) {
    var a = ss.insertSheet(AUCTION_SHEET);
    var ah = ['Month', 'Domain', 'Impr. Share', 'Overlap Rate', 'Position Above Rate',
              'Top of Page Rate', 'Outranking Share'];
    a.getRange(1, 1, 1, ah.length).setValues([ah])
      .setFontWeight('bold').setBackground(HEAD_BG).setFontColor(HEAD_FG);
    a.setFrozenRows(1);
    a.getRange(1, 1).setNote('Month as yyyy-MM (e.g. 2026-07). One row per competitor domain per ' +
      'month. Paste from Google Ads → Campaigns → select brand campaigns → Insights → Auction ' +
      'insights → download. This cannot be automated: no Google API exposes auction insights.');
    a.getRange(2, 1, 1, 2).setValues([['', 'Paste your auction insights export here →']])
      .setFontColor('#9ca3af').setFontStyle('italic');
    for (var c = 1; c <= ah.length; c++) a.autoResizeColumn(c);
  }

  if (!ss.getSheetByName(PROMO_SHEET)) {
    var p = ss.insertSheet(PROMO_SHEET);
    var ph = ['Promo Name', 'Start', 'End', 'Notes'];
    p.getRange(1, 1, 1, ph.length).setValues([ph])
      .setFontWeight('bold').setBackground(HEAD_BG).setFontColor(HEAD_FG);
    p.setFrozenRows(1);
    p.getRange(1, 1).setNote('One row per promotion. Dates as yyyy-MM-dd, inclusive. Any promo ' +
      'overlapping the report month drives slide 12. Leave empty for months with no promotion.');
    p.getRange(2, 1, 1, 4).setValues([['Example — delete me', '2026-07-04', '2026-07-08',
      'Slide 12 measures this window vs. the 5 days before it and the same window last year']])
      .setFontColor('#9ca3af').setFontStyle('italic');
    p.getRange(2, 2, 1, 2).setNumberFormat('@');
    for (var c2 = 1; c2 <= ph.length; c2++) p.autoResizeColumn(c2);
  }
}


// ==========================================================================
// SOURCE FILE: apps-script/Slides.gs
// ==========================================================================

/**
 * Xero Shoes — Monthly Report  ·  SLIDES WRITER
 * =============================================================================
 * Copies the framework deck and fills it from the `RPT_*` named ranges.
 *
 * It reads DISPLAY values, not raw numbers. The Report tab has already applied
 * every number format, so the deck is guaranteed to show exactly the figures you
 * reviewed in the sheet — no second, subtly different formatting path that lets
 * the deck and the sheet disagree.
 *
 * What it does NOT touch, by design:
 *   · narrative bullets — the "[Headline #1 — …]" placeholders. Those are the
 *     analyst's job, and a generated sentence about "up 12% MoM" is exactly the
 *     filler a client notices.
 *   · slide 9's chart, and slide 11/12 imagery. See docs/GAPS.md.
 *
 * The deck is validated before anything is written: if a table's shape doesn't
 * match the block that feeds it, that table is SKIPPED and reported, rather than
 * half-filled.
 */

/**
 * Slide-by-slide fill plan.
 *
 * `slide`  1-based slide number in the framework deck
 * `range`  named range on the Report tab
 * `pick`   which table on that slide, when there is more than one, ordered top to
 *          bottom (slides 5–7 each carry two identically-shaped tables)
 * `rows`   expected data rows in the deck table, excluding its header row
 * `cols`   expected columns
 */
function slidePlan_() {
  return [
    { slide: 4,  range: 'RPT_BLENDED',        pick: 0, rows: 4,               cols: 15 },
    { slide: 5,  range: 'RPT_SEARCH',         pick: 0, rows: 4,               cols: 15 },
    { slide: 5,  range: 'RPT_SHOPPING',       pick: 1, rows: 4,               cols: 15 },
    { slide: 6,  range: 'RPT_SEARCH_BRAND',   pick: 0, rows: 4,               cols: 15 },
    { slide: 6,  range: 'RPT_SEARCH_NONBRAND',pick: 1, rows: 4,               cols: 15 },
    { slide: 7,  range: 'RPT_SHOP_BRAND',     pick: 0, rows: 4,               cols: 15 },
    { slide: 7,  range: 'RPT_SHOP_NONBRAND',  pick: 1, rows: 4,               cols: 15 },
    { slide: 8,  range: 'RPT_PRODUCT',        pick: 0, rows: PRODUCT_ROWS,    cols: 9  },
    { slide: 10, range: 'RPT_PMAX_CAT',       pick: 0, rows: PMAX_CAT_ROWS,   cols: 8  },
    { slide: 12, range: 'RPT_PROMO_ASSETS',   pick: 0, rows: PROMO_ROWS + 1,  cols: 5  },
    { slide: 13, range: 'RPT_CHATGPT',        pick: 0, rows: 4,               cols: 12 },
  ];
}

// ============================== ENTRY POINT ================================

function buildDeck() {
  var ctx = buildReportContext_();
  renderReportTab_(ctx);
  renderCampaignMap_(ctx.mapRows, ctx.classify);
  var url = writeDeck_(ctx);
  tell_('Deck ready', url ? url : 'Deck generation skipped (DECK_TEMPLATE_ID is not set in Config.gs).');
  return url;
}

function writeDeck_(ctx) {
  if (!DECK_TEMPLATE_ID) {
    progress_('DECK_TEMPLATE_ID is not set — Report tab built, deck skipped.');
    return '';
  }

  var period = ctx.periods.current;
  var name = CLIENT_NAME + ' — Monthly Review — ' + REGION + ' — ' + period.label;

  progress_('Copying the deck template…');
  var templateFile = DriveApp.getFileById(DECK_TEMPLATE_ID);
  var copy = DECK_OUTPUT_FOLDER_ID
    ? templateFile.makeCopy(name, DriveApp.getFolderById(DECK_OUTPUT_FOLDER_ID))
    : templateFile.makeCopy(name);

  var deck = SlidesApp.openById(copy.getId());
  var slides = deck.getSlides();
  var skipped = [];

  // ---- tables ----
  var plan = slidePlan_();
  for (var i = 0; i < plan.length; i++) {
    var step = plan[i];
    try {
      fillTable_(deck, slides, step, skipped);
    } catch (e) {
      skipped.push('slide ' + step.slide + ' / ' + step.range + ': ' + e.message);
    }
  }

  // ---- cover + footers ----
  fillCover_(deck, ctx);

  // ---- slide 3 stat cards ----
  try { fillKpiCards_(slides, ctx, skipped); }
  catch (e) { skipped.push('slide 3 stat cards: ' + e.message); }

  // ---- slide 11 product cards ----
  try { fillProductCards_(slides, skipped); }
  catch (e) { skipped.push('slide 11 product cards: ' + e.message); }

  deck.saveAndClose();

  if (skipped.length) {
    progress_('Deck written with ' + skipped.length + ' item(s) skipped: ' + skipped.join(' | '));
  } else {
    progress_('Deck written: every mapped table and card filled.');
  }
  return copy.getUrl();
}

// ============================== TABLES =====================================

function fillTable_(deck, slides, step, skipped) {
  if (step.slide > slides.length) {
    skipped.push('slide ' + step.slide + ' does not exist in the template (deck has ' +
      slides.length + ' slides)');
    return;
  }

  var values = namedDisplayValues_(step.range);
  if (!values) { skipped.push(step.range + ' named range is missing from the Report tab'); return; }

  // Row 0 of the block is its header; the deck table already has its own header.
  var body = values.slice(1);

  var tables = slides[step.slide - 1].getTables().slice().sort(function (a, b) {
    return a.getTop() - b.getTop();
  });
  if (tables.length <= step.pick) {
    skipped.push('slide ' + step.slide + ' has ' + tables.length + ' table(s), expected at least ' +
      (step.pick + 1) + ' for ' + step.range);
    return;
  }

  var table = tables[step.pick];
  var tRows = table.getNumRows(), tCols = table.getNumColumns();

  // Validate before touching anything — a half-filled client table is worse than
  // an unfilled one, because it looks finished.
  if (tCols !== step.cols || tRows !== step.rows + 1) {
    skipped.push('slide ' + step.slide + ' table ' + step.pick + ' is ' + tRows + '×' + tCols +
      ', expected ' + (step.rows + 1) + '×' + step.cols + ' for ' + step.range +
      ' — deck and Config.gs row counts are out of step');
    return;
  }

  var wrote = 0;
  for (var r = 0; r < Math.min(body.length, tRows - 1); r++) {
    for (var c = 0; c < Math.min(body[r].length, tCols); c++) {
      var v = body[r][c];
      table.getCell(r + 1, c).getText().setText(v === null || v === undefined ? '' : String(v));
      wrote++;
    }
  }
  progress_('Slide ' + step.slide + ': filled ' + step.range + ' (' + wrote + ' cells).');
}

function namedDisplayValues_(name) {
  var range = SpreadsheetApp.getActiveSpreadsheet().getRangeByName(name);
  if (!range) return null;
  return range.getDisplayValues();
}

// ============================== COVER / FOOTERS ============================

function fillCover_(deck, ctx) {
  var p = ctx.periods.current;
  var fmt = function (ds) {
    var d = parseYmd_(ds);
    return d ? Utilities.formatDate(d, tz_(), 'MM/dd/yy') : ds;
  };

  // replaceAllText is deck-wide, which is what we want for the repeated tokens.
  var subs = [
    ['[Month YYYY]',              p.label],
    ['[MM/DD/YY – MM/DD/YY]',     fmt(p.start) + ' – ' + fmt(p.end)],
    ['[MM/DD/YY]',                Utilities.formatDate(new Date(), tz_(), 'MM/dd/yy')],
    ['[Next Month]',              monthPeriod_(addMonths_(p.month, 1)).label],
    ['[Account Team], Lockhern Digital', AGENCY_NAME],
  ];
  for (var i = 0; i < subs.length; i++) {
    try { deck.replaceAllText(subs[i][0], subs[i][1]); } catch (e) {}
  }
  progress_('Cover and footers: reporting period and dates set.');
}

// ============================== SLIDE 3 STAT CARDS =========================

/**
 * The four stat cards are separate text boxes holding '$—', '—x' or '—' with a
 * '— % MoM' box beneath each. There is no placeholder name to key off, so they
 * are matched by their placeholder TEXT and ordered LEFT TO RIGHT, which is the
 * order the deck lays them out: spend, revenue, ROAS, orders.
 */
function fillKpiCards_(slides, ctx, skipped) {
  if (slides.length < 3) { skipped.push('slide 3 is missing from the template'); return; }

  var vals = namedDisplayValues_('RPT_KPI');
  if (!vals || vals.length < 3) { skipped.push('RPT_KPI named range is missing'); return; }
  var values = vals[1].slice(1);   // row 1 = values, col 0 = 'Value' label
  var moms   = vals[2].slice(1);   // row 2 = % MoM

  var shapes = slides[2].getShapes();
  var valueBoxes = [], momBoxes = [];

  for (var i = 0; i < shapes.length; i++) {
    var text;
    try { text = shapes[i].getText().asString().trim(); } catch (e) { continue; }
    if (/^—\s*%\s*MoM$/.test(text))       momBoxes.push(shapes[i]);
    else if (/^(\$—|—x|—)$/.test(text))   valueBoxes.push(shapes[i]);
  }

  var byLeft = function (a, b) { return a.getLeft() - b.getLeft(); };
  valueBoxes.sort(byLeft);
  momBoxes.sort(byLeft);

  if (valueBoxes.length !== 4 || momBoxes.length !== 4) {
    skipped.push('slide 3: found ' + valueBoxes.length + ' value box(es) and ' + momBoxes.length +
      ' MoM box(es), expected 4 of each — the stat cards may already be filled from a previous run ' +
      'on this copy, or the template was edited');
    return;
  }

  for (var k = 0; k < 4; k++) {
    valueBoxes[k].getText().setText(values[k] === '' ? NA : String(values[k]));
    var m = String(moms[k] || '');
    momBoxes[k].getText().setText((m === '' || m === NA ? NA : m) + ' MoM');
  }
  progress_('Slide 3: four stat cards filled.');
}

// ============================== SLIDE 11 PRODUCT CARDS =====================

function fillProductCards_(slides, skipped) {
  if (slides.length < 11) { skipped.push('slide 11 is missing from the template'); return; }

  var vals = namedDisplayValues_('RPT_TOP_ITEMS');
  if (!vals) { skipped.push('RPT_TOP_ITEMS named range is missing'); return; }
  var body = vals.slice(1);   // [ title, item_id, orders, revenue, cost, roas ]

  var shapes = slides[10].getShapes();
  var names = [], orders = [], revenue = [];
  for (var i = 0; i < shapes.length; i++) {
    var text;
    try { text = shapes[i].getText().asString().trim(); } catch (e) { continue; }
    if (/^\[Product Name \d+\]$/.test(text)) names.push(shapes[i]);
    else if (/^Orders\s+—$/.test(text))      orders.push(shapes[i]);
    else if (/^Revenue\s+\$—$/.test(text))   revenue.push(shapes[i]);
  }

  var byLeft = function (a, b) { return a.getLeft() - b.getLeft(); };
  names.sort(byLeft); orders.sort(byLeft); revenue.sort(byLeft);

  var n = Math.min(names.length, TOP_ITEM_ROWS, body.length);
  if (!n) { skipped.push('slide 11: no product-name placeholders found'); return; }

  for (var k = 0; k < n; k++) {
    var row = body[k] || [];
    var title = String(row[0] || '').trim();
    names[k].getText().setText(title || '—');
    if (orders[k])  orders[k].getText().setText('Orders  ' + (row[2] === '' ? NA : row[2]));
    if (revenue[k]) revenue[k].getText().setText('Revenue  ' + (row[3] === '' ? NA : row[3]));
  }
  if (names.length > n) {
    skipped.push('slide 11: ' + (names.length - n) + ' product card(s) left as placeholders — ' +
      'fewer products had revenue than the deck has cards. Delete the extra cards.');
  }
  progress_('Slide 11: ' + n + ' product card(s) filled.');
}


// ==========================================================================
// SOURCE FILE: apps-script/Diagnostics.gs
// ==========================================================================

/**
 * Xero Shoes — Monthly Report  ·  DIAGNOSTICS
 * =============================================================================
 * Read-only inspections. Nothing here writes to the Report tab or the deck.
 *
 * The classification diagnostics are the ones worth running every month: they
 * answer "is the Search/Shopping/Brand split actually right this month, or did
 * someone rename a campaign?" before the numbers reach a client.
 */

function diagCheckSources() {
  var lines = [];

  try {
    var tw = readTripleWhale_();
    var chans = {};
    for (var i = 0; i < tw.rows.length; i++) {
      var c = tw.rows[i].channel;
      chans[c] = (chans[c] || 0) + 1;
    }
    lines.push('TRIPLE WHALE  (' + TW_STORE_SHEET + ' tab of ' + TW_SPREADSHEET_ID + ')');
    lines.push('  rows: ' + tw.rows.length + '   dates: ' + tw.minDate + ' → ' + tw.maxDate);
    lines.push('  channels: ' + Object.keys(chans).sort().map(function (k) {
      return k + ' (' + chans[k] + ')';
    }).join(', '));
    lines.push('  sessions column: ' + (tw.sessionsAvailable ? 'present' : 'ABSENT — TW Sessions reads n/a'));

    var unknownChans = Object.keys(chans).filter(function (k) {
      return !isAdsChannel_(k) && !isOpenAiChannel_(k);
    });
    if (unknownChans.length) {
      lines.push('  ⚠  channels present but NOT in TW_ADS_CHANNELS/TW_OPENAI_CHANNELS, so excluded ' +
        'from every table: ' + unknownChans.join(', '));
    }
  } catch (e) {
    lines.push('TRIPLE WHALE — ERROR: ' + e.message);
  }

  lines.push('');
  lines.push('GOOGLE ADS ENGINE TABS');
  var tabs = [ENGINE_DAY_SHEET, ENGINE_PRODUCT_SHEET, ENGINE_PMAXCAT_SHEET,
              ENGINE_ITEM_SHEET, ENGINE_ASSET_SHEET];
  for (var t = 0; t < tabs.length; t++) {
    var rows = readEngineTab_(tabs[t]);
    lines.push('  ' + tabs[t] + ': ' + (rows.length ? rows.length + ' rows' : 'empty / absent'));
  }

  lines.push('');
  lines.push('MANUAL INPUT TABS');
  lines.push('  ' + AUCTION_SHEET + ': ' + readEngineTab_(AUCTION_SHEET).length + ' rows');
  lines.push('  ' + PROMO_SHEET + ': ' + readEngineTab_(PROMO_SHEET).length + ' rows');

  tell_('Data sources', lines.join('\n'));
}

function diagCoverage() {
  var periods = resolvePeriods_();
  var tw = readTripleWhale_();
  var eng = readEngineDays_();

  var fmt = function (label, p, rows) {
    var n = rowsInPeriod_(rows, p).length;
    return '  ' + label + ' ' + p.month + ' (' + p.start + ' → ' + p.end + '): ' +
      (n ? n + ' rows' : 'NO DATA');
  };

  var lines = [
    'Reporting ' + periods.current.label + (REPORT_MONTH ? ' (pinned by REPORT_MONTH)' : ' (last complete month)'),
    '',
    'TRIPLE WHALE',
    fmt('current', periods.current, tw.rows),
    fmt('prior  ', periods.prior, tw.rows),
    fmt('YoY    ', periods.yoy, tw.rows),
    '',
    'GOOGLE ADS ENGINE',
    fmt('current', periods.current, eng.rows),
    fmt('prior  ', periods.prior, eng.rows),
    fmt('YoY    ', periods.yoy, eng.rows),
  ];

  var cov = coverage_(tw.rows, periods);
  if (!cov.yoy) {
    lines.push('');
    lines.push('The %YoY row will read n/a for Triple Whale columns. To fix properly, set ' +
      'BACKFILL_START = \'' + periods.yoy.start + '\' in the ld-x-tw-script project and run ' +
      '"Rebuild all data". Expect that to take a while — it is roughly ' +
      (daysBetween_(periods.yoy.start, todayStr_())) + ' days of history at one API call per day.');
  }

  tell_('Period coverage', lines.join('\n'));
}

function diagClassification() {
  var ctx = buildReportContext_();
  var rows = rowsInPeriod_(ctx.twAds, ctx.periods.current);

  var byTactic = {}, byBrand = {}, byGroup = {}, total = 0;
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i], s = num_(r.spend);
    total += s;
    byTactic[r.cls.tactic] = (byTactic[r.cls.tactic] || 0) + s;
    byBrand[r.cls.brand]   = (byBrand[r.cls.brand]   || 0) + s;
    byGroup[r.cls.deckGroup] = (byGroup[r.cls.deckGroup] || 0) + s;
  }

  var show = function (title, map) {
    var keys = Object.keys(map).sort(function (a, b) { return map[b] - map[a]; });
    return [title].concat(keys.map(function (k) {
      var pct = total ? (map[k] / total * 100).toFixed(1) + '%' : '—';
      return '  ' + k + ': ' + Math.round(map[k]).toLocaleString() + '  (' + pct + ')';
    })).join('\n');
  };

  tell_('Classification — ' + ctx.periods.current.label,
    'Share of ' + REGION + ' paid-search cost, ' + Math.round(total).toLocaleString() + ' total.\n\n' +
    show('BY DECK GROUP (drives slides 5–7)', byGroup) + '\n\n' +
    show('BY TACTIC', byTactic) + '\n\n' +
    show('BY BRAND', byBrand) + '\n\n' +
    'OTHER and UNKNOWN are excluded from the Search/Shopping tables but stay in the blended total — ' +
    'that is the gap the Reconciliation block reports. Pin them on the Campaign Map tab.');
}

function diagUnclassified() {
  var ctx = buildReportContext_();
  var rows = rowsInPeriod_(ctx.twAds, ctx.periods.current);

  var bad = {};
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (r.cls.deckGroup !== 'OTHER' && r.cls.brand !== 'UNKNOWN') continue;
    var k = r.channel + ' | ' + r.campaign;
    if (!bad[k]) bad[k] = { cost: 0, rev: 0, tactic: r.cls.tactic, brand: r.cls.brand };
    bad[k].cost += num_(r.spend);
    bad[k].rev  += num_(r.tw_revenue);
  }

  var keys = Object.keys(bad).sort(function (a, b) {
    return (bad[b].cost + bad[b].rev) - (bad[a].cost + bad[a].rev);
  });

  if (!keys.length) {
    tell_('Unclassified campaigns', 'None — every campaign this month landed in a Search or Shopping ' +
      'table with a brand assignment.');
    return;
  }

  var lines = keys.map(function (k) {
    return '· ' + k + '\n    tactic=' + bad[k].tactic + '  brand=' + bad[k].brand +
      '   cost=' + Math.round(bad[k].cost).toLocaleString() +
      '   TW revenue=' + Math.round(bad[k].rev).toLocaleString();
  });

  tell_('Unclassified campaigns — ' + ctx.periods.current.label,
    keys.length + ' campaign(s) are excluded from the Search/Shopping tables:\n\n' +
    lines.join('\n') + '\n\n' +
    'Zero-cost rows carrying revenue are normal: they are Triple Whale attributing late orders to ' +
    'campaigns that have since been renamed or paused. Pin the ones that matter on the "' + MAP_SHEET +
    '" tab using the override columns.');
}

function diagValidateDeck() {
  if (!DECK_TEMPLATE_ID) { tell_('Deck template', 'DECK_TEMPLATE_ID is not set in Config.gs.'); return; }

  var deck;
  try { deck = SlidesApp.openById(DECK_TEMPLATE_ID); }
  catch (e) { tell_('Deck template — ERROR', 'Cannot open ' + DECK_TEMPLATE_ID + ' as Google Slides. ' +
    'An uploaded .pptx must be converted first (File → Save as Google Slides). ' + e.message); return; }

  var slides = deck.getSlides();
  var lines = ['"' + deck.getName() + '" — ' + slides.length + ' slides.', ''];
  var plan = slidePlan_();
  var problems = 0;

  for (var i = 0; i < plan.length; i++) {
    var step = plan[i];
    if (step.slide > slides.length) {
      lines.push('✗ slide ' + step.slide + ' (' + step.range + '): slide does not exist');
      problems++;
      continue;
    }
    var tables = slides[step.slide - 1].getTables().slice().sort(function (a, b) { return a.getTop() - b.getTop(); });
    if (tables.length <= step.pick) {
      lines.push('✗ slide ' + step.slide + ' (' + step.range + '): needs table #' + (step.pick + 1) +
        ', found ' + tables.length);
      problems++;
      continue;
    }
    var tb = tables[step.pick];
    var got = tb.getNumRows() + '×' + tb.getNumColumns();
    var want = (step.rows + 1) + '×' + step.cols;
    var ok = got === want;
    if (!ok) problems++;
    lines.push((ok ? '✓' : '✗') + ' slide ' + step.slide + ' table #' + (step.pick + 1) + ' → ' +
      step.range + ': ' + got + (ok ? '' : '  (expected ' + want + ')'));
  }

  tell_(problems ? 'Deck template — ' + problems + ' mismatch(es)' : 'Deck template — all tables match',
    lines.join('\n') + (problems ? '\n\nMismatched tables are SKIPPED at build time rather than ' +
      'half-filled. Either fix the deck table, or adjust PRODUCT_ROWS / PMAX_CAT_ROWS / PROMO_ROWS ' +
      'in Config.gs to match it.' : ''));
}

function diagNamedRanges() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ranges = ss.getNamedRanges().filter(function (r) { return r.getName().indexOf('RPT_') === 0; });
  if (!ranges.length) { tell_('Named ranges', 'None yet — run "Build report" first.'); return; }

  var lines = ranges.map(function (r) {
    var rg = r.getRange();
    return '· ' + r.getName() + '  →  ' + rg.getSheet().getName() + '!' + rg.getA1Notation() +
      '  (' + rg.getNumRows() + '×' + rg.getNumColumns() + ')';
  }).sort();

  tell_('Report tab named ranges', ranges.length + ' block(s):\n\n' + lines.join('\n') +
    '\n\nThese are what the Slides writer reads, and what you can paste or link into the deck by hand.');
}


// ==========================================================================
// SOURCE FILE: apps-script/SelfTest.gs
// ==========================================================================

/**
 * Xero Shoes — Monthly Report  ·  SELF-TEST
 * =============================================================================
 * Asserts the report's invariants against a report that has just been built.
 *
 * These are the checks worth running before a deck reaches a client, and they run
 * in TWO places from this one file:
 *
 *   · live, from the menu — Diagnostics → Run self-test
 *   · locally, with no Google account at all — tools/harness.js
 *
 * One definition of "correct" for both. If you add an invariant, add it here.
 *
 * The most valuable check is C: it reads the values the Report tab actually
 * WROTE and re-derives the %MoM row from the two rows above it. That exercises
 * the whole path — ingest, classify, sum, derive, format, write — rather than
 * re-running the same functions and agreeing with itself.
 */

// Ratio comparisons are done to a relative tolerance: these are sums of
// thousands of floats, so exact equality is the wrong test.
var SELFTEST_TOL = 1e-6;

function runSelfTest() {
  var report = selfTestReport_();
  tell_(report.failed ? 'Self-test — ' + report.failed + ' FAILED' : 'Self-test — all ' + report.passed + ' passed',
    report.lines.join('\n'));
}

/**
 * Run every invariant. Assumes buildReport() has already run in this session, and
 * rebuilds the context so the checks compare written output against a fresh
 * computation rather than against cached intermediates.
 */
function selfTestReport_() {
  var t = newAsserter_();
  var ctx = buildReportContext_();

  checkDeckContract_(t);
  checkShapes_(t);
  checkSpine_(t, ctx);
  checkPartitions_(t, ctx);
  checkWrittenDeltas_(t);
  checkDerivedRatios_(t, ctx);
  checkRatiosHaveComponents_(t, ctx);
  checkCampaignMap_(t);
  reportCoverage_(t, ctx);

  var lines = t.lines.slice();
  lines.push('');
  lines.push(t.failed
    ? '✗ ' + t.failed + ' failed, ' + t.passed + ' passed. Do not ship the deck until these are ' +
      'understood — each failure names the block involved.'
    : '✓ all ' + t.passed + ' invariants hold.');

  return { passed: t.passed, failed: t.failed, lines: lines };
}

function newAsserter_() {
  return {
    passed: 0, failed: 0, lines: [],
    ok: function (name, cond, detail) {
      if (cond) { this.passed++; this.lines.push('  ✓ ' + name); }
      else { this.failed++; this.lines.push('  ✗ ' + name + (detail ? '  →  ' + detail : '')); }
    },
    near: function (name, a, b, detail) {
      // Relative comparison, with an absolute floor so 0-vs-0 passes and a cent
      // of float residue on a six-figure sum doesn't fail.
      var scale = Math.max(Math.abs(num_(a)), Math.abs(num_(b)), 1);
      var diff = Math.abs(num_(a) - num_(b));
      this.ok(name, diff / scale < SELFTEST_TOL || diff < 0.01,
        detail || (fmtNum_(a) + ' vs ' + fmtNum_(b) + '  (Δ ' + fmtNum_(diff) + ')'));
    },
    note: function (text) { this.lines.push('    ' + text); },
    section: function (title) { this.lines.push((this.lines.length ? '\n' : '') + title); },
  };
}

function fmtNum_(v) {
  if (v === null || v === undefined) return 'n/a';
  var n = Number(v);
  if (!isFinite(n)) return String(v);
  return Math.abs(n) >= 1000 ? Math.round(n).toLocaleString() : String(Math.round(n * 10000) / 10000);
}

// ============================== G · DECK CONTRACT ==========================

/**
 * Ground truth, measured from template/Xero_Shoes_Monthly_Reporting_Framework.pptx.
 * `rows` EXCLUDES the deck table's own header row.
 *
 * These literals exist because checking a named range against `slidePlan_()` is
 * partly self-referential: both are built from the `*_ROWS` constants in
 * Config.gs, so changing a constant moves both sides and the check still passes
 * while the real deck table stays the size it always was.
 */
function deckTruth_() {
  return {
    RPT_BLENDED:         { slide: 4,  rows: 4,  cols: 15 },
    RPT_SEARCH:          { slide: 5,  rows: 4,  cols: 15 },
    RPT_SHOPPING:        { slide: 5,  rows: 4,  cols: 15 },
    RPT_SEARCH_BRAND:    { slide: 6,  rows: 4,  cols: 15 },
    RPT_SEARCH_NONBRAND: { slide: 6,  rows: 4,  cols: 15 },
    RPT_SHOP_BRAND:      { slide: 7,  rows: 4,  cols: 15 },
    RPT_SHOP_NONBRAND:   { slide: 7,  rows: 4,  cols: 15 },
    RPT_PRODUCT:         { slide: 8,  rows: 16, cols: 9  },
    RPT_PMAX_CAT:        { slide: 10, rows: 16, cols: 8  },
    RPT_PROMO_ASSETS:    { slide: 12, rows: 4,  cols: 5  },
    RPT_CHATGPT:         { slide: 13, rows: 4,  cols: 12 },
  };
}

/**
 * Pin the semantics that arithmetic checks cannot see.
 *
 * Check B verifies the segments PARTITION the total — but a partition stays a
 * valid partition if you move Performance Max from Shopping into Search. Every
 * identity would still hold while six figures of spend silently swapped slides.
 * These assertions are the ones that catch that class of drift.
 */
function checkDeckContract_(t) {
  t.section('G · Config matches the deck\'s definitions');

  // The framework deck, slide 5 footnote: "Search = text campaigns. Shopping =
  // Standard Shopping + PMax retail."
  t.ok('PMAX rolls up to the Shopping tables', DECK_GROUP_OF_TACTIC.PMAX === 'SHOPPING',
    'is ' + DECK_GROUP_OF_TACTIC.PMAX);
  t.ok('SHOPPING rolls up to the Shopping tables', DECK_GROUP_OF_TACTIC.SHOPPING === 'SHOPPING',
    'is ' + DECK_GROUP_OF_TACTIC.SHOPPING);
  t.ok('SEARCH rolls up to the Search tables', DECK_GROUP_OF_TACTIC.SEARCH === 'SEARCH',
    'is ' + DECK_GROUP_OF_TACTIC.SEARCH);
  t.ok('DSA rolls up to the Search tables', DECK_GROUP_OF_TACTIC.DSA === 'SEARCH',
    'is ' + DECK_GROUP_OF_TACTIC.DSA);
  t.ok('DEMAND_GEN belongs to neither tactic table', DECK_GROUP_OF_TACTIC.DEMAND_GEN === 'OTHER',
    'is ' + DECK_GROUP_OF_TACTIC.DEMAND_GEN);

  var unmapped = [];
  for (var i = 0; i < VALID_TACTICS.length; i++) {
    if (!DECK_GROUP_OF_TACTIC[VALID_TACTICS[i]]) unmapped.push(VALID_TACTICS[i]);
  }
  t.ok('every valid tactic has a deck group', unmapped.length === 0, unmapped.join(', '));

  // Conquesting is non-brand spend. Excluding it would leave slides 6-7 not
  // summing to slide 5, which check B would then report as an unassigned gap.
  t.ok('the deck\'s Non-Brand includes COMPETITOR', isDeckNonBrand_('COMPETITOR'));
  t.ok('the deck\'s Non-Brand includes NON_BRAND', isDeckNonBrand_('NON_BRAND'));
  t.ok('the deck\'s Non-Brand excludes BRAND', !isDeckNonBrand_('BRAND'));
  t.ok('UNKNOWN is in neither brand table', !isDeckNonBrand_('UNKNOWN') && !isDeckBrand_('UNKNOWN'));

  // Column counts: +1 for the leading Month column the deck tables carry.
  t.ok('the main table has 15 columns', tableColumns_().length + 1 === 15,
    'has ' + (tableColumns_().length + 1));
  t.ok('the ChatGPT table has 12 columns', chatgptColumns_().length + 1 === 12,
    'has ' + (chatgptColumns_().length + 1));

  // Row-count constants against the deck's real table heights.
  var truth = deckTruth_();
  t.ok('PRODUCT_ROWS matches slide 8 (16)', PRODUCT_ROWS === truth.RPT_PRODUCT.rows,
    'is ' + PRODUCT_ROWS);
  t.ok('PMAX_CAT_ROWS matches slide 10 (16)', PMAX_CAT_ROWS === truth.RPT_PMAX_CAT.rows,
    'is ' + PMAX_CAT_ROWS);
  t.ok('PROMO_ROWS + total row matches slide 12 (4)', PROMO_ROWS + 1 === truth.RPT_PROMO_ASSETS.rows,
    'is ' + (PROMO_ROWS + 1));

  // Every block the writer maps must be in the deck-truth table, and vice versa.
  var plan = slidePlan_(), planned = {};
  for (var p = 0; p < plan.length; p++) {
    planned[plan[p].range] = true;
    t.ok(plan[p].range + ' is a known deck table', !!truth[plan[p].range],
      'not in deckTruth_() — add it, or the shape check cannot validate it');
  }
  var unplanned = Object.keys(truth).filter(function (k) { return !planned[k]; });
  t.ok('every deck table is mapped by slidePlan_', unplanned.length === 0, unplanned.join(', '));
}

// ============================== H · SPINE / SOURCE COMBINATION =============

/**
 * The engine is the spine; Triple Whale is the overlay. These assertions pin that
 * relationship, because getting it wrong is silent: every table still renders and
 * every table is still internally consistent.
 *
 * The dangerous case is a per-channel mismatch — engine cost for Google only,
 * divided into Triple Whale revenue that includes Microsoft. That inflates ROAS
 * on the headline slide with nothing visibly wrong.
 */
function checkSpine_(t, ctx) {
  t.section('H · Engine spine and Triple Whale overlay');

  var bag = ctx.segments.blended.current;

  // Front end must come from the engine once the backfill has run.
  if (ctx.engCoverage.current) {
    t.ok('current month front end comes from the engine',
      bag._frontSource === 'engine' || bag._frontSource === 'mixed',
      'is "' + bag._frontSource + '"');
  } else {
    t.note('no engine data for the report month — front end falls back to Triple Whale, ' +
      'which is the documented degraded mode');
  }

  // Both sources should describe the same program — but only where BOTH cover the
  // channel. Comparing totals would report a large false "drift" whenever the
  // engine feed covers fewer channels than Triple Whale, which is the normal
  // state before a Microsoft feed exists.
  var engSpend = ctx.channelCoverage.currentEngSpend || {};
  var twSpend  = ctx.channelCoverage.currentTwSpend  || {};
  var overlapping = Object.keys(engSpend).filter(function (ch) { return twSpend[ch] !== undefined; });

  if (!overlapping.length) {
    t.note('no channel is covered by both sources this month, so there is nothing to cross-check');
  } else {
    overlapping.forEach(function (ch) {
      var e = num_(engSpend[ch]), w = num_(twSpend[ch]);
      if (w <= 0) return;
      var drift = Math.abs(e - w) / w;
      t.ok(ch + ': engine cost within 5% of Triple Whale spend', drift < 0.05,
        fmtNum_(e) + ' vs ' + fmtNum_(w) + '  (' + (drift * 100).toFixed(1) + '%)');
    });
  }

  // Blended cost must equal engine cost for engine-covered channels plus Triple
  // Whale spend for the rest. This is the identity that guarantees the ROAS
  // denominator describes the same spend as its numerator.
  var expected = 0;
  Object.keys(twSpend).forEach(function (ch) {
    expected += (engSpend[ch] !== undefined) ? num_(engSpend[ch]) : num_(twSpend[ch]);
  });
  Object.keys(engSpend).forEach(function (ch) {
    if (twSpend[ch] === undefined) expected += num_(engSpend[ch]);
  });
  t.near('blended cost = engine cost where covered + Triple Whale spend elsewhere',
    derive_(bag).cost, expected);

  // Attributed columns must be n/a, never 0, in periods Triple Whale misses.
  ['prior', 'yoy'].forEach(function (p) {
    if (ctx.twCoverage[p]) return;
    var d = derive_(ctx.segments.blended[p]);
    t.ok(p + ': TW Revenue is n/a (no Triple Whale data)', d.tw_revenue === null,
      'got ' + fmtNum_(d.tw_revenue));
    if (ctx.engCoverage[p]) {
      t.ok(p + ': Cost is still real (engine covers it)', d.cost !== null && num_(d.cost) > 0,
        'got ' + fmtNum_(d.cost));
    }
  });

  // Per-channel combination: a channel the engine misses must not have its cost
  // dropped while its Triple Whale revenue is kept.
  var cov = ctx.channelCoverage;
  ['current', 'prior', 'yoy'].forEach(function (p) {
    var eng = cov[p].engine, tw = cov[p].triplewhale;
    var twOnly = tw.filter(function (c) { return eng.indexOf(c) === -1; });
    if (!twOnly.length) return;
    t.note(p + ': ' + twOnly.join(', ') + ' present in Triple Whale but not the engine — ' +
      'those channels use Triple Whale for their front end too, so cost and revenue still ' +
      'describe the same spend');
  });
}

// ============================== A · SHAPES =================================

/**
 * Every mapped block must exist at exactly the DECK's shape.
 *
 * Compared against `deckTruth_()`, not `slidePlan_()`, so a wrong `*_ROWS`
 * constant fails here instead of moving both sides of the comparison at once.
 */
function checkShapes_(t) {
  t.section('A · Named range shapes match the deck tables');
  var truth = deckTruth_();
  var plan = slidePlan_();

  for (var i = 0; i < plan.length; i++) {
    var s = plan[i];
    var expect = truth[s.range];
    if (!expect) continue;                       // already reported by check G

    var r = SpreadsheetApp.getActiveSpreadsheet().getRangeByName(s.range);
    if (!r) { t.ok(s.range + ' exists', false, 'missing — run Build report first'); continue; }

    var got = r.getNumRows() + '×' + r.getNumColumns();
    var want = (expect.rows + 1) + '×' + expect.cols;
    t.ok('slide ' + expect.slide + ' ' + s.range + ' is ' + want, got === want, 'got ' + got);

    // The writer's own expectation must agree with the deck, or it will refuse to
    // fill the table at build time.
    t.ok(s.range + ': slidePlan_ agrees with the deck',
      s.rows === expect.rows && s.cols === expect.cols,
      'plan says ' + (s.rows + 1) + '×' + s.cols);
  }
}

// ============================== B · PARTITIONS =============================

/**
 * The segments must PARTITION the blended total — every dollar in exactly one
 * bucket. This is what makes the Reconciliation block trustworthy: if these
 * identities hold, the only reason parts don't sum to the whole is the
 * unclassified bucket, which is reported.
 */
function checkPartitions_(t, ctx) {
  t.section('B · Segments partition the blended total');
  var periods = ['current', 'prior'];

  // Checked against the COMBINED bags the tables are actually built from, so the
  // identities hold whichever source supplied the front end.
  // SEARCH / SHOPPING / OTHER is an exhaustive partition of the tactic axis, so
  // the three must sum to blended EXACTLY on the combined bags the tables are
  // built from — no residual gap term.
  //
  // This is the check that catches a front-end source chosen per segment instead
  // of per channel: a campaign present in Triple Whale but not the engine would
  // then be counted in a narrow segment and excluded from blended, and this sum
  // would not close.
  ['current', 'prior', 'yoy'].forEach(function (pk) {
    var b = derive_(ctx.segments.blended[pk]);
    if (b.cost === null) { t.note(pk + ': no cost from either source, partition skipped'); return; }
    ['cost', 'impressions', 'clicks', 'eng_orders', 'eng_revenue', 'tw_revenue', 'tw_orders'].forEach(function (metric) {
      var parts = ['search', 'shopping', 'other'].reduce(function (acc, seg) {
        return acc + num_(derive_(ctx.segments[seg][pk])[metric]);
      }, 0);
      t.near(pk + ': Search + Shopping + Other = Blended ' + metric, parts, num_(b[metric]));
    });
  });

  for (var p = 0; p < periods.length; p++) {
    var per = periods[p];
    if (!ctx.twCoverage[per]) { t.note(per + ': no Triple Whale data, row-level partition checks skipped'); continue; }

    var rows = rowsInPeriod_(ctx.twAds, ctx.periods[per]);
    var total = 0, byGroup = { SEARCH: 0, SHOPPING: 0, OTHER: 0 };
    var searchByBrand = { BRAND: 0, OTHER: 0 }, shopByBrand = { BRAND: 0, OTHER: 0 };

    for (var i = 0; i < rows.length; i++) {
      var r = rows[i], c = num_(r.spend);
      total += c;
      var g = r.cls.deckGroup;
      byGroup[g] = (byGroup[g] || 0) + c;
      var bucket = isDeckBrand_(r.cls.brand) ? 'BRAND' : (isDeckNonBrand_(r.cls.brand) ? 'NON_BRAND' : 'OTHER');
      if (g === 'SEARCH')   searchByBrand[bucket] = (searchByBrand[bucket] || 0) + c;
      if (g === 'SHOPPING') shopByBrand[bucket]   = (shopByBrand[bucket]   || 0) + c;
    }

    t.near(per + ': Search + Shopping + Other = Blended cost',
      byGroup.SEARCH + byGroup.SHOPPING + byGroup.OTHER, total);
    t.near(per + ': Search Brand + Non-Brand + unassigned = Search cost',
      (searchByBrand.BRAND || 0) + (searchByBrand.NON_BRAND || 0) + (searchByBrand.OTHER || 0), byGroup.SEARCH);
    t.near(per + ': Shopping Brand + Non-Brand + unassigned = Shopping cost',
      (shopByBrand.BRAND || 0) + (shopByBrand.NON_BRAND || 0) + (shopByBrand.OTHER || 0), byGroup.SHOPPING);

    // Not an error, but the number an analyst must see before shipping.
    var unassigned = (searchByBrand.OTHER || 0) + (shopByBrand.OTHER || 0);
    if (unassigned > 0.01) {
      t.note(per + ': ⚠ ' + fmtNum_(unassigned) + ' of cost is in a tactic table but has NO brand ' +
        'assignment — slides 6–7 under-report slide 5 by that much. Pin it on the ' + MAP_SHEET + ' tab.');
    }
  }
}

// ============================== C · WRITTEN DELTAS =========================

/**
 * Re-derive the %MoM row from the two value rows sitting directly above it, using
 * only what the Report tab actually WROTE.
 *
 * This is the end-to-end check. It would catch a column-order slip, an off-by-one
 * in the block writer, or a formatting path that mangles a value — none of which
 * a check that re-calls derive_() could see.
 */
function checkWrittenDeltas_(t) {
  t.section('C · The written %MoM row re-derives from the written values');
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var blocks = ['RPT_BLENDED', 'RPT_SEARCH', 'RPT_SHOPPING', 'RPT_SEARCH_BRAND',
                'RPT_SEARCH_NONBRAND', 'RPT_SHOP_BRAND', 'RPT_SHOP_NONBRAND', 'RPT_CHATGPT'];

  for (var b = 0; b < blocks.length; b++) {
    var range = ss.getRangeByName(blocks[b]);
    if (!range) { t.ok(blocks[b] + ' present', false, 'missing'); continue; }

    var v = range.getValues();          // [header, current, prior, %MoM, %YoY]
    if (v.length < 4) { t.ok(blocks[b] + ' has 4 data rows', false, 'has ' + (v.length - 1)); continue; }

    var mismatches = [], compared = 0;
    for (var c = 1; c < v[0].length; c++) {
      var cur = v[1][c], pri = v[2][c], mom = v[3][c];
      // Only check cells where all three are real numbers; NA is a valid outcome
      // and is covered by check E.
      if (typeof cur !== 'number' || typeof pri !== 'number' || typeof mom !== 'number') continue;
      if (pri === 0) continue;
      compared++;
      var expect = (cur - pri) / Math.abs(pri);
      if (Math.abs(expect - mom) > 1e-6) {
        mismatches.push(String(v[0][c]) + ': wrote ' + fmtNum_(mom) + ', expected ' + fmtNum_(expect));
      }
    }
    t.ok(blocks[b] + ': ' + compared + ' %MoM cell(s) re-derive correctly',
      mismatches.length === 0, mismatches.slice(0, 3).join('; '));
  }
}

// ============================== D · DERIVED RATIOS =========================

/** Ratios must equal their components' quotient — no stale or averaged values. */
function checkDerivedRatios_(t, ctx) {
  t.section('D · Ratios equal their components');
  if (!ctx.twCoverage.current) { t.note('no current-month data, skipped'); return; }

  var checks = [
    ['blended', 'Blended'], ['search', 'Search'], ['shopping', 'Shopping'],
    ['searchBrand', 'Search·Brand'], ['shopNonBrand', 'Shopping·Non-Brand'],
  ];

  for (var i = 0; i < checks.length; i++) {
    var bag = ctx.segments[checks[i][0]].current;
    var m = derive_(bag), label = checks[i][1];
    if (!bag._rows) { t.note(label + ': empty segment, skipped'); continue; }

    t.near(label + ' CTR = clicks ÷ impressions', m.ctr, bag.clicks / bag.impressions);
    t.near(label + ' CPC = spend ÷ clicks', m.cpc, bag.spend / bag.clicks);
    t.near(label + ' TW ROAS = revenue ÷ spend', m.tw_roas, bag.tw_revenue / bag.spend);
    t.near(label + ' TW AOV = revenue ÷ orders', m.tw_aov, bag.tw_revenue / bag.tw_orders);
    t.near(label + ' Engine ROAS = conv value ÷ spend', m.eng_roas, bag.eng_conv_value / bag.spend);
  }

  // Impression share must be a share, and must be volume-weighted rather than a
  // mean of daily percentages.
  if (ctx.engRows.length) {
    var brandSearch = [];
    for (var j = 0; j < ctx.engRows.length; j++) {
      var r = ctx.engRows[j];
      if (r.date < ctx.periods.current.start || r.date > ctx.periods.current.end) continue;
      if (isDeckBrand_(r.cls.brand) && r.cls.deckGroup === 'SEARCH') brandSearch.push(r);
    }
    if (brandSearch.length) {
      var isBag = sumComponents_(brandSearch);
      var share = derive_(isBag).is_share;
      t.ok('Brand impression share is within (0, 1]', share === null || (share > 0 && share <= 1.0000001),
        'got ' + fmtNum_(share));
      t.near('Brand impression share = Σ impr ÷ Σ eligible impr', share, isBag.is_impr / isBag.is_eligible);
    }
  }
}

// ============================== E · N/A DISCIPLINE =========================

/**
 * A ratio must be n/a whenever its denominator is absent — never 0.
 *
 * The important case: a period covered by Google Ads but NOT by Triple Whale.
 * If that reported 0 attributed revenue instead of n/a, %YoY would claim revenue
 * grew infinitely off a zero base.
 */
function checkRatiosHaveComponents_(t, ctx) {
  t.section('E · Missing data reads n/a, never 0');

  var empty = derive_(emptyComponents_());
  var cols = tableColumns_();
  var zeros = [];
  for (var i = 0; i < cols.length; i++) {
    if (empty[cols[i][1]] !== null) zeros.push(cols[i][0] + '=' + empty[cols[i][1]]);
  }
  t.ok('an empty segment derives every column as n/a', zeros.length === 0, zeros.join(', '));

  // Engine-only bag: Triple Whale columns must be n/a, engine columns must be real.
  var engOnly = sumComponents_([{
    src: 'eng', spend: 100, impressions: 1000, clicks: 50,
    eng_conv: 5, eng_conv_value: 500,
    tw_orders: 0, tw_revenue: 0, tw_nc_orders: 0, tw_nc_revenue: 0,
    sessions: null, is_impr: 0, is_eligible: 0,
  }]);
  var e = derive_(engOnly);
  t.ok('engine-only period: TW Revenue is n/a', e.tw_revenue === null, 'got ' + fmtNum_(e.tw_revenue));
  t.ok('engine-only period: TW ROAS is n/a', e.tw_roas === null, 'got ' + fmtNum_(e.tw_roas));
  t.ok('engine-only period: TW CVR is n/a', e.tw_cvr === null, 'got ' + fmtNum_(e.tw_cvr));
  t.near('engine-only period: Engine ROAS is still real', e.eng_roas, 5);

  t.ok('pctChange_ off a zero base is n/a', pctChange_(10, 0) === null);
  t.ok('pctChange_ off a missing base is n/a', pctChange_(10, null) === null);
  t.near('pctChange_ computes a normal delta', pctChange_(110, 100), 0.1);

  // Sessions must not be invented from a column of blanks.
  if (!TW_SESSION_FIELD) {
    var cur = derive_(ctx.segments.blended.current);
    t.ok('TW Sessions is n/a while TW_SESSION_FIELD is unset', cur.sessions === null,
      'got ' + fmtNum_(cur.sessions));
  }
}

// ============================== F · CAMPAIGN MAP ===========================

function checkCampaignMap_(t) {
  t.section('F · Campaign Map integrity');
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MAP_SHEET);
  if (!sheet || sheet.getLastRow() < 2) { t.ok(MAP_SHEET + ' populated', false, 'empty — run Build report'); return; }

  var vals = sheet.getRange(2, 1, sheet.getLastRow() - 1, MAP_HEADER.length).getValues();
  var seen = {}, dupes = [], badTactic = [], badBrand = [];
  for (var i = 0; i < vals.length; i++) {
    var key = classKey_(vals[i][0], vals[i][1]);
    if (seen[key]) dupes.push(key); else seen[key] = true;
    if (VALID_TACTICS.indexOf(String(vals[i][6])) === -1) badTactic.push('row ' + (i + 2) + ': ' + vals[i][6]);
    if (VALID_BRANDS.indexOf(String(vals[i][7])) === -1) badBrand.push('row ' + (i + 2) + ': ' + vals[i][7]);
  }

  t.ok('no duplicate channel+campaign rows', dupes.length === 0, dupes.slice(0, 3).join(', '));
  t.ok('every Effective Tactic is a valid value', badTactic.length === 0, badTactic.slice(0, 3).join(', '));
  t.ok('every Effective Brand is a valid value', badBrand.length === 0, badBrand.slice(0, 3).join(', '));
}

// ============================== COVERAGE SUMMARY ===========================

/** Not assertions — the context an analyst needs to read the results. */
function reportCoverage_(t, ctx) {
  t.section('Coverage (context, not assertions)');
  var p = ctx.periods;
  t.note('report month  ' + p.current.label + ': Triple Whale ' + (ctx.twCoverage.current ? 'yes' : 'NO') +
    ', engine ' + (ctx.engCoverage.current ? 'yes' : 'no'));
  t.note('prior month   ' + p.prior.label + ': Triple Whale ' + (ctx.twCoverage.prior ? 'yes' : 'NO') +
    ', engine ' + (ctx.engCoverage.prior ? 'yes' : 'no'));
  t.note('YoY month     ' + p.yoy.label + ': Triple Whale ' + (ctx.twCoverage.yoy ? 'yes' : 'NO') +
    ', engine ' + (ctx.engCoverage.yoy ? 'yes' : 'no'));
  for (var i = 0; i < ctx.warnings.length; i++) t.note('⚠ ' + ctx.warnings[i]);
}


// ==========================================================================
// SOURCE FILE: apps-script/Code.gs
// ==========================================================================

/**
 * Xero Shoes — Monthly Report
 * =============================================================================
 * Assembles the monthly paid-media review deck from two sources:
 *
 *   Triple Whale  — the `_store` tab of the ld-x-tw-script spreadsheet. Spend,
 *                   impressions, clicks, engine-reported conversions and value,
 *                   and pixel-attributed orders and revenue, per day per
 *                   campaign. This alone drives slides 3–7 and 13.
 *
 *   Google Ads    — `_eng_*` tabs written by an MCC-level Google Ads Script
 *                   (google-ads-script/engine-report.js). Adds the product
 *                   taxonomy, PMax search categories, item-level revenue,
 *                   sitelink assets and impression share that slides 8–12 need,
 *                   plus engine history predating the Triple Whale backfill.
 *
 * The pipeline is: read → classify → sum components → derive ratios → Report tab
 * → Slides deck. Every ratio is derived from summed components at render time,
 * never averaged, so no two blocks can disagree.
 *
 * SETUP: docs/SETUP.md.  Fill in Config.gs, then run Setup → First-run check.
 *
 * Lockhern Digital — internal reporting tool.
 */

// ============================== MENU =======================================

function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('Monthly Report')
    .addItem('Build report (Report tab only)', 'buildReport')
    .addItem('Build report + generate deck', 'buildDeck')
    .addSeparator()
    .addItem('Report a specific month…', 'buildForMonthPrompt')
    .addSeparator()
    .addSubMenu(ui.createMenu('Setup')
      .addItem('First-run check (verify config + sources)', 'firstRunCheck')
      .addItem('Create the manual input tabs', 'createInputTabs'))
    .addSubMenu(ui.createMenu('Automation')
      .addItem('Set up / repair monthly run', 'setupAutomation')
      .addItem('Automation status', 'automationStatus')
      .addItem('Remove all automation', 'removeAllAutomation'))
    .addSubMenu(ui.createMenu('Diagnostics')
      .addItem('Check data sources', 'diagCheckSources')
      .addItem('Show period coverage', 'diagCoverage')
      .addItem('Show classification summary', 'diagClassification')
      .addItem('List unclassified campaigns', 'diagUnclassified')
      .addItem('Validate the deck template', 'diagValidateDeck')
      .addItem('List Report tab named ranges', 'diagNamedRanges')
      .addSeparator()
      .addItem('Run self-test', 'runSelfTest'))
    .addToUi();
}

// ============================== ORCHESTRATION ==============================

/**
 * The scheduled entry point. Runs on the 3rd of the month so the Triple Whale
 * sheet has had two daily syncs to settle the prior month, and generates the
 * deck if a template is configured.
 */
function monthlyRun() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) { progress_('Monthly run: another run holds the lock — skipping.'); return; }
  try {
    ensureInputTabs_();
    if (DECK_TEMPLATE_ID) {
      var url = buildDeck_headless_();
      progress_('Monthly run complete. Deck: ' + url);
    } else {
      buildReport();
      progress_('Monthly run complete (Report tab only — DECK_TEMPLATE_ID is not set).');
    }
  } catch (e) {
    progress_('Monthly run FAILED: ' + e.message);
    throw e;                      // let Apps Script send its failure notification
  } finally {
    lock.releaseLock();
  }
}

/** buildDeck without the UI alert, for trigger use. */
function buildDeck_headless_() {
  var ctx = buildReportContext_();
  renderReportTab_(ctx);
  renderCampaignMap_(ctx.mapRows, ctx.classify);
  return writeDeck_(ctx);
}

/** Build for an arbitrary month without editing Config.gs. */
function buildForMonthPrompt() {
  var answer = ask_('Report a specific month',
    'Enter the month as yyyy-MM (e.g. 2026-07).\n\n' +
    'This affects THIS RUN ONLY — Config.gs is not modified. Leave blank to use ' +
    (REPORT_MONTH || 'the last complete month') + '.');
  if (answer === null) return;

  var saved = REPORT_MONTH;
  try {
    if (answer) {
      if (!/^\d{4}-\d{2}$/.test(answer)) { tell_('Not a valid month', 'Expected yyyy-MM, got "' + answer + '".'); return; }
      REPORT_MONTH = answer;
    }
    if (DECK_TEMPLATE_ID) {
      var url = buildDeck_headless_();
      tell_('Deck ready', url);
    } else {
      buildReport();
      tell_('Report built', 'DECK_TEMPLATE_ID is not set in Config.gs, so no deck was generated.');
    }
  } finally {
    REPORT_MONTH = saved;
  }
}

function createInputTabs() {
  ensureInputTabs_();
  tell_('Input tabs ready',
    'Created (or confirmed) two hand-fed tabs:\n\n' +
    '· "' + AUCTION_SHEET + '" — paste your Auction Insights export here. No Google API exposes ' +
    'this data, so slide 9\'s competitor block cannot be automated.\n\n' +
    '· "' + PROMO_SHEET + '" — list promo windows (name, start, end). Slide 12 measures any promo ' +
    'overlapping the report month.');
}

// ============================== FIRST-RUN CHECK ============================

/**
 * Verifies everything that has to be true before a first build, and says exactly
 * what to fix. Cheap to run, and the fastest way to diagnose a broken setup.
 */
function firstRunCheck() {
  var problems = [], notes = [];

  if (!TW_SPREADSHEET_ID) {
    problems.push('Config.gs: TW_SPREADSHEET_ID is empty. Paste the ID of the Triple Whale ' +
      'reporting spreadsheet (from its URL, between /d/ and /edit).');
  } else {
    try {
      var tw = readTripleWhale_();
      notes.push('Triple Whale: ' + tw.rows.length + ' rows, ' + tw.minDate + ' → ' + tw.maxDate + '.');
      var periods = resolvePeriods_();
      var cov = coverage_(tw.rows, periods);
      notes.push('Coverage — ' + periods.current.shortLabel + ': ' + (cov.current ? 'yes' : 'NO') +
        ',  ' + periods.prior.shortLabel + ': ' + (cov.prior ? 'yes' : 'NO') +
        ',  ' + periods.yoy.shortLabel + ' (YoY): ' + (cov.yoy ? 'yes' : 'NO') + '.');
      if (!cov.current) problems.push('Triple Whale has no data for the month being reported (' +
        periods.current.label + '). Sync that sheet, or set REPORT_MONTH in Config.gs.');
      if (!cov.yoy) notes.push('No year-ago Triple Whale data → %YoY will read n/a for the Triple ' +
        'Whale columns. Lower BACKFILL_START in ld-x-tw-script to ' + periods.yoy.start + ' to fix.');
      if (!tw.sessionsAvailable) notes.push('No sessions column → "TW Sessions" reads n/a and TW CVR ' +
        'is computed on clicks. See docs/GAPS.md.');
    } catch (e) {
      problems.push(e.message);
    }
  }

  var engTabs = [ENGINE_DAY_SHEET, ENGINE_PRODUCT_SHEET, ENGINE_PMAXCAT_SHEET,
                 ENGINE_ITEM_SHEET, ENGINE_ASSET_SHEET];
  var present = [], missing = [];
  for (var i = 0; i < engTabs.length; i++) {
    (readEngineTab_(engTabs[i]).length ? present : missing).push(engTabs[i]);
  }
  if (present.length) notes.push('Engine tabs with data: ' + present.join(', ') + '.');
  if (missing.length) notes.push('Engine tabs empty or absent: ' + missing.join(', ') +
    '. Slides 8–12 will render as empty labelled tables until the MCC Google Ads Script runs.');

  if (!DECK_TEMPLATE_ID) {
    notes.push('DECK_TEMPLATE_ID is empty → the Report tab is built but no deck is generated. ' +
      'Upload template/Xero_Shoes_Monthly_Reporting_Framework.pptx to Drive, open it, save it as ' +
      'Google Slides, and paste that file ID into Config.gs.');
  } else {
    try {
      var deck = SlidesApp.openById(DECK_TEMPLATE_ID);
      notes.push('Deck template opens: "' + deck.getName() + '", ' + deck.getSlides().length + ' slides.');
    } catch (e) {
      problems.push('DECK_TEMPLATE_ID cannot be opened as a Google Slides file. If you pasted the ID ' +
        'of the uploaded .pptx, convert it first (File → Save as Google Slides) and use the new ID. ' +
        'Original error: ' + e.message);
    }
  }

  var tzNow = tz_();
  notes.push('Script time zone: ' + tzNow + '. Region: ' + REGION + '. Currency: ' + CURRENCY + '.');

  var body = (problems.length
      ? '✗ ' + problems.length + ' thing(s) to fix:\n\n' + problems.map(function (s, i) { return (i + 1) + '. ' + s; }).join('\n\n')
      : '✓ Configuration looks good — you can run "Build report".') +
    '\n\n— — —\n\n' + notes.join('\n\n');

  tell_(problems.length ? 'First-run check — action needed' : 'First-run check — ready', body);
}

// ============================== AUTOMATION =================================

var MONTHLY_DAY = 3, MONTHLY_HOUR = 7;

function setupAutomation() {
  removeTriggersFor_('monthlyRun');
  ScriptApp.newTrigger('monthlyRun').timeBased().onMonthDay(MONTHLY_DAY).atHour(MONTHLY_HOUR).create();
  ensureInputTabs_();
  tell_('Automation set up',
    'The report will rebuild on day ' + MONTHLY_DAY + ' of each month at ~' + MONTHLY_HOUR + ':00 (' +
    tz_() + '), covering the previous calendar month.\n\n' +
    'Day ' + MONTHLY_DAY + ' gives the Triple Whale sheet two daily syncs to settle late attribution ' +
    'for the closing month.\n\n' +
    'Note: the MCC Google Ads Script has its own schedule — set it to run monthly BEFORE this, on ' +
    'day 1 or 2. See docs/SETUP.md.');
}

function automationStatus() {
  var triggers = ScriptApp.getProjectTriggers();
  if (!triggers.length) { tell_('Automation status', 'No triggers installed. Use Automation → Set up / repair monthly run.'); return; }
  var lines = triggers.map(function (t) {
    return '· ' + t.getHandlerFunction() + '  (' + t.getEventType() + ')';
  });
  tell_('Automation status', triggers.length + ' trigger(s):\n\n' + lines.join('\n') +
    '\n\nTime zone: ' + tz_() + '. Expected: one monthlyRun on day ' + MONTHLY_DAY + '.');
}

function removeAllAutomation() {
  var n = ScriptApp.getProjectTriggers().length;
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  tell_('Automation removed', n + ' trigger(s) deleted. The report will only rebuild when you run it by hand.');
}

function removeTriggersFor_(fn) {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === fn) ScriptApp.deleteTrigger(t);
  });
}


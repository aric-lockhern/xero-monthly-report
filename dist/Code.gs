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
var ENGINE_PMAXCAT_SHEET = '_eng_pmax_cat';  // PMax search CATEGORIES — legacy, see below
// Slide 10 is a PMax NON-BRAND SEARCH TERMS table, fed from
// `campaign_search_term_view` — a different resource from the search-term-INSIGHT
// ones, and the only one that returns raw terms for Performance Max.
// `search_term_view` returns no PMax data at all; the insight resources return
// category labels rather than terms. Read with priority over _eng_pmax_cat, which
// stays readable so an existing sheet keeps rendering something until the Ads
// script next runs.
var ENGINE_PMAXTERM_SHEET = '_eng_pmax_term';
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
// Custom label 1 × Custom label 4, matching the Google Ads report this slide is
// modelled on. In this feed label 1 is the category (shoe / boot / sandal) and
// label 4 is the model (prio / 360 / dillon / scrambler low), which is the
// breakdown the deck wants. Confirmed against the account's own report, not
// guessed — `Diagnostics → Show product dimensions` re-checks it against the feed.
var PRODUCT_DIM_1 = { field: 'product_custom_attribute1', label: 'Custom Label 1' };
var PRODUCT_DIM_2 = { field: 'product_custom_attribute4', label: 'Custom Label 4' };

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

var PMAX_CAT_ROWS  = 16;   // slide 10 — top PMax non-brand search terms

/**
 * What counts as a BRAND search term on slide 10.
 *
 * Classified on the reading side, not in the Google Ads Script, so changing the
 * definition is a rebuild rather than a re-run of the MCC feed. The feed stores every
 * term; this decides which ones the slide excludes.
 *
 * Covers the brand name and the misspellings that dominate brand search — "zero
 * shoes" and "xeroshoes" are the same intent as "xero shoes" and belong with it.
 *
 * MODEL NAMES ARE DELIBERATELY NOT HERE. "prio" and "hfs" are Xero products, so a
 * case can be made either way, but treating them as brand would empty this slide of
 * exactly the discovery terms it exists to show. The Report tab prints the brand
 * volume this excludes, so the choice is visible and arguable rather than buried.
 */
var BRAND_TERM_RE = /(^|[^a-z])(xero|xeros|zero\s*shoe|xero\s*shoe|xeroshoe)/i;
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

function currencySymbol_() {
  return CURRENCY === 'EUR' ? '€' : (CURRENCY === 'GBP' ? '£' : '$');
}

function currencyFormat_(decimals) {
  return '"' + currencySymbol_() + '"#,##0' + (decimals ? '.00' : '');
}


// ==========================================================================
// SOURCE FILE: apps-script/Settings.gs
// ==========================================================================

/**
 * Xero Shoes — Monthly Report  ·  SETTINGS
 * =============================================================================
 * Per-deployment settings live in a visible `Settings` TAB, not in Config.gs.
 *
 * WHY THIS EXISTS
 * -----------------------------------------------------------------------------
 * The single-file build (dist/Code.gs) is pasted over the whole Apps Script
 * project, which means every re-paste overwrites Config.gs — and with it any
 * spreadsheet id, deck id or region you had typed there. That is a trap: the
 * symptom is silent ("Deck generation skipped (DECK_TEMPLATE_ID is not set)")
 * and appears one step removed from the re-paste that caused it.
 *
 * So the rule is: CODE lives in Apps Script, SETTINGS live in the spreadsheet.
 * Re-pasting the code can never disturb your configuration again.
 *
 * Config.gs still holds every constant, and those values remain the DEFAULTS.
 * A non-empty cell on the Settings tab overrides the matching constant; an empty
 * cell falls through to it. Nothing had to move out of Config.gs.
 *
 * applySettings_() mutates the globals, which is safe because Apps Script
 * re-evaluates all top-level code on every execution — the constants are back to
 * their Config.gs values at the start of each run, so overrides never accumulate.
 * It is called at the top of every entry point.
 */

var SETTINGS_SHEET = 'Settings';

/**
 * The overridable settings, in the order they appear on the tab.
 * [ key, human label, validator|null, help ]
 *
 * Only per-deployment values belong here. Things that describe the DECK or the
 * measurement contract — row counts, classification rules, column order — stay in
 * Config.gs, because changing them is a code change that the self-test checks.
 */
function settingsSpec_() {
  return [
    ['TW_SPREADSHEET_ID', 'Triple Whale spreadsheet ID', null,
     'From that sheet\'s URL, between /d/ and /edit. US: 1TK1xPqrwf4Zr1_DA7GcYVDf-sXKKagla-sS_hs631Cs  ·  EU: 1Qf-YpWXlOLUhSdLE6E1PZ1W37lDH1JPbc-ancEF5w8w'],

    ['DECK_TEMPLATE_ID', 'Deck template ID (Google Slides)', null,
     'The GOOGLE SLIDES version of the framework deck, not an uploaded .pptx. The template is copied, never modified. Leave empty to build the Report tab only.'],

    ['DECK_OUTPUT_FOLDER_ID', 'Deck output folder ID', null,
     'Drive folder for generated decks. Empty = same folder as the template.'],

    ['REGION', 'Region', function (v) { return /^[A-Za-z]{2,4}$/.test(v); },
     'US or EU. Appears on the Report tab and in the generated deck name.'],

    ['CURRENCY', 'Currency', function (v) { return ['USD', 'EUR', 'GBP'].indexOf(v.toUpperCase()) !== -1; },
     'USD, EUR or GBP. Picks number formats ONLY — nothing here converts currency, so never point two regions at one spreadsheet.'],

    ['REPORT_MONTH', 'Report month (yyyy-MM)', function (v) { return /^\d{4}-\d{2}$/.test(v); },
     'Pin a specific month, e.g. 2026-07. Leave EMPTY for the last complete month, which is what a scheduled run wants.'],

    ['PRODUCT_FEED_URL', 'Shopping feed URL (product images)', null,
     'Your Merchant Center / Shopping feed — Google Shopping XML (<g:id>, <g:image_link>) or a TSV/CSV with id and image_link columns. Fills slide 11\'s product photos via Setup → Refresh product images. Must be publicly reachable. The Google Ads API exposes no product image URL, so this is the only automated source.'],

    ['PRODUCT_DIM_1', 'Slide 8 — first product dimension', function (v) { return !!resolveProductDim_(v); },
     'The left-hand column of slide 8. Custom Label 0-4, Product Type 1-5, Brand, Condition, Channel, Item ID or Product Title. THE GOOGLE ADS SCRIPT READS THIS SAME CELL, so changing it needs no code edit — change it, re-run the MCC script, rebuild. Run Diagnostics → Show product dimensions first to see what each one actually contains in your feed.'],

    ['PRODUCT_DIM_2', 'Slide 8 — second product dimension', function (v) { return !!resolveProductDim_(v); },
     'The second column of slide 8, broken out within the first. Same vocabulary as PRODUCT_DIM_1.'],

    ['CVR_BASIS', 'TW CVR basis', function (v) { return ['clicks', 'sessions'].indexOf(v.toLowerCase()) !== -1; },
     'clicks or sessions. sessions needs TW_SESSION_FIELD set and that column present in the Triple Whale store — see docs/GAPS.md §3.'],

    ['TW_SESSION_FIELD', 'Triple Whale sessions column', null,
     'Name of a sessions column in the Triple Whale _store tab, if you add one. Empty = TW Sessions reads n/a.'],
  ];
}

// ============================== APPLY ======================================

/**
 * Overlay the Settings tab onto the Config.gs globals. Call FIRST in every entry
 * point. Silent and non-throwing: a missing tab simply means defaults apply, and
 * a bad value is reported but ignored rather than taking down the run.
 */
function applySettings_() {
  var stored;
  try { stored = readSettings_(); } catch (e) { return; }
  if (!stored) return;

  var spec = settingsSpec_();
  var applied = [], rejected = [];

  for (var i = 0; i < spec.length; i++) {
    var key = spec[i][0], validate = spec[i][2];
    var raw = stored[key];
    if (raw === undefined || raw === null || String(raw).trim() === '') continue;

    var value = String(raw).trim();
    if (validate && !validate(value)) { rejected.push(key + '="' + value + '"'); continue; }

    // Normalise the values with a fixed vocabulary.
    if (key === 'CURRENCY')  value = value.toUpperCase();
    if (key === 'REGION')    value = value.toUpperCase();
    if (key === 'CVR_BASIS') value = value.toLowerCase();

    switch (key) {
      case 'TW_SPREADSHEET_ID':     TW_SPREADSHEET_ID = value; break;
      case 'DECK_TEMPLATE_ID':      DECK_TEMPLATE_ID = value; break;
      case 'DECK_OUTPUT_FOLDER_ID': DECK_OUTPUT_FOLDER_ID = value; break;
      case 'REGION':                REGION = value; break;
      case 'CURRENCY':              CURRENCY = value; break;
      case 'REPORT_MONTH':          REPORT_MONTH = value; break;
      case 'CVR_BASIS':             CVR_BASIS = value; break;
      case 'TW_SESSION_FIELD':      TW_SESSION_FIELD = value; break;
      case 'PRODUCT_FEED_URL':      PRODUCT_FEED_URL = value; break;
      // Stored as a free-text dimension name; normalised to { field, label } so
      // the deck header can never disagree with the field that was queried.
      case 'PRODUCT_DIM_1':         PRODUCT_DIM_1 = resolveProductDim_(value); break;
      case 'PRODUCT_DIM_2':         PRODUCT_DIM_2 = resolveProductDim_(value); break;
      default: continue;
    }
    applied.push(key);
  }

  if (rejected.length) {
    progress_('Settings: ignored invalid value(s) — ' + rejected.join(', ') +
      '. See the Notes column on the ' + SETTINGS_SHEET + ' tab.');
  }
  return { applied: applied, rejected: rejected };
}

/** Read the Settings tab as { KEY: value }. Returns null if the tab is absent. */
function readSettings_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SETTINGS_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return null;

  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
  var out = {};
  for (var i = 0; i < values.length; i++) {
    var key = String(values[i][0] || '').trim();
    if (key) out[key] = values[i][1];
  }
  return out;
}

// ============================== TAB ========================================

/**
 * Create the Settings tab if absent, PRESERVING any values already typed.
 * Safe to call on every run.
 */
function ensureSettingsTab_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SETTINGS_SHEET);
  var existing = sheet ? (readSettings_() || {}) : {};
  var fresh = !sheet;

  if (!sheet) sheet = ss.insertSheet(SETTINGS_SHEET, 0);

  var header = ['Setting', 'Value', 'What it is'];
  var spec = settingsSpec_();
  var rows = spec.map(function (s) {
    var key = s[0];
    // Keep what is already there. On a first run, seed from the Config.gs
    // defaults so the tab shows the values actually in effect rather than blanks.
    var current = existing[key];
    if (current === undefined || String(current).trim() === '') current = defaultFor_(key);
    return [key, current === undefined ? '' : current, s[3]];
  });

  sheet.clear();
  sheet.getRange(1, 1, 1, 3).setValues([header])
    .setFontWeight('bold').setBackground(HEAD_BG).setFontColor(HEAD_FG);
  sheet.setFrozenRows(1);
  sheet.getRange(2, 1, rows.length, 3).setValues(rows);

  // Only the Value column is editable — make that obvious.
  sheet.getRange(2, 1, rows.length, 1).setFontWeight('bold').setBackground('#f3f4f6');
  sheet.getRange(1, 2).setBackground('#0f7b6c');
  sheet.getRange(2, 2, rows.length, 1).setBackground('#ffffff');
  sheet.getRange(2, 3, rows.length, 1).setFontColor('#6b7280').setFontSize(9).setWrap(true);
  sheet.getRange(2, 1, rows.length, 3).setVerticalAlignment('top');

  sheet.getRange(1, 2).setNote('EDITABLE. A non-empty value here OVERRIDES the matching constant in ' +
    'Config.gs. Empty falls back to the Config.gs default.\n\n' +
    'These live in the spreadsheet on purpose: pasting a new dist/Code.gs replaces the whole Apps ' +
    'Script project, including Config.gs, so anything typed in the code would be lost on every ' +
    'update. Settings here survive that.');

  sheet.setColumnWidth(1, 210);
  sheet.setColumnWidth(2, 380);
  sheet.setColumnWidth(3, 620);
  sheet.setRowHeights(2, rows.length, 42);

  return { sheet: sheet, fresh: fresh };
}

/** The Config.gs value currently in effect for a key, used to seed the tab. */
function defaultFor_(key) {
  switch (key) {
    case 'TW_SPREADSHEET_ID':     return TW_SPREADSHEET_ID;
    case 'DECK_TEMPLATE_ID':      return DECK_TEMPLATE_ID;
    case 'DECK_OUTPUT_FOLDER_ID': return DECK_OUTPUT_FOLDER_ID;
    case 'REGION':                return REGION;
    case 'CURRENCY':              return CURRENCY;
    case 'REPORT_MONTH':          return REPORT_MONTH;
    case 'CVR_BASIS':             return CVR_BASIS;
    case 'TW_SESSION_FIELD':      return TW_SESSION_FIELD;
    case 'PRODUCT_FEED_URL':      return PRODUCT_FEED_URL;
    case 'PRODUCT_DIM_1':         return PRODUCT_DIM_1 ? PRODUCT_DIM_1.field : '';
    case 'PRODUCT_DIM_2':         return PRODUCT_DIM_2 ? PRODUCT_DIM_2.field : '';
    default: return '';
  }
}

// ============================== MENU ACTIONS ===============================

function openSettings() {
  var res = ensureSettingsTab_();
  res.sheet.activate();
  applySettings_();

  tell_(res.fresh ? 'Settings tab created' : 'Settings tab ready',
    'Edit the VALUE column on the "' + SETTINGS_SHEET + '" tab. Nothing else to save — the next ' +
    'build reads it.\n\n' +
    'These live in the spreadsheet rather than in Config.gs on purpose: pasting a new dist/Code.gs ' +
    'replaces the entire Apps Script project, so anything typed into the code is lost on every ' +
    'update. Settings here survive it.\n\n' +
    'Currently in effect:\n' +
    '  Region              ' + REGION + '\n' +
    '  Currency            ' + CURRENCY + '\n' +
    '  Report month        ' + (REPORT_MONTH || '(last complete month)') + '\n' +
    '  Triple Whale sheet  ' + (TW_SPREADSHEET_ID ? TW_SPREADSHEET_ID : 'NOT SET') + '\n' +
    '  Deck template       ' + (DECK_TEMPLATE_ID ? DECK_TEMPLATE_ID : 'NOT SET — no deck will be generated') + '\n' +
    '  CVR basis           ' + CVR_BASIS + '\n' +
    '  Slide 8 dimensions  ' + PRODUCT_DIM_1.label + ' × ' + PRODUCT_DIM_2.label +
      '  (' + PRODUCT_DIM_1.field + ' / ' + PRODUCT_DIM_2.field + ')');
}

/**
 * Fill in the deck template id by finding the converted Slides deck in Drive.
 * Saves hunting for the ID, which is the step most likely to be got wrong (the
 * uploaded .pptx and the converted Slides file look identical in a folder).
 */
function findDeckTemplate() {
  ensureSettingsTab_();

  var found = [], it = DriveApp.searchFiles(
    'title contains "Reporting Framework" and mimeType = "application/vnd.google-apps.presentation" and trashed = false');
  while (it.hasNext() && found.length < 10) {
    var f = it.next();
    found.push({ id: f.getId(), name: f.getName(), updated: f.getLastUpdated() });
  }

  if (!found.length) {
    tell_('No deck template found',
      'Searched your Drive for a GOOGLE SLIDES file with "Reporting Framework" in the title and ' +
      'found none.\n\n' +
      'If you have only the .pptx: open it in Drive → File → Save as Google Slides. That makes a ' +
      'NEW file — use that one\'s ID.\n\n' +
      'Then paste the ID into DECK_TEMPLATE_ID on the "' + SETTINGS_SHEET + '" tab.');
    return;
  }

  if (found.length === 1) {
    setSetting_('DECK_TEMPLATE_ID', found[0].id);
    applySettings_();
    tell_('Deck template found and set',
      'DECK_TEMPLATE_ID is now:\n\n' + found[0].name + '\n' + found[0].id + '\n\n' +
      'Written to the "' + SETTINGS_SHEET + '" tab, so it survives future code updates.\n\n' +
      'Next: Diagnostics → Validate the deck template, then Build report + generate deck.');
    return;
  }

  tell_('Several candidates — pick one',
    'Found ' + found.length + ' Google Slides files matching "Reporting Framework". Paste the right ' +
    'id into DECK_TEMPLATE_ID on the "' + SETTINGS_SHEET + '" tab:\n\n' +
    found.map(function (f) {
      return '· ' + f.name + '\n    ' + f.id + '\n    last updated ' +
        Utilities.formatDate(f.updated, tz_(), 'yyyy-MM-dd');
    }).join('\n\n') + '\n\n' +
    'Use the PRISTINE template, not a previously generated deck — the slide-3 cards are matched by ' +
    'their "$—" placeholders and only fill on an untouched template.');
}

function setSetting_(key, value) {
  var sheet = ensureSettingsTab_().sheet;
  var last = sheet.getLastRow();
  var keys = sheet.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < keys.length; i++) {
    if (String(keys[i][0]).trim() === key) {
      sheet.getRange(i + 2, 2).setValue(value);
      return true;
    }
  }
  return false;
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
  var raw = readEngineTab_(ENGINE_DAY_SHEET)
    .concat(readEngineTab_(ENGINE_MANUAL_SHEET))
    .concat(readEngineTab_(ENGINE_BING_SHEET));
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
      // 'month' means this row is a whole-month total, not a single day. Matched
      // by month rather than by date range — see rowsInPeriod_.
      grain: String(r.grain || 'day').toLowerCase() === 'month' ? 'month' : 'day',
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

/**
 * Rows belonging to a period.
 *
 * Daily rows match on the inclusive date range. MONTHLY rows — whole-month
 * totals, dated the 1st as a key — match only when the period IS that month.
 *
 * That distinction is load-bearing. A monthly total dated the 1st would
 * otherwise be pulled, in full, into any narrower window containing the 1st: a
 * five-day promo starting on the 1st would absorb an entire month of Bing spend
 * and report a catastrophic promo ROAS. Monthly rows are deliberately invisible
 * to sub-month windows rather than approximated into them.
 */
function rowsInPeriod_(rows, period) {
  var out = [];
  var periodMonth = period.month ||
    (period.start === firstOfMonth_(period.start) && period.end === lastOfMonth_(period.start)
      ? period.start.slice(0, 7) : '');

  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (r.grain === 'month') {
      if (periodMonth && r.date.slice(0, 7) === periodMonth) out.push(r);
    } else if (r.date >= period.start && r.date <= period.end) {
      out.push(r);
    }
  }
  return out;
}

function firstOfMonth_(ds) { return String(ds).slice(0, 7) + '-01'; }

function lastOfMonth_(ds) {
  var y = Number(String(ds).slice(0, 4)), m = Number(String(ds).slice(5, 7));
  return Utilities.formatDate(new Date(y, m, 0), tz_(), 'yyyy-MM-dd');
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
  applySettings_();
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

  // One bag per channel, so the report can show Google vs Microsoft explicitly.
  // Without this there is no channel breakout anywhere in the deck or the Report
  // tab — the deck splits by tactic and brand only — and "is Bing actually in
  // these numbers?" becomes unanswerable without reading the source data.
  var adsChannels = {};
  ['current', 'prior', 'yoy'].forEach(function (p) {
    channelCoverage[p].engine.forEach(function (c) { adsChannels[c] = true; });
    channelCoverage[p].triplewhale.forEach(function (c) { adsChannels[c] = true; });
  });
  var channelSegments = {};
  Object.keys(adsChannels).sort().forEach(function (ch) {
    channelSegments[ch] = bagsFor(function (r) { return r.channel === ch; });
  });

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
    segments: segments, channelSegments: channelSegments, chatgpt: chatgpt,
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
  renderChannelBlock_(w, ctx);
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

// ---- channel breakout (not a deck slide — a visibility and QA block) ----

/**
 * Google vs Microsoft, side by side, with the front-end source named per channel.
 *
 * The deck never breaks out by channel — slides 4-7 split by tactic and brand —
 * so without this there is no way to confirm from the report that Microsoft spend
 * is in the blended total at all. It also makes the two failure modes that would
 * silently drop a channel visible: a channel missing from this block is missing
 * from every table above it, and a channel whose Source says "triplewhale" is one
 * the engine feed is not covering yet.
 */
function renderChannelBlock_(w, ctx) {
  var cols = tableColumns_();
  var header = ['Channel', 'Front-end source', '% of cost']
    .concat(cols.map(function (c) { return c[0]; }));

  var channels = Object.keys(ctx.channelSegments);
  var blendedCost = num_(derive_(ctx.segments.blended.current).cost);
  var rows = [];

  for (var i = 0; i < channels.length; i++) {
    var ch = channels[i];
    var bag = ctx.channelSegments[ch].current;
    var m = derive_(bag);
    if (!bag._rows) continue;
    var row = [ch, bag._frontSource || 'none', div_(num_(m.cost), blendedCost)];
    for (var c = 0; c < cols.length; c++) row.push(m[cols[c][1]]);
    rows.push(row);
  }
  rows.sort(function (a, b) { return num_(b[2]) - num_(a[2]); });

  // A TOTAL row that must equal slide 4, computed from the blended bag rather
  // than by adding the rows above — so a mismatch is visible instead of hidden by
  // the arithmetic agreeing with itself.
  var blended = derive_(ctx.segments.blended.current);
  var totalRow = ['TOTAL (= slide 4)', ctx.segments.blended.current._frontSource || 'none', 1];
  for (var t = 0; t < cols.length; t++) totalRow.push(blended[cols[t][1]]);
  rows.push(totalRow);

  var engineOnly = [], twOnly = [];
  for (var k = 0; k < channels.length; k++) {
    var src = ctx.channelSegments[channels[k]].current._frontSource;
    if (src === 'engine') engineOnly.push(channels[k]);
    else if (src === 'triplewhale') twOnly.push(channels[k]);
  }

  w.block({
    name: 'RPT_CHANNEL', title: 'Channel breakout — Google vs Microsoft',
    note: 'Not a deck slide. The deck splits by tactic and brand, never by channel, so this block ' +
      'exists to answer "is Microsoft in these numbers?" — it is, wherever a bing row appears.  ' +
      (engineOnly.length ? 'Front end from the engine: ' + engineOnly.join(', ') + '.  ' : '') +
      (twOnly.length ? 'Front end from Triple Whale (no engine feed yet): ' + twOnly.join(', ') +
        ' — set up the Microsoft Advertising Script to move these onto the engine spine, which is ' +
        'also what gives them %YoY history. See docs/GAPS.md §8.  ' : '') +
      'ChatGPT Ads is excluded here and on slide 4 — it is a test channel with its own slide (13).',
    header: header,
    rows: rows,
    colFormats: [null, null, '0.0%'].concat(cols.map(function (c) { return c[2]; })),
    rowFormats: (function () {
      var f = [];
      for (var r = 0; r < rows.length - 1; r++) f.push(null);
      f.push(null);   // TOTAL row keeps column formats; bolding is not available here
      return f;
    })(),
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

  // The TAB is the authority on which dimensions its numbers describe — it records
  // them in dim1_field / dim2_field. Reading the labels from the Settings tab
  // instead would head the columns with whatever was configured LAST, which after
  // a settings change but before the next MCC run is a slide that mislabels real
  // data. That is the one failure mode worth engineering against here, because it
  // is invisible: the numbers look fine under the wrong heading.
  var dims = productDimsOf_(raw);

  // Fixed column names `dim1`/`dim2` whatever the dimensions are. Older tabs,
  // written before that, used product_type_l1/l2 — read those as a fallback so an
  // existing sheet keeps working until the Ads script next runs.
  var groups = groupEngine_(raw, function (r) {
    var d1 = r.dim1 !== undefined ? r.dim1 : r.product_type_l1;
    var d2 = r.dim2 !== undefined ? r.dim2 : r.product_type_l2;
    return String(d1 || '(not set)') + '||' + String(d2 || '(not set)');
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
      ? 'Google Ads engine data, shopping_performance_view segmented by ' + dims[0].label +
        ' × ' + dims[1].label + ' (' + dims[0].field + ' / ' + dims[1].field +
        '). Sorted by conversion value, top ' + PRODUCT_ROWS + ' rows.' + dims.mismatchNote +
        '  Custom labels are free text your Shopping feed sets, so which ones carry a category is a ' +
        'property of the feed: run Diagnostics → Show product dimensions to see what each contains, ' +
        'then set PRODUCT_DIM_1 / PRODUCT_DIM_2 on the Settings tab and re-run the MCC script.'
      : emptyNote_(ENGINE_PRODUCT_SHEET),
    header: [dims[0].label, dims[1].label, 'Impr.', 'Clicks', 'Cost',
             'Avg. CPC', 'Conversions', 'Conv. Value', 'ROAS'],
    rows: padRows_(rows, PRODUCT_ROWS, 9),
    colFormats: [null, null, '#,##0', '#,##0', currencyFormat_(false),
                 currencyFormat_(true), '#,##0', currencyFormat_(false), '#,##0.00'],
  });
}

/**
 * The two dimensions the `_eng_product` rows actually describe, as
 * [ {field,label}, {field,label} ] with a `mismatchNote` string.
 *
 * Prefers what the tab recorded over what is configured now, and says so when they
 * disagree — a settings change only reaches the data on the next MCC run, and in
 * between, the honest thing is to label the columns for the data that is there.
 */
function productDimsOf_(rows) {
  var configured = [PRODUCT_DIM_1, PRODUCT_DIM_2];
  var out = configured.slice();
  out.mismatchNote = '';
  if (!rows.length) return out;

  var stamped = [String(rows[0].dim1_field || '').trim(), String(rows[0].dim2_field || '').trim()];
  var drift = [];

  for (var i = 0; i < 2; i++) {
    if (!stamped[i]) continue;                       // pre-stamp tab: trust config
    out[i] = dimByField_(stamped[i]);
    if (stamped[i] !== configured[i].field) {
      drift.push('PRODUCT_DIM_' + (i + 1) + ' is set to ' + configured[i].field);
    }
  }

  if (drift.length) {
    out.mismatchNote = '  ⚠  These columns are headed for what the tab HOLDS (' +
      out[0].field + ' / ' + out[1].field + '), but ' + drift.join(' and ') +
      ' on the Settings tab. Re-run the MCC Google Ads Script to pull the dimensions you asked for.';
  }
  return out;
}

// ============================== SLIDE 9: IMPRESSION SHARE ==================

function renderImpressionShareBlocks_(w, ctx) {
  // ---- our own brand impression share, by day, from the engine tab ----
  var period = ctx.periods.current;
  var brandSearch = [];
  for (var i = 0; i < ctx.engRows.length; i++) {
    var r = ctx.engRows[i];
    if (r.date < period.start || r.date > period.end) continue;
    // A whole-month total would plot as one bogus daily point.
    if (r.grain === 'month') continue;
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

  // Sources in priority order: a hand paste, then the search-TERMS tab, then the
  // legacy search-CATEGORIES tab. The paste wins because if you pasted it you looked
  // at it; the categories tab is last because it answers a different question and is
  // only still read so an existing sheet renders something until the MCC script next
  // runs with the new query.
  var manual = readPmaxManual_(month);
  var allTerms = readEngineTab_(ENGINE_PMAXTERM_SHEET);
  var terms = allTerms.filter(function (r) { return monthOf_(r.month) === month; });
  var cats = readEngineTab_(ENGINE_PMAXCAT_SHEET)
    .filter(function (r) { return monthOf_(r.month) === month; });

  // The search-terms feed keeps a SHORT window (CONFIG.TERM_MONTHS_BACK, normally one
  // month) and rewrites the tab each run, so asking for an older month finds nothing
  // even though the tab is full. Name the months it does hold — otherwise this looks
  // identical to the query having failed, and the two need completely different fixes.
  var termMonths = {};
  for (var tm = 0; tm < allTerms.length; tm++) {
    var mk = monthOf_(allTerms[tm].month);
    if (mk) termMonths[mk] = true;
  }
  var haveMonths = Object.keys(termMonths).sort();

  var raw, source;
  if (manual.rows.length)   { raw = manual.rows; source = 'manual'; }
  else if (terms.length)    { raw = terms;       source = 'terms'; }
  else if (cats.length)     { raw = cats;        source = 'categories'; }
  else                      { raw = [];          source = 'none'; }

  // Group by term, then split brand from non-brand. Brand is QUANTIFIED rather than
  // just dropped: which terms count as brand is a judgement call, and a slide that
  // silently discards most of its traffic invites the question. Answer it up front.
  var all = groupEngine_(raw, function (r) {
    var t = String(r.search_term !== undefined ? r.search_term : (r.category || '')).trim();
    return t || null;
  });

  var nonBrand = [], brandTerms = 0, brandImpr = 0, brandCost = 0;
  for (var i = 0; i < all.length; i++) {
    if (BRAND_TERM_RE.test(all[i].key)) {
      brandTerms++; brandImpr += all[i].impressions; brandCost += all[i].cost;
    } else {
      nonBrand.push(all[i]);
    }
  }

  // SORTED BY TRAFFIC. A search-terms slide is a discovery artefact — the rows worth
  // reading are the ones pulling volume, including those converting at zero. Sorting
  // by conversion value would hide exactly those.
  nonBrand.sort(function (a, b) { return b.impressions - a.impressions; });

  var rows = nonBrand.map(function (g) {
    return [
      g.key,
      g.impressions, g.clicks,
      div_(g.clicks, g.impressions),
      g.cost, g.conversions, g.conversions_value,
      div_(g.conversions_value, g.cost),
    ];
  });

  var note;
  if (source === 'manual') {
    note = 'Pasted by hand into the "' + PMAXCAT_MANUAL_SHEET + '" tab for ' + month +
      ' — ' + manual.rows.length + ' row(s). A paste takes priority over the automated tabs, so ' +
      'this is what the slide shows even if the feed also returned data.' +
      (manual.unmapped.length
        ? '  ⚠  Unrecognised column(s) ignored: ' + manual.unmapped.join(', ') + '.'
        : '');
  } else if (source === 'terms') {
    note = 'Google Ads campaign_search_term_view, filtered to Performance Max campaigns. That is ' +
      'the only resource returning RAW search terms for PMax: search_term_view returns no PMax data ' +
      'at all, and the search-term-INSIGHT resources return category labels rather than terms. The ' +
      'feed drops terms below a minimum monthly click count (CONFIG.TERM_MIN_CLICKS in ' +
      'engine-report.js, normally 5) — the tail of a search-term report is thousands of one-click ' +
      'queries that could never reach a ' + PMAX_CAT_ROWS + '-row table.';
  } else if (source === 'categories') {
    note = '⚠  Showing search CATEGORIES, not terms — the "' + ENGINE_PMAXTERM_SHEET + '" tab is ' +
      'empty, so this is falling back to the older "' + ENGINE_PMAXCAT_SHEET + '" tab. Re-paste and ' +
      'Run the MCC Google Ads Script to get actual search terms.';
  } else if (haveMonths.length) {
    // The commonest empty case now, and NOT a failure: the feed keeps one month and
    // you asked for a different one.
    note = 'EMPTY for ' + month + ', but the "' + ENGINE_PMAXTERM_SHEET + '" tab holds ' +
      haveMonths.join(', ') + '. The search-terms feed keeps a short window ' +
      '(CONFIG.TERM_MONTHS_BACK in engine-report.js, normally 1 month) and rewrites the tab each ' +
      'run, because search terms are the highest-cardinality report in the feed. To report an older ' +
      'month either raise TERM_MONTHS_BACK and re-run the MCC script, or paste that month into the "' +
      PMAXCAT_MANUAL_SHEET + '" tab. Nothing is broken.';
  } else {
    note = 'EMPTY. Two ways to fill it:  (1) AUTOMATED — re-paste and Run the MCC Google Ads Script. ' +
      'It queries campaign_search_term_view, which is the resource that actually returns PMax search ' +
      'terms; if the tab stays empty, "_eng_status" carries Google\'s exact error.  (2) MANUAL — ' +
      'Google Ads → Campaigns → Insights → search terms → Download, then paste into the "' +
      PMAXCAT_MANUAL_SHEET + '" tab with Month as ' + month + '.';
  }

  if (brandTerms) {
    note += '  Excluded ' + brandTerms + ' brand term(s): ' +
      Math.round(brandImpr).toLocaleString() + ' impressions, ' +
      currencySymbol_() + Math.round(brandCost).toLocaleString() + ' cost (of terms above the ' +
      'feed\'s click threshold, so not the account\'s whole brand volume). Brand is ' +
      'matched by BRAND_TERM_RE in Config.gs — the brand name and its common misspellings, but ' +
      'deliberately NOT model names like "prio" or "hfs", since counting those as brand would empty ' +
      'this slide of the discovery terms it exists to show.';
  }

  w.block({
    name: 'RPT_PMAX_CAT', slide: '10', title: 'Performance Max — Non-Brand Search Terms',
    note: note + '  Sorted by impressions (traffic), top ' + PMAX_CAT_ROWS + '.',
    header: ['Search Term', 'Impr.', 'Clicks', 'CTR', 'Cost', 'Conversions', 'Conv. Value', 'ROAS'],
    rows: padRows_(rows, PMAX_CAT_ROWS, 8),
    colFormats: [null, '#,##0', '#,##0', '0.00%', currencyFormat_(false), '#,##0',
                 currencyFormat_(false), '#,##0.00'],
  });
}

/**
 * Read the hand-pasted PMax search categories for one month, normalised into the
 * same row shape the engine tab uses so the renderer cannot tell them apart.
 *
 * Column names are matched LOOSELY. A Google Ads export is pasted as-is and its
 * headers vary by view, locale and Google's own redesigns ("Search category" /
 * "Search categories" / "Category"), so insisting on exact spellings would turn a
 * working paste into a silently empty slide. Anything unrecognised is reported
 * rather than dropped quietly.
 *
 * A row with no Month is treated as belonging to the report month: the export does
 * not carry one, and requiring the column is the mistake most likely to make a
 * correct paste look like no paste at all.
 */
function readPmaxManual_(month) {
  var raw = readEngineTab_(PMAXCAT_MANUAL_SHEET);
  if (!raw.length) return { rows: [], unmapped: [] };

  var ALIASES = {
    month:             ['month', 'reporting month', 'period'],
    // Slide 10 is a search-TERMS table now, but the category spellings stay: an
    // export of either shape should land, and both answer "what did PMax show for".
    category:          ['search term', 'search terms', 'term', 'query', 'search query',
                        'search category', 'search categories', 'category', 'search term category',
                        'categories', 'search category label', 'category label'],
    search_volume:     ['search volume', 'searches', 'volume', 'monthly searches',
                        'search volume index'],
    impressions:       ['impressions', 'impr.', 'impr', 'impressions.'],
    clicks:            ['clicks'],
    cost:              ['cost', 'spend', 'cost (usd)', 'amount spent'],
    conversions:       ['conversions', 'conv.', 'conv', 'all conv.', 'all conversions', 'orders'],
    conversions_value: ['conv. value', 'conversion value', 'conv value', 'all conv. value',
                        'value', 'revenue', 'conv. value (usd)'],
  };

  var present = {}, unmapped = [];
  Object.keys(raw[0]).forEach(function (h) {
    var norm = h.replace(/\s+/g, ' ').trim();
    var hit = null;
    Object.keys(ALIASES).forEach(function (canon) {
      if (hit) return;
      if (ALIASES[canon].indexOf(norm) !== -1) hit = canon;
    });
    if (hit) { if (!present[hit]) present[hit] = h; }
    else if (norm) unmapped.push(h);
  });

  if (!present.category) {
    // No term/category column means this is not a search-terms paste. Report it
    // through the note rather than showing an empty slide with no explanation.
    return { rows: [], unmapped: ['no recognisable "Search term" column — found: ' +
      Object.keys(raw[0]).join(', ')] };
  }

  var rows = [];
  for (var i = 0; i < raw.length; i++) {
    var r = raw[i];
    var cat = String(r[present.category] || '').trim();
    if (!cat) continue;
    // Placeholder text from the example row the tab is seeded with.
    if (cat.indexOf('Paste your') === 0) continue;

    var m = present.month ? monthOf_(r[present.month]) : '';
    if (m && m !== month) continue;

    rows.push({
      month: month,
      category: cat,
      search_volume: present.search_volume ? r[present.search_volume] : '',
      impressions:       present.impressions       ? numLoose_(r[present.impressions])       : 0,
      clicks:            present.clicks            ? numLoose_(r[present.clicks])            : 0,
      cost:              present.cost              ? numLoose_(r[present.cost])              : 0,
      conversions:       present.conversions       ? numLoose_(r[present.conversions])       : 0,
      conversions_value: present.conversions_value ? numLoose_(r[present.conversions_value]) : 0,
    });
  }
  return { rows: rows, unmapped: unmapped };
}

/**
 * A number out of a pasted export: '1,234', '$1,234.56', '12.3%', ' 45 '.
 * A Google Ads download carries thousands separators and currency symbols, which
 * Number() turns into NaN — and NaN summed into a total is a silently wrong slide.
 */
function numLoose_(v) {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  var s = String(v === null || v === undefined ? '' : v).trim();
  if (!s || s === '--' || s === '—') return 0;
  var pct = s.indexOf('%') !== -1;
  var n = Number(s.replace(/[^0-9.\-]/g, ''));
  if (!isFinite(n)) return 0;
  return pct ? n / 100 : n;
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

  if (!ss.getSheetByName(PMAXCAT_MANUAL_SHEET)) {
    var m = ss.insertSheet(PMAXCAT_MANUAL_SHEET);
    var mh = ['Month', 'Search Term', 'Search Volume', 'Impressions', 'Clicks',
              'Cost', 'Conversions', 'Conv. Value'];
    m.getRange(1, 1, 1, mh.length).setValues([mh])
      .setFontWeight('bold').setBackground(HEAD_BG).setFontColor(HEAD_FG);
    m.setFrozenRows(1);
    m.getRange(1, 1).setNote('Slide 10 — Performance Max non-brand search terms. Google Ads → ' +
      'Campaigns → Insights → search terms → Download, then paste here. Month as yyyy-MM; leave ' +
      'Month empty and the rows count as the report month.\n\nColumn names are matched loosely, so ' +
      'you can paste the export with its own headers — only a "Search term" column is required ' +
      '(a "Search category" column is accepted too). Brand terms are filtered out at build time, ' +
      'so paste everything.\n\nAnything here takes PRIORITY over the automated "' +
      ENGINE_PMAXTERM_SHEET + '" tab.');
    m.getRange(2, 1, 1, 3).setValues([['', 'Paste your PMax search terms export here →', '']])
      .setFontColor('#9ca3af').setFontStyle('italic');
    m.getRange(2, 1, 200, 1).setNumberFormat('@');
    for (var c3 = 1; c3 <= mh.length; c3++) m.autoResizeColumn(c3);
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
// SOURCE FILE: apps-script/ProductImages.gs
// ==========================================================================

/**
 * Xero Shoes — Monthly Report  ·  PRODUCT IMAGES (slide 11)
 * =============================================================================
 * Resolves an image URL for each of slide 11's top products, so the deck's five
 * image frames fill themselves.
 *
 * WHY NOT STRAIGHT FROM GOOGLE ADS
 * -----------------------------------------------------------------------------
 * It cannot be done. The Google Ads API exposes no product image URL and no
 * product link on any resource — confirmed by the Google Ads API team, and still
 * true. `shopping_performance_view` gives the item id and title and stops there.
 * So the URL has to come from the place that actually owns product imagery: the
 * Merchant Center / Shopping feed.
 *
 * HOW IT WORKS
 * -----------------------------------------------------------------------------
 * A `Product Images` tab maps item id → image URL. It is filled either
 *
 *   automatically — set PRODUCT_FEED_URL on the Settings tab to your Shopping
 *                   feed (the XML or TSV your Merchant Center pulls) and run
 *                   Setup → Refresh product images. Parses both formats.
 *
 *   or by hand    — paste two columns. Rows you type are preserved on every
 *                   refresh, so a one-off override always wins.
 *
 * The Slides writer then inserts the image into each frame. Matching is by item
 * id first and exact title second, because which of the two the engine feed gives
 * us depends on the account's feed setup.
 *
 * A product with no match leaves its frame as the "Product Image" placeholder,
 * which is the honest outcome — a deck missing one shot is obvious and fixable,
 * whereas a wrong shot next to a product name is not.
 */

var PRODUCT_IMAGE_SHEET = 'Product Images';
var PRODUCT_IMAGE_HEADER = ['item_id', 'title', 'image_url', 'source'];

// Feeds can be large; cap what we keep so the tab stays workable. Slide 11 needs
// five, and the tab only has to cover whatever reaches the top of the report.
var PRODUCT_IMAGE_MAX_ROWS = 5000;

// ============================== TAB ========================================

function ensureProductImageTab_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(PRODUCT_IMAGE_SHEET);
  if (sheet) return sheet;

  sheet = ss.insertSheet(PRODUCT_IMAGE_SHEET);
  sheet.getRange(1, 1, 1, PRODUCT_IMAGE_HEADER.length).setValues([PRODUCT_IMAGE_HEADER])
    .setFontWeight('bold').setBackground(HEAD_BG).setFontColor(HEAD_FG);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1).setNote(
    'Maps a product to its image URL for slide 11.\n\n' +
    'Fill it automatically by setting PRODUCT_FEED_URL on the Settings tab and running ' +
    'Setup → Refresh product images, or paste item_id and image_url by hand.\n\n' +
    'source=manual rows are PRESERVED by a refresh; source=feed rows are replaced. So a hand-typed ' +
    'override always wins.\n\n' +
    'The image URL must be publicly reachable — Slides fetches it directly.');
  sheet.setColumnWidth(1, 180);
  sheet.setColumnWidth(2, 420);
  sheet.setColumnWidth(3, 420);
  sheet.hideSheet();
  return sheet;
}

/** Read the map as { byId: {...}, byTitle: {...}, count: n }. */
function readProductImages_() {
  var out = { byId: {}, byTitle: {}, count: 0 };
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PRODUCT_IMAGE_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return out;

  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).getValues();
  for (var i = 0; i < values.length; i++) {
    var id = String(values[i][0] || '').trim();
    var title = String(values[i][1] || '').trim();
    var url = String(values[i][2] || '').trim();
    if (!url) continue;
    if (id) out.byId[id.toLowerCase()] = url;
    if (title) out.byTitle[normTitle_(title)] = url;
    out.count++;
  }
  return out;
}

/**
 * The title match key: lower-cased with every non-alphanumeric character removed.
 *
 * Aggressive on purpose. Collapsing whitespace alone is not enough — the Ads report
 * and the feed disagree about PUNCTUATION, not just spacing, and
 *
 *   "HFS Original - Women - Light Gray / Pink Sand"
 *   "HFS Original - Women - Light Gray/Pink Sand"
 *
 * are the same product with different spaces around one slash. Under whitespace-only
 * normalisation those are different keys, and the image silently fails to resolve.
 * Stripping punctuation makes both `hfsoriginalwomenlightgraypinksand`.
 *
 * Safe to collapse this hard because the title carries the COLOURWAY, so two
 * genuinely different products cannot normalise to the same key.
 */
function normTitle_(t) {
  return String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/**
 * Resolve one product's image URL. **Title first, item id second.**
 *
 * Title wins because of how the feed and the Ads report disagree. A Shopping feed
 * carries one row per VARIANT (size), each with its own item id, and an
 * out-of-stock variant drops out of the feed entirely — so the exact id Google Ads
 * reports may not be in the feed at all. Its sibling sizes are, and they share the
 * title and therefore the photograph. Matching on the title finds them; matching on
 * the id gives up.
 *
 * This is a change of preference, not of correctness: for IMAGERY the title is the
 * right key, because everything sharing a title looks identical. Ids stay as the
 * second try so a hand-pasted id-only row still works.
 *
 * Deliberately NOT attempted: matching on the item id's product-level prefix
 * (`shopify_us_<product>_<variant>` → `shopify_us_<product>`). One Shopify product
 * can span several colourways, so that would resolve a pink shoe to a grey one —
 * and the wrong photo beside a product name is worse than a visible gap.
 */
function productImageUrl_(map, itemId, title) {
  var byTitle = map.byTitle[normTitle_(title)];
  if (byTitle) return byTitle;
  return map.byId[String(itemId || '').trim().toLowerCase()] || '';
}

// ============================== FEED REFRESH ===============================

function refreshProductImages() {
  applySettings_();
  ensureProductImageTab_();

  if (!PRODUCT_FEED_URL) {
    tell_('No feed URL set',
      'Set PRODUCT_FEED_URL on the "' + SETTINGS_SHEET + '" tab to your Shopping feed, then run ' +
      'this again.\n\n' +
      'It should be the same feed URL Merchant Center pulls — a Google Shopping XML feed (with ' +
      '<g:id> and <g:image_link>) or a TSV/CSV with id and image_link columns. On Shopify that is ' +
      'usually whatever your feed app publishes.\n\n' +
      'The Google Ads API exposes no product image URL on any resource, so the feed is the only ' +
      'automated source. You can also just paste item_id and image_url into the "' +
      PRODUCT_IMAGE_SHEET + '" tab by hand.');
    return;
  }

  var res;
  try {
    res = fetchFeed_(PRODUCT_FEED_URL);
  } catch (e) {
    tell_('Could not fetch the feed', feedFetchHelp_(e));
    return;
  }
  if (res.getResponseCode() !== 200) {
    tell_('Feed returned HTTP ' + res.getResponseCode(),
      'PRODUCT_FEED_URL must be publicly reachable without a login — Apps Script cannot sign in to ' +
      'it.\n\nFirst 300 characters of the response:\n' + res.getContentText().slice(0, 300));
    return;
  }

  var body = res.getContentText();
  var parsed;
  try {
    parsed = /^\s*<\?xml|^\s*<rss|^\s*<feed/i.test(body) ? parseFeedXml_(body) : parseFeedDelimited_(body);
  } catch (e) {
    tell_('Could not parse the feed', e.message +
      '\n\nExpected a Google Shopping XML feed (<g:id>, <g:image_link>) or a TSV/CSV with id and ' +
      'image_link columns.\n\nFirst 300 characters:\n' + body.slice(0, 300));
    return;
  }

  if (!parsed.rows.length) {
    tell_('Feed parsed but contained no products',
      'Found ' + parsed.format + ' but no rows carrying both an id and an image link.' +
      (parsed.headers ? '\n\nColumns seen: ' + parsed.headers.join(', ') : ''));
    return;
  }

  var written = writeProductImages_(parsed.rows);
  tell_('Product images refreshed',
    parsed.format + ' feed parsed.\n\n' +
    '  products with an image  ' + parsed.rows.length + '\n' +
    '  written to the tab      ' + written.feed + '\n' +
    '  hand-typed rows kept    ' + written.manual + '\n\n' +
    (parsed.rows.length > PRODUCT_IMAGE_MAX_ROWS
      ? 'Capped at ' + PRODUCT_IMAGE_MAX_ROWS + ' rows — slide 11 only needs the top few, so this ' +
        'is not a problem unless a top product is missing.\n\n'
      : '') +
    'Next: Build report + generate deck. Slide 11 will fill any frame it can match by item id, then ' +
    'by exact title. An unmatched product keeps its placeholder rather than borrowing another ' +
    'product\'s photo.');
}

function fetchFeed_(url) {
  return UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
}

/**
 * Turn a fetch failure into something actionable.
 *
 * The missing-scope case is worth special-casing because the message Google gives
 * is accurate but tells you nothing about what to actually do, and it is the
 * failure everyone hits first: the project was authorised BEFORE the code
 * contained any UrlFetchApp call, so the stored grant has no external_request
 * scope and Apps Script does not re-prompt on its own.
 */
function feedFetchHelp_(e) {
  var msg = String(e && e.message || e);

  if (/permission to call UrlFetchApp|script\.external_request/i.test(msg)) {
    return 'This script is not yet authorised to make external requests.\n\n' + msg + '\n\n' +
      'WHY, and it is not what it looks like: if this project\'s appsscript.json contains an ' +
      'explicit "oauthScopes" list, that list OVERRIDES Apps Script\'s automatic scope detection. ' +
      'A manifest written before the code made any external request therefore withholds the ' +
      'permission permanently — and because Apps Script believes the existing authorisation is ' +
      'sufficient, it never prompts. Running from the editor does not help.\n\n' +
      'FIX — update the manifest:\n' +
      '  1. Extensions → Apps Script\n' +
      '  2. ⚙ Project Settings → tick "Show appsscript.json manifest file in editor"\n' +
      '  3. Open appsscript.json from the file list on the left\n' +
      '  4. Make sure "oauthScopes" contains this line:\n' +
      '       "https://www.googleapis.com/auth/script.external_request"\n' +
      '     The full correct manifest is dist/appsscript.json in the repo — paste the whole thing.\n' +
      '  5. Save, then run Setup → Refresh product images. You WILL now be re-prompted, and the ' +
      'consent screen will list "Connect to an external service".\n\n' +
      'IF IT STILL FAILS after fixing the manifest, the stored grant is cached. Force a fresh one:\n' +
      '  a. Go to  myaccount.google.com/permissions\n' +
      '  b. Find this project (its name, or "Untitled project") → Remove access\n' +
      '  c. Run anything from the Monthly Report menu → authorise again from scratch\n\n' +
      'Or skip the whole thing: Setup → Prepare product image rows writes this month\'s five ' +
      'products into the "' + PRODUCT_IMAGE_SHEET + '" tab with empty URL cells. Paste five image ' +
      'URLs and the deck fills — no external-request permission needed at all.\n\n' +
      'Alternatively delete the whole "oauthScopes" key: Apps Script then infers scopes from the ' +
      'code on every save, which cannot go stale.';
  }

  if (/DNS|Address unavailable|host/i.test(msg)) {
    return 'The feed host could not be resolved.\n\n' + msg + '\n\nCheck the URL for a typo.';
  }

  return 'PRODUCT_FEED_URL could not be reached.\n\n' + msg;
}

/** Google Shopping RSS: <item><g:id>…</g:id><g:image_link>…</g:image_link></item> */
function parseFeedXml_(body) {
  var doc = XmlService.parse(body);
  var root = doc.getRootElement();
  var g = XmlService.getNamespace('http://base.google.com/ns/1.0');

  // RSS puts items under <channel>; Atom puts <entry> at the root.
  var items = [];
  var channel = root.getChild('channel');
  if (channel) items = channel.getChildren('item');
  if (!items.length) items = root.getChildren('item');
  if (!items.length) items = root.getChildren('entry', root.getNamespace());
  if (!items.length) items = root.getChildren();

  var rows = [];
  for (var i = 0; i < items.length && rows.length < PRODUCT_IMAGE_MAX_ROWS; i++) {
    var it = items[i];
    var id = childText_(it, 'id', g);
    var title = childText_(it, 'title', g) || childText_(it, 'title', null);
    var img = childText_(it, 'image_link', g) || childText_(it, 'image_link', null);
    if (!img) continue;
    rows.push([id, title, img]);
  }
  return { rows: rows, format: 'Google Shopping XML' };
}

function childText_(el, name, ns) {
  try {
    var c = ns ? el.getChild(name, ns) : el.getChild(name);
    return c ? String(c.getText()).trim() : '';
  } catch (e) { return ''; }
}

/** TSV or CSV with `id` and `image_link` columns, in any order. */
function parseFeedDelimited_(body) {
  var delim = body.indexOf('\t') !== -1 ? '\t' : ',';
  var lines = body.split(/\r?\n/).filter(function (l) { return l.trim() !== ''; });
  if (!lines.length) throw new Error('The feed is empty.');

  var header = splitLine_(lines[0], delim).map(function (h) {
    return String(h).replace(/^﻿/, '').trim().toLowerCase();
  });
  var iId = indexOfAny_(header, ['id', 'item_id', 'offer_id', 'sku', 'variant sku']);
  var iTitle = indexOfAny_(header, ['title', 'product title', 'name']);
  var iImg = indexOfAny_(header, ['image_link', 'image link', 'image', 'image_url', 'image src']);

  if (iImg === -1) {
    throw new Error('No image column found. Looked for image_link / image link / image / image_url.');
  }

  var rows = [];
  for (var r = 1; r < lines.length && rows.length < PRODUCT_IMAGE_MAX_ROWS; r++) {
    var cells = splitLine_(lines[r], delim);
    var img = String(cells[iImg] || '').trim();
    if (!img) continue;
    rows.push([
      iId === -1 ? '' : String(cells[iId] || '').trim(),
      iTitle === -1 ? '' : String(cells[iTitle] || '').trim(),
      img,
    ]);
  }
  return { rows: rows, format: delim === '\t' ? 'TSV' : 'CSV', headers: header };
}

function splitLine_(line, delim) {
  if (delim === '\t') return line.split('\t');
  // Minimal CSV: quoted fields with embedded commas.
  var out = [], field = '', inQ = false;
  for (var i = 0; i < line.length; i++) {
    var c = line[i];
    if (inQ) {
      if (c === '"') { if (line[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { out.push(field); field = ''; }
    else field += c;
  }
  out.push(field);
  return out;
}

function indexOfAny_(header, names) {
  for (var i = 0; i < names.length; i++) {
    var at = header.indexOf(names[i]);
    if (at !== -1) return at;
  }
  return -1;
}

/**
 * Replace the feed-sourced rows, keeping every hand-typed one.
 *
 * Preserving manual rows matters: the feed will not have a photo for every
 * product forever, and a one-off override typed to fix a specific deck must not
 * be erased by the next refresh.
 */
function writeProductImages_(feedRows) {
  var sheet = ensureProductImageTab_();
  var manual = [];

  if (sheet.getLastRow() > 1) {
    var existing = sheet.getRange(2, 1, sheet.getLastRow() - 1, PRODUCT_IMAGE_HEADER.length).getValues();
    for (var i = 0; i < existing.length; i++) {
      var src = String(existing[i][3] || '').trim().toLowerCase();
      var url = String(existing[i][2] || '').trim();
      if (url && src !== 'feed') manual.push([existing[i][0], existing[i][1], url, 'manual']);
    }
  }

  // A manual row wins, so drop any feed row for the same id or title.
  var claimedId = {}, claimedTitle = {};
  manual.forEach(function (m) {
    if (m[0]) claimedId[String(m[0]).trim().toLowerCase()] = true;
    if (m[1]) claimedTitle[normTitle_(m[1])] = true;
  });

  var out = manual.slice();
  for (var f = 0; f < feedRows.length; f++) {
    var id = String(feedRows[f][0] || '').trim();
    var title = String(feedRows[f][1] || '').trim();
    if (id && claimedId[id.toLowerCase()]) continue;
    if (!id && title && claimedTitle[normTitle_(title)]) continue;
    out.push([id, title, feedRows[f][2], 'feed']);
  }

  var last = sheet.getLastRow();
  if (last > 1) sheet.getRange(2, 1, last - 1, PRODUCT_IMAGE_HEADER.length).clearContent();
  if (out.length) sheet.getRange(2, 1, out.length, PRODUCT_IMAGE_HEADER.length).setValues(out);

  return { feed: out.length - manual.length, manual: manual.length, total: out.length };
}

// ============================== STATUS =====================================

/** How many of THIS month's slide-11 products actually have an image. */
function productImageStatus() {
  applySettings_();
  var map = readProductImages_();
  var range = SpreadsheetApp.getActiveSpreadsheet().getRangeByName('RPT_TOP_ITEMS');

  var lines = [
    'Tab: ' + PRODUCT_IMAGE_SHEET,
    'Mapped products: ' + map.count,
    'Feed URL: ' + (PRODUCT_FEED_URL || 'not set'),
    '',
  ];

  if (!range) {
    lines.push('No RPT_TOP_ITEMS block yet — run Build report first to see which products matter.');
  } else {
    var vals = range.getValues().slice(1);   // [title, item_id, orders, revenue, cost, roas]
    lines.push('Slide 11 products this month:');
    var misses = [];
    for (var i = 0; i < vals.length; i++) {
      var title = String(vals[i][0] || '').trim();
      var id = String(vals[i][1] || '').trim();
      if (!title && !id) continue;
      var url = productImageUrl_(map, id, title);
      lines.push('  ' + (url ? '✓' : '✗') + '  ' + (title || id).slice(0, 60) +
        (url ? '' : '   ← no image; frame keeps its placeholder'));
      if (!url) misses.push({ title: title, id: id });
    }

    // For each miss, show the feed titles that come CLOSEST. A bare "no match" tells
    // you nothing about whether the product is absent from the feed or merely titled
    // differently, and those need opposite fixes.
    if (misses.length) {
      lines.push('');
      lines.push('WHY THOSE MISSED — closest titles in the feed:');
      for (var m = 0; m < misses.length; m++) {
        lines.push('');
        lines.push('  ' + (misses[m].title || misses[m].id));
        lines.push('    looked for key: ' + normTitle_(misses[m].title));
        var near = nearestFeedTitles_(map, misses[m].title, 3);
        if (!near.length) {
          lines.push('    nothing in the feed resembles it — the product is probably absent from ' +
            'the feed entirely. Paste its image_url into the tab by hand.');
        } else {
          for (var n = 0; n < near.length; n++) {
            lines.push('    ' + near[n].shared + ' chars in common:  ' + near[n].key);
          }
          lines.push('    If one of those IS this product, the feed titles it differently — paste ' +
            'this product\'s image_url by hand.');
        }
      }
    }
  }

  lines.push('');
  lines.push('Matching is by TITLE first, then item id. Title wins because a Shopping feed carries ' +
    'one row per size variant and an out-of-stock variant drops out of the feed — so the exact id ' +
    'Google Ads reports may be missing while its sibling sizes, which share the title and the same ' +
    'photo, are present.');
  lines.push('');
  lines.push('A miss you cannot explain: paste that one product\'s image_url into the "' +
    PRODUCT_IMAGE_SHEET + '" tab by hand. Manual rows survive every refresh, so it sticks.');

  tell_('Product image status', lines.join('\n'));
}

/**
 * The feed title keys most similar to `title`, by shared leading characters.
 *
 * Crude on purpose — this is a diagnostic hint, not a matcher. Comparing normalised
 * prefixes is enough to tell the two cases apart that need different fixes: "the
 * feed has this product under a slightly different title" (a long common prefix)
 * versus "this product is not in the feed at all" (nothing close).
 */
function nearestFeedTitles_(map, title, limit) {
  var want = normTitle_(title);
  if (!want) return [];

  var scored = [];
  var keys = Object.keys(map.byTitle);
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i], shared = 0;
    while (shared < k.length && shared < want.length && k.charAt(shared) === want.charAt(shared)) shared++;
    // Below ~12 characters in common it is noise, not a near miss.
    if (shared >= 12) scored.push({ key: k, shared: shared });
  }
  scored.sort(function (a, b) { return b.shared - a.shared; });
  return scored.slice(0, limit);
}


// ============================== FEED DIAGNOSTIC ============================

/**
 * Report what the feed actually looks like, without trying to parse it into the
 * tab.
 *
 * This exists because the parser has to guess at a structure that varies between
 * feed generators — namespaced vs. plain <title>, <item> vs. <entry>, id under
 * <g:id> vs. <g:mpn> vs. a plain <id>. Rather than iterate blind, this prints the
 * first product's element names verbatim so a mismatch is visible in one look.
 */
function diagnoseProductFeed() {
  applySettings_();
  if (!PRODUCT_FEED_URL) {
    tell_('No feed URL set', 'Set PRODUCT_FEED_URL on the "' + SETTINGS_SHEET + '" tab first.');
    return;
  }

  var res;
  try { res = fetchFeed_(PRODUCT_FEED_URL); }
  catch (e) { tell_('Could not fetch the feed', feedFetchHelp_(e)); return; }

  var code = res.getResponseCode();
  var body = res.getContentText();
  var lines = [
    'URL      ' + PRODUCT_FEED_URL,
    'HTTP     ' + code,
    'Size     ' + Math.round(body.length / 1024) + ' KB',
    '',
  ];

  if (code !== 200) {
    lines.push('The feed did not return 200, so nothing else can be checked.');
    lines.push('First 400 characters:');
    lines.push(body.slice(0, 400));
    tell_('Feed diagnostic', lines.join('\n'));
    return;
  }

  var looksXml = /^\s*<\?xml|^\s*<rss|^\s*<feed/i.test(body);
  lines.push('Format   ' + (looksXml ? 'XML' : (body.indexOf('\t') !== -1 ? 'TSV (tab-delimited)' : 'CSV or plain text')));

  if (!looksXml) {
    var firstLine = body.split(/\r?\n/)[0] || '';
    var delim = body.indexOf('\t') !== -1 ? '\t' : ',';
    var header = splitLine_(firstLine, delim).map(function (h) { return String(h).trim(); });
    lines.push('');
    lines.push('Columns (' + header.length + '):');
    lines.push('  ' + header.join(' | '));
    lines.push('');
    lines.push('Looking for an id column among: id, item_id, offer_id, sku');
    lines.push('Looking for an image column among: image_link, image link, image, image_url, image src');
    tell_('Feed diagnostic', lines.join('\n'));
    return;
  }

  // ---- XML: report the real element names ----
  var doc;
  try { doc = XmlService.parse(body); }
  catch (e) {
    lines.push('');
    lines.push('XML PARSE FAILED: ' + e.message);
    lines.push('');
    lines.push('First 400 characters:');
    lines.push(body.slice(0, 400));
    tell_('Feed diagnostic', lines.join('\n'));
    return;
  }

  var root = doc.getRootElement();
  lines.push('Root     <' + root.getName() + '>');

  var nsList = [];
  try {
    nsList.push('default: ' + (root.getNamespace().getURI() || '(none)'));
    var g = root.getNamespace('g');
    if (g) nsList.push('g: ' + g.getURI());
  } catch (e) {}
  lines.push('Namespaces  ' + (nsList.join('   ') || '(none found)'));

  var channel = root.getChild('channel');
  var items = channel ? channel.getChildren('item') : [];
  var itemTag = 'item (under <channel>)';
  if (!items.length) { items = root.getChildren('item'); itemTag = 'item (at root)'; }
  if (!items.length) { items = root.getChildren('entry'); itemTag = 'entry'; }
  if (!items.length) { items = root.getChildren(); itemTag = 'first-level children (fallback)'; }

  lines.push('Products ' + items.length + '   as <' + itemTag + '>');

  if (items.length) {
    var first = items[0];
    var kids = first.getChildren();
    lines.push('');
    lines.push('FIRST PRODUCT — ' + kids.length + ' element(s):');
    for (var i = 0; i < kids.length && i < 40; i++) {
      var k = kids[i];
      var prefix = '';
      try { prefix = k.getNamespace().getPrefix(); } catch (e) {}
      var val = String(k.getText() || '').trim();
      lines.push('  <' + (prefix ? prefix + ':' : '') + k.getName() + '>  ' +
        (val.length > 90 ? val.slice(0, 90) + '…' : val));
    }

    // What the parser would actually extract.
    var gns = XmlService.getNamespace('http://base.google.com/ns/1.0');
    var id = childText_(first, 'id', gns) || childText_(first, 'id', null);
    var title = childText_(first, 'title', gns) || childText_(first, 'title', null);
    var img = childText_(first, 'image_link', gns) || childText_(first, 'image_link', null);
    lines.push('');
    lines.push('WHAT THE PARSER EXTRACTS FROM IT:');
    lines.push('  id          ' + (id || '(nothing found)'));
    lines.push('  title       ' + (title ? title.slice(0, 70) : '(nothing found)'));
    lines.push('  image_link  ' + (img ? img.slice(0, 90) : '(nothing found)'));
    lines.push('');
    lines.push(img
      ? '✓ Images are readable. Run Setup → Refresh product images.'
      : '✗ No image_link found. Send me the element list above and I will fix the parser.');
    if (id) {
      lines.push('');
      lines.push('NOTE: slide 11 matches on this id against the item id in the Google Ads report. ' +
        'If the two use different formats, matching falls back to the exact product title — and ' +
        'Setup → Product image status will show which products resolved.');
    }
  }

  tell_('Feed diagnostic', lines.join('\n'));
}


// ============================== MANUAL ESCAPE HATCH ========================

/**
 * Seed the tab with THIS MONTH's five slide-11 products, ready for five pasted
 * URLs.
 *
 * This exists so product images never depend on the external-request permission.
 * Feed fetching is the convenience; the tab is the actual source of truth, and it
 * can always be filled by hand. Five URLs a month is a minute of work — a
 * perfectly reasonable place to stop if the scope proves troublesome.
 */
function prepareProductImageRows() {
  applySettings_();
  var sheet = ensureProductImageTab_();

  var range = SpreadsheetApp.getActiveSpreadsheet().getRangeByName('RPT_TOP_ITEMS');
  if (!range) {
    tell_('Nothing to prepare yet',
      'Run Monthly Report → Build report first. That produces slide 11\'s product list, which is ' +
      'what this fills in.');
    return;
  }

  var body = range.getValues().slice(1);   // [title, item_id, orders, revenue, cost, roas]
  var existing = readProductImages_();
  var added = [], already = [];

  for (var i = 0; i < body.length; i++) {
    var title = String(body[i][0] || '').trim();
    var itemId = String(body[i][1] || '').trim();
    if (!title && !itemId) continue;
    if (productImageUrl_(existing, itemId, title)) { already.push(title || itemId); continue; }
    // source='manual' so a later feed refresh never overwrites what you paste.
    added.push([itemId, title, '', 'manual']);
  }

  if (!added.length) {
    tell_('Every product already has an image',
      already.length + ' product(s) on slide 11 resolve to an image already. Nothing to add.');
    return;
  }

  var start = Math.max(sheet.getLastRow() + 1, 2);
  sheet.getRange(start, 1, added.length, PRODUCT_IMAGE_HEADER.length).setValues(added);
  sheet.showSheet();
  sheet.activate();
  sheet.setActiveRange(sheet.getRange(start, 3, added.length, 1));

  tell_('Ready for image URLs',
    added.length + ' product(s) added to the "' + PRODUCT_IMAGE_SHEET + '" tab' +
    (already.length ? ' (' + already.length + ' already had an image)' : '') + '.\n\n' +
    'Paste an image URL into the highlighted image_url column for each, then run\n' +
    'Monthly Report → Build report + generate deck.\n\n' +
    'Where to get the URLs: open the product on your own site, right-click the main photo → Copy ' +
    'image address. Any publicly reachable URL works — Slides fetches it directly.\n\n' +
    'These rows are marked source=manual, so a later feed refresh will never overwrite them.');
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
 *   · slide 9's chart, and slide 12's ad-unit screenshot. See docs/GAPS.md.
 *
 * Slide 11 product imagery IS filled, from the `Product Images` tab — the Google
 * Ads API exposes no image URL, so those come from your Shopping feed. See
 * ProductImages.gs.
 *
 * The deck is validated before anything is written: if a table's shape doesn't
 * match the block that feeds it, that table is SKIPPED and reported, rather than
 * half-filled.
 *
 * THE TEMPLATE IS NEVER MODIFIED. writeDeck_ calls makeCopy() and every write
 * goes to the copy; the template is only ever read. The two functions that open
 * the template directly — firstRunCheck and diagValidateDeck — only inspect it
 * (getSlides, getTables, getNumRows) and never saveAndClose. There is also an
 * explicit id check below, so the invariant is enforced rather than merely
 * intended.
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
  applySettings_();
  var ctx = buildReportContext_();
  renderReportTab_(ctx);
  renderCampaignMap_(ctx.mapRows, ctx.classify);
  var url = writeDeck_(ctx);
  tell_('Deck ready', url ? url :
    'Deck generation skipped — DECK_TEMPLATE_ID is not set.\n\n' +
    'Fix it with  Setup → Find the deck template in Drive,  which locates your converted Google ' +
    'Slides deck and writes the id to the "' + SETTINGS_SHEET + '" tab.\n\n' +
    'Set it on that tab, NOT in Config.gs: pasting an updated dist/Code.gs replaces the whole Apps ' +
    'Script project, so a value typed into the code is lost on every update. The Settings tab ' +
    'survives.\n\nThe Report tab was still built, so no work is lost.');
  return url;
}

function writeDeck_(ctx) {
  if (!DECK_TEMPLATE_ID) {
    progress_('DECK_TEMPLATE_ID is not set (see the ' + SETTINGS_SHEET + ' tab) — Report tab built, deck skipped.');
    return '';
  }

  var period = ctx.periods.current;
  var name = CLIENT_NAME + ' — Monthly Review — ' + REGION + ' — ' + period.label;

  progress_('Copying the deck template…');
  var templateFile = DriveApp.getFileById(DECK_TEMPLATE_ID);
  var copy = DECK_OUTPUT_FOLDER_ID
    ? templateFile.makeCopy(name, DriveApp.getFolderById(DECK_OUTPUT_FOLDER_ID))
    : templateFile.makeCopy(name);

  // Belt and braces on the one thing that must never happen. Everything below
  // writes, so if this were ever the template rather than a copy we would be
  // overwriting the master — and the damage is silent, because a filled deck
  // looks fine until next month when the placeholders are gone.
  if (copy.getId() === DECK_TEMPLATE_ID) {
    throw new Error('Refusing to write: the copy resolved to the same file id as DECK_TEMPLATE_ID. ' +
      'The template must never be modified.');
  }

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

  // ---- slide 8 headers, which follow the configured product dimensions ----
  try { fillTableHeaders_(slides, skipped); }
  catch (e) { skipped.push('table headers: ' + e.message); }

  // ---- slide 11 product cards, with imagery ----
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

  var slide = slides[10];
  var shapes = slide.getShapes();
  var names = [], orders = [], revenue = [], frames = [];
  for (var i = 0; i < shapes.length; i++) {
    var text;
    try { text = shapes[i].getText().asString().trim(); } catch (e) { continue; }
    if (/^\[Product Name \d+\]$/.test(text)) names.push(shapes[i]);
    else if (/^Orders\s+—$/.test(text))      orders.push(shapes[i]);
    else if (/^Revenue\s+\$—$/.test(text))   revenue.push(shapes[i]);
    // The image placeholder reads "Product\nImage" in the template.
    else if (/^Product\s+Image$/i.test(text.replace(/\s+/g, ' '))) frames.push(shapes[i]);
  }

  var byLeft = function (a, b) { return a.getLeft() - b.getLeft(); };
  names.sort(byLeft); orders.sort(byLeft); revenue.sort(byLeft); frames.sort(byLeft);

  var n = Math.min(names.length, TOP_ITEM_ROWS, body.length);
  if (!n) { skipped.push('slide 11: no product-name placeholders found'); return; }

  var imageMap = readProductImages_();
  var imagesPlaced = 0, imagesMissing = [];

  for (var k = 0; k < n; k++) {
    var row = body[k] || [];
    var title = String(row[0] || '').trim();
    var itemId = String(row[1] || '').trim();

    names[k].getText().setText(title || '—');
    if (orders[k])  orders[k].getText().setText('Orders  ' + (row[2] === '' ? NA : row[2]));
    if (revenue[k]) revenue[k].getText().setText('Revenue  ' + (row[3] === '' ? NA : row[3]));

    if (!frames[k]) continue;
    var url = productImageUrl_(imageMap, itemId, title);
    if (!url) { imagesMissing.push(title || itemId); continue; }

    // A frame that cannot be filled KEEPS its placeholder. Leaving a visible gap
    // is right: a missing photo is obvious and fixable, whereas the wrong photo
    // beside a product name is not.
    if (insertProductImage_(slide, frames[k], url, skipped, title)) imagesPlaced++;
    else imagesMissing.push(title || itemId);
  }

  if (names.length > n) {
    skipped.push('slide 11: ' + (names.length - n) + ' product card(s) left as placeholders — ' +
      'fewer products had revenue than the deck has cards. Delete the extra cards.');
  }
  if (imagesMissing.length) {
    skipped.push('slide 11: no image for ' + imagesMissing.length + ' product(s) (' +
      imagesMissing.slice(0, 3).join('; ') + (imagesMissing.length > 3 ? ' …' : '') +
      ') — those frames keep their placeholder. Run Setup → Product image status to see why.');
  }
  progress_('Slide 11: ' + n + ' card(s) filled, ' + imagesPlaced + ' image(s) placed.');
}

/**
 * Put one product image inside a placeholder frame, then remove the placeholder.
 *
 * The image is fitted INSIDE the frame preserving its aspect ratio and centred,
 * rather than stretched to the frame's shape. Product shots are near-square and
 * the frames are portrait, so stretching would visibly distort the shoe — which
 * on a client deck is worse than a slightly smaller image.
 */
function insertProductImage_(slide, frame, url, skipped, label) {
  var left = frame.getLeft(), top = frame.getTop();
  var boxW = frame.getWidth(), boxH = frame.getHeight();

  var image;
  try {
    image = slide.insertImage(url);
  } catch (e) {
    // A 404, a login-walled URL, or a format Slides refuses. Report and move on;
    // one bad image must not abandon the rest of the deck.
    skipped.push('slide 11: could not insert image for "' + (label || '?') + '" — ' + e.message +
      ' (the URL must be publicly reachable)');
    return false;
  }

  var natW = image.getWidth(), natH = image.getHeight();
  var scale = (natW > 0 && natH > 0) ? Math.min(boxW / natW, boxH / natH) : 1;
  var w = natW * scale, h = natH * scale;

  image.setWidth(w).setHeight(h);
  image.setLeft(left + (boxW - w) / 2).setTop(top + (boxH - h) / 2);

  try { frame.remove(); } catch (e) { /* leave it behind the image if it won't delete */ }
  return true;
}

/**
 * Which deck tables have headers that must FOLLOW the data rather than stay as the
 * template wrote them, and what heading text the slide should carry.
 *
 *   slide 8  — the two product dimensions are configurable, so "Product Type (1st)"
 *              over a Custom Label 1 column is a lie the template cannot know about.
 *   slide 10 — became a non-brand search TERMS table; the template still says
 *              "Search Categories", which is a different question.
 *
 * `titleWas` is matched loosely against the slide's text shapes so a heading is only
 * replaced when it is still the template's original wording.
 */
function headerPlan_() {
  return [
    { slide: 8,  pick: 0, range: 'RPT_PRODUCT',  cols: 2 },
    { slide: 10, pick: 0, range: 'RPT_PMAX_CAT', cols: 8,
      titleWas: /search\s*categor/i, titleIs: 'Performance Max  |  Non-Brand Search Terms' },
  ];
}

/**
 * Rewrite header cells (and where needed the slide heading) from the block's own
 * header row.
 *
 * The table writer only fills DATA rows, so without this the deck keeps the
 * template's headings over columns that now mean something else. A mislabelled
 * column is far worse than an empty one, because nothing looks wrong.
 *
 * Labels come from the RPT_* block's header row rather than being recomputed here,
 * so they follow whatever the render function decided the rows actually describe.
 * Two places computing a heading is how they end up disagreeing.
 */
function fillTableHeaders_(slides, skipped) {
  var plan = headerPlan_();
  for (var p = 0; p < plan.length; p++) {
    var step = plan[p];
    if (slides.length < step.slide) continue;
    var slide = slides[step.slide - 1];

    var block = namedDisplayValues_(step.range);
    if (!block || !block.length) {
      skipped.push('slide ' + step.slide + ': ' + step.range + ' is missing, headers left as-is');
      continue;
    }
    var labels = block[0];

    var tables = slide.getTables().slice().sort(function (a, b) { return a.getTop() - b.getTop(); });
    if (tables.length <= step.pick) {
      skipped.push('slide ' + step.slide + ': no table to relabel');
      continue;
    }

    var table = tables[step.pick];
    var n = Math.min(step.cols, labels.length, table.getNumColumns());
    try {
      for (var c = 0; c < n; c++) {
        table.getCell(0, c).getText().setText(String(labels[c]));
      }
      progress_('Slide ' + step.slide + ': ' + n + ' header(s) set from ' + step.range + '.');
    } catch (e) {
      skipped.push('slide ' + step.slide + ': could not relabel headers — ' + e.message);
    }

    if (step.titleWas) retitleSlide_(slide, step, skipped);
  }
}

/**
 * Replace a slide's heading when the template's wording no longer describes the
 * table under it.
 *
 * Only rewrites a shape still carrying the ORIGINAL wording, so running this over an
 * already-generated deck cannot mangle a heading twice, and a template someone has
 * retitled by hand is left alone.
 */
function retitleSlide_(slide, step, skipped) {
  var shapes = slide.getShapes(), hit = false;
  for (var s = 0; s < shapes.length; s++) {
    var text;
    try { text = shapes[s].getText().asString(); } catch (e) { continue; }
    if (!text || !step.titleWas.test(text)) continue;
    try {
      shapes[s].getText().setText(step.titleIs);
      hit = true;
      progress_('Slide ' + step.slide + ': heading set to "' + step.titleIs + '".');
      break;
    } catch (e2) {
      skipped.push('slide ' + step.slide + ': could not retitle — ' + e2.message);
      return;
    }
  }
  // Not an error worth flagging loudly: the heading may already read correctly.
  if (!hit) progress_('Slide ' + step.slide + ': heading already updated or not found; left as-is.');
}


// ==========================================================================
// SOURCE FILE: apps-script/Webhook.gs
// ==========================================================================

/**
 * Xero Shoes — Monthly Report  ·  WEBHOOK RECEIVER
 * =============================================================================
 * Accepts engine rows POSTed from outside Google — currently the Microsoft
 * Advertising Script in microsoft-ads-script/engine-report-bing.js.
 *
 * WHY A WEBHOOK RATHER THAN THE SHEETS API
 * -----------------------------------------------------------------------------
 * Microsoft Advertising Scripts can call the Google Sheets API, but only with a
 * Google Cloud OAuth client id, secret and refresh token stored inside the Bing
 * script. That is a credential to create, rotate and leak.
 *
 * Microsoft Scripts do have UrlFetchApp, so they can POST here instead. No
 * Google OAuth client, no refresh token, and every line that writes to the
 * spreadsheet stays in this project — which means the tab schema has exactly one
 * owner.
 *
 * SECURITY, STATED PLAINLY
 * -----------------------------------------------------------------------------
 * A Web App reachable by "Anyone" is required, because Microsoft's script cannot
 * present a Google identity. Two things guard it:
 *
 *   · the /exec URL is long and unguessable
 *   · a shared secret in the BING_WEBHOOK_SECRET script property, compared on
 *     every request
 *
 * Worst case if the URL and secret both leak: someone writes junk ad metrics into
 * one hidden tab, which a re-run overwrites. This endpoint cannot read the
 * spreadsheet, cannot touch any other tab, and cannot run any other function.
 * That is an acceptable trade for removing an OAuth client — but rotate the
 * secret if you ever share the script's source outside the team.
 */

// Written only by this receiver. Read alongside _eng_day and _eng_manual.
var ENGINE_WEBHOOK_SHEET = '_eng_bing';
var WEBHOOK_SECRET_PROP  = 'BING_WEBHOOK_SECRET';

// Column order for the tab this writes. Superset of _eng_day, plus `grain`.
var WEBHOOK_HEADER = ['date', 'grain', 'channel', 'account', 'campaign_id', 'campaign',
                      'channel_type', 'channel_sub_type', 'labels', 'impressions', 'clicks',
                      'cost', 'conversions', 'conversions_value', 'search_impression_share'];

// ============================== ENTRY POINT ================================

/**
 * Every response is 200 with a JSON body carrying `ok`. Apps Script turns a
 * thrown error into an HTML page, which is useless to a caller parsing JSON —
 * so failures are caught and reported as `{ok: false, error: …}` instead.
 */
function doPost(e) {
  try {
    return jsonOut_(handlePost_(e));
  } catch (err) {
    try { progress_('Webhook error: ' + err.message); } catch (ignored) {}
    return jsonOut_({ ok: false, error: String(err && err.message || err) });
  }
}

/** A GET is only ever a human checking the URL is live. It reveals nothing. */
function doGet() {
  return jsonOut_({
    ok: true,
    service: 'xero-monthly-report webhook',
    region: REGION,
    hint: 'POST engine rows here. See microsoft-ads-script/engine-report-bing.js.',
  });
}

function handlePost_(e) {
  applySettings_();
  if (!e || !e.postData || !e.postData.contents) {
    return { ok: false, error: 'No POST body.' };
  }

  var body;
  try { body = JSON.parse(e.postData.contents); }
  catch (err) { return { ok: false, error: 'Body is not valid JSON: ' + err.message }; }

  var expected = PropertiesService.getScriptProperties().getProperty(WEBHOOK_SECRET_PROP);
  if (!expected) {
    return { ok: false, error: 'The ' + WEBHOOK_SECRET_PROP + ' script property is not set in this ' +
      'Apps Script project, so no request can be authenticated. Project Settings → Script ' +
      'Properties → add it, then use the same value as WEBHOOK_SECRET in the Bing script.' };
  }
  if (!body.secret || !constantTimeEquals_(String(body.secret), String(expected))) {
    return { ok: false, error: 'Bad or missing secret.' };
  }

  var rows = body.rows;
  if (!rows || !rows.length) return { ok: true, written: 0, replaced: false, note: 'No rows in batch.' };

  var channel = String(body.channel || '').trim();
  if (!channel) return { ok: false, error: 'Payload has no `channel`.' };
  if (TW_ADS_CHANNELS.indexOf(channel) === -1) {
    return { ok: false, error: 'Channel "' + channel + '" is not in TW_ADS_CHANNELS (' +
      TW_ADS_CHANNELS.join(', ') + '), so rows for it would be read by nothing. Fix the channel ' +
      'in the sending script, or add it to Config.gs.' };
  }

  // Serialise: two batches arriving together must not interleave their writes.
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return { ok: false, error: 'Busy — another batch holds the lock. Retry.' };

  try {
    var replaced = false;
    if (body.replace) {
      // Idempotent re-runs: clear exactly the (channel, months) this push covers,
      // then append. A month whose spend has gone to zero is therefore removed
      // rather than left stale, and re-running never doubles anything.
      clearChannelMonths_(channel, body.months || []);
      replaced = true;
    }
    var written = appendWebhookRows_(rows);
    progress_('Webhook: ' + written + ' ' + channel + ' row(s) received from ' +
      (body.source || 'unknown') + (replaced ? ' (months reset first)' : '') + '.');
    return { ok: true, written: written, replaced: replaced };
  } finally {
    lock.releaseLock();
  }
}

// ============================== SHEET WRITES ===============================

function webhookSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(ENGINE_WEBHOOK_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(ENGINE_WEBHOOK_SHEET);
    sheet.getRange(1, 1, 1, WEBHOOK_HEADER.length).setValues([WEBHOOK_HEADER]).setFontWeight('bold');
    sheet.setFrozenRows(1);
    sheet.hideSheet();
  }
  // Header may be missing if someone cleared the tab by hand.
  if (sheet.getLastRow() < 1 || !String(sheet.getRange(1, 1).getValue()).trim()) {
    sheet.getRange(1, 1, 1, WEBHOOK_HEADER.length).setValues([WEBHOOK_HEADER]).setFontWeight('bold');
  }
  return sheet;
}

/** Drop rows for one channel in the given months, keeping everything else. */
function clearChannelMonths_(channel, months) {
  var sheet = webhookSheet_();
  if (sheet.getLastRow() < 2) return 0;

  var keepMonth = {};
  for (var i = 0; i < months.length; i++) keepMonth[String(months[i])] = true;

  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, WEBHOOK_HEADER.length).getValues();
  var kept = [];
  for (var r = 0; r < values.length; r++) {
    var date = String(values[r][0] || '');
    var ch = String(values[r][2] || '');
    if (!date) continue;
    var inScope = (ch === channel) && keepMonth[date.slice(0, 7)];
    if (!inScope) kept.push(values[r]);
  }

  sheet.getRange(2, 1, values.length, WEBHOOK_HEADER.length).clearContent();
  if (kept.length) sheet.getRange(2, 1, kept.length, WEBHOOK_HEADER.length).setValues(kept);
  return values.length - kept.length;
}

function appendWebhookRows_(rows) {
  var sheet = webhookSheet_();
  var grid = [];

  for (var i = 0; i < rows.length; i++) {
    var r = rows[i] || {};
    var date = normDate_(r.date);
    if (!date) continue;                     // a row with no date can never be matched
    var line = [];
    for (var c = 0; c < WEBHOOK_HEADER.length; c++) {
      var key = WEBHOOK_HEADER[c];
      var v = r[key];
      line.push(v === undefined || v === null ? '' : v);
    }
    line[0] = date;
    // Default the grain rather than trusting the sender to send it: an unlabelled
    // row treated as daily would be matched by date range, and a monthly total
    // matched that way can be absorbed whole into a narrower window.
    line[1] = String(r.grain || 'day').toLowerCase() === 'month' ? 'month' : 'day';
    grid.push(line);
  }

  if (!grid.length) return 0;
  var start = Math.max(sheet.getLastRow() + 1, 2);
  sheet.getRange(start, 1, grid.length, WEBHOOK_HEADER.length).setValues(grid);
  // Dates as text, matching every other tab in this project.
  sheet.getRange(start, 1, grid.length, 1).setNumberFormat('@');
  return grid.length;
}

// ============================== HELPERS ====================================

/** Length-independent comparison, so a mismatch leaks nothing through timing. */
function constantTimeEquals_(a, b) {
  if (a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) diff |= (a.charCodeAt(i) ^ b.charCodeAt(i));
  return diff === 0;
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================== SETUP HELPERS ==============================

/**
 * Generate and store a webhook secret, and print what the Bing script needs.
 * Run from the menu: Setup → Set up the Bing webhook.
 */
function setupBingWebhook() {
  var props = PropertiesService.getScriptProperties();
  var existing = props.getProperty(WEBHOOK_SECRET_PROP);
  var secret = existing;

  if (!secret) {
    secret = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 16);
    props.setProperty(WEBHOOK_SECRET_PROP, secret);
  }

  tell_(existing ? 'Bing webhook — already configured' : 'Bing webhook — secret created',
    (existing
      ? 'A secret already exists. Reusing it rather than rotating, so any Bing script already ' +
        'configured keeps working.\n\n'
      : 'A new secret has been generated and saved to the ' + WEBHOOK_SECRET_PROP +
        ' script property.\n\n') +
    'WEBHOOK_SECRET:\n' + secret + '\n\n' +
    '— — —\n\n' +
    'Now publish this project as a Web App, if you have not already:\n\n' +
    '  1. Apps Script editor → Deploy → New deployment\n' +
    '  2. Type: Web app\n' +
    '  3. Execute as: Me\n' +
    '  4. Who has access: Anyone      ← required; Microsoft cannot present a Google identity\n' +
    '  5. Deploy, then copy the URL ending in /exec\n\n' +
    'Paste that URL and the secret above into CONFIG at the top of ' +
    'microsoft-ads-script/engine-report-bing.js.\n\n' +
    'Re-deploy (Deploy → Manage deployments → edit → Version: New version) after any code change, ' +
    'or the Web App keeps serving the old code.');
}

/** Confirm what the receiver currently holds. */
function bingWebhookStatus() {
  applySettings_();
  var props = PropertiesService.getScriptProperties();
  var hasSecret = !!props.getProperty(WEBHOOK_SECRET_PROP);
  var rows = readEngineTab_(ENGINE_WEBHOOK_SHEET);

  var byChannel = {}, byMonth = {}, grains = {};
  rows.forEach(function (r) {
    var ch = String(r.channel || '?');
    byChannel[ch] = (byChannel[ch] || 0) + 1;
    byMonth[String(r.date || '').slice(0, 7)] = true;
    grains[String(r.grain || 'day')] = (grains[String(r.grain || 'day')] || 0) + 1;
  });
  var months = Object.keys(byMonth).filter(String).sort();

  tell_('Bing webhook status',
    'Secret set: ' + (hasSecret ? 'yes' : 'NO — run Setup → Set up the Bing webhook') + '\n' +
    'Tab: ' + ENGINE_WEBHOOK_SHEET + '\n' +
    'Rows: ' + rows.length + '\n' +
    'Channels: ' + (Object.keys(byChannel).map(function (c) { return c + ' (' + byChannel[c] + ')'; }).join(', ') || 'none') + '\n' +
    'Grain: ' + (Object.keys(grains).map(function (g) { return g + ' (' + grains[g] + ')'; }).join(', ') || 'none') + '\n' +
    'Months: ' + (months.length ? months[0] + ' → ' + months[months.length - 1] + '  (' + months.length + ')' : 'none') + '\n\n' +
    (rows.length
      ? 'These rows are read alongside _eng_day. Monthly-grain rows are matched by MONTH, never by ' +
        'date range, so they cannot be absorbed into a narrower window such as a promo.'
      : 'Nothing received yet. Run the Microsoft Advertising Script and check its log.'));
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
  applySettings_();
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
  var tabs = [ENGINE_DAY_SHEET, ENGINE_PRODUCT_SHEET, ENGINE_PMAXTERM_SHEET, ENGINE_PMAXCAT_SHEET,
              ENGINE_ITEM_SHEET, ENGINE_ASSET_SHEET, PRODUCT_DIMS_SHEET];
  for (var t = 0; t < tabs.length; t++) {
    var rows = readEngineTab_(tabs[t]);
    lines.push('  ' + tabs[t] + ': ' + (rows.length ? rows.length + ' rows' : 'empty / absent'));
  }

  lines.push('');
  lines.push('MANUAL INPUT TABS');
  lines.push('  ' + AUCTION_SHEET + ': ' + readEngineTab_(AUCTION_SHEET).length + ' rows');
  lines.push('  ' + PMAXCAT_MANUAL_SHEET + ': ' + readEngineTab_(PMAXCAT_MANUAL_SHEET).length + ' rows');
  lines.push('  ' + PROMO_SHEET + ': ' + readEngineTab_(PROMO_SHEET).length + ' rows');

  tell_('Data sources', lines.join('\n'));
}

/**
 * What each product dimension actually CONTAINS — the answer to "which two should
 * slide 8 use?".
 *
 * Custom labels are free text the Shopping feed sets, so no amount of reading
 * Google's docs reveals whether label 1 holds a category or the single word
 * "shoes". Guessing costs a full round trip (edit config → re-run the MCC script →
 * rebuild → look at the deck) and the answer is only visible at the end of it.
 * This turns that into reading one screen.
 *
 * Ranks by how useful each dimension looks — several distinct values, little
 * "(not set)" — and recommends the top two, but shows the values so you can
 * overrule it on judgement rather than on the score.
 */
function diagProductDims() {
  applySettings_();
  var raw = readEngineTab_(PRODUCT_DIMS_SHEET);

  if (!raw.length) {
    tell_('No dimension data yet',
      'The "' + PRODUCT_DIMS_SHEET + '" tab is empty or absent.\n\n' +
      'It is written by the MCC Google Ads Script (google-ads-script/engine-report.js). If you ' +
      'installed that script before this feature existed, re-paste it and Run — it probes every ' +
      'product dimension and writes what each one contains.\n\n' +
      'Currently configured for slide 8:\n  ' +
      PRODUCT_DIM_1.field + '  (' + PRODUCT_DIM_1.label + ')\n  ' +
      PRODUCT_DIM_2.field + '  (' + PRODUCT_DIM_2.label + ')');
    return;
  }

  // dimension → { values: [{value, cost, conv_value}], cost, notSetCost }
  var dims = {}, order = [];
  for (var i = 0; i < raw.length; i++) {
    var r = raw[i];
    var d = String(r.dimension || '').trim();
    if (!d) continue;
    if (!dims[d]) { dims[d] = { name: d, values: [], cost: 0, notSetCost: 0 }; order.push(d); }
    var value = String(r.value === undefined || r.value === null ? '' : r.value).trim() || '(not set)';
    var cost = num_(r.cost), cv = num_(r.conversions_value);
    dims[d].values.push({ value: value, cost: cost, cv: cv });
    dims[d].cost += cost;
    if (value === '(not set)') dims[d].notSetCost += cost;
  }

  var scored = order.map(function (d) {
    var x = dims[d];
    var real = x.values.filter(function (v) { return v.value !== '(not set)'; });
    // A dimension is useful when it SPLITS spend. One value splits nothing; a
    // hundred values (item id, title) splits it past the point a 16-row slide can
    // show. Mostly "(not set)" means the feed never populated it.
    var distinct = real.length;
    var coverage = x.cost > 0 ? (x.cost - x.notSetCost) / x.cost : 0;
    var spread = distinct <= 1 ? 0 : (distinct <= 40 ? 1 : 0.4);
    x.distinct = distinct;
    x.coverage = coverage;
    x.score = spread * coverage * (distinct <= 1 ? 0 : 1);
    x.top = real.sort(function (a, b) { return b.cost - a.cost; }).slice(0, 6);
    return x;
  }).sort(function (a, b) { return b.score - a.score || b.distinct - a.distinct; });

  var money = function (n) { return '$' + Math.round(n).toLocaleString('en-US'); };
  var lines = [];
  lines.push('Currently on slide 8:  ' + PRODUCT_DIM_1.field + '  ×  ' + PRODUCT_DIM_2.field);
  lines.push('');

  var usable = scored.filter(function (x) { return x.score > 0; });
  if (usable.length >= 2) {
    lines.push('SUGGESTED:  PRODUCT_DIM_1 = ' + usable[0].name +
      '     PRODUCT_DIM_2 = ' + usable[1].name);
  } else if (usable.length === 1) {
    lines.push('SUGGESTED:  PRODUCT_DIM_1 = ' + usable[0].name +
      '   — only one dimension in this feed splits spend usefully. Pair it with anything below.');
  } else {
    lines.push('⚠  No dimension in this feed splits spend usefully — every one is either a single ' +
      'value or unpopulated. Slide 8 may need product_type_l1 from a feed change, or to become an ' +
      'item-level table.');
  }
  lines.push('');
  lines.push('Set them on the Settings tab, then RE-RUN THE MCC SCRIPT and rebuild. The Google Ads ' +
    'script reads those same cells, so there is no code to edit.');
  lines.push('');

  for (var s = 0; s < scored.length; s++) {
    var x = scored[s];
    lines.push(x.name + '   ' + x.distinct + ' value(s), ' +
      Math.round(x.coverage * 100) + '% of spend populated' +
      (x.score > 0 ? '' : '   ← not usable'));
    if (!x.top.length) { lines.push('     (nothing populated)'); continue; }
    for (var v = 0; v < x.top.length; v++) {
      lines.push('     ' + x.top[v].value + '  —  ' + money(x.top[v].cost) + ' cost, ' +
        money(x.top[v].cv) + ' conv. value');
    }
    if (x.distinct > x.top.length) lines.push('     … and ' + (x.distinct - x.top.length) + ' more');
  }

  tell_('Product dimensions in your feed', lines.join('\n'));
}

function diagCoverage() {
  applySettings_();
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
  applySettings_();
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
  applySettings_();
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
  applySettings_();
  if (!DECK_TEMPLATE_ID) {
    tell_('Deck template', 'DECK_TEMPLATE_ID is not set. Run Setup → Find the deck template in ' +
      'Drive, or set it by hand on the "' + SETTINGS_SHEET + '" tab.');
    return;
  }

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
  applySettings_();
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
  applySettings_();
  var t = newAsserter_();
  var ctx = buildReportContext_();

  // Has a report ever been written to this spreadsheet?
  //
  // Checks A, C and F read the Report tab's OUTPUT; the rest recompute from
  // source. Running the self-test before a first successful build therefore used
  // to emit twenty identical "missing — run Build report first" failures, which
  // buries the one instruction that matters under a wall of red. Say it once.
  var built = false;
  var existing = SpreadsheetApp.getActiveSpreadsheet().getNamedRanges();
  for (var n = 0; n < existing.length; n++) {
    if (existing[n].getName().indexOf('RPT_') === 0) { built = true; break; }
  }

  checkDeckContract_(t);
  if (built) {
    checkShapes_(t);
  } else {
    t.section('A / C / F · Report tab output — SKIPPED');
    t.note('No RPT_* named range exists, so no report has been built in this spreadsheet yet.');
    t.note('→  Run  Monthly Report → Build report,  then run this self-test again.');
    t.note('Everything below checks the computation from source data and is still meaningful.');
  }
  checkSpine_(t, ctx);
  checkPartitions_(t, ctx);
  if (built) checkWrittenDeltas_(t);
  checkDerivedRatios_(t, ctx);
  checkRatiosHaveComponents_(t, ctx);
  if (built) checkCampaignMap_(t, ctx);
  reportCoverage_(t, ctx);

  if (!built) {
    t.lines.push('');
    t.lines.push('NOTE: the output checks were skipped because nothing has been built yet. ' +
      'Run Build report and re-run to get the full ' + '~130' + ' checks.');
  }

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

  checkProductDims_(t);
  checkLoosePasteParsing_(t);
  checkBrandTerms_(t);
}

/**
 * Slide 10's brand-term filter.
 *
 * The regex decides what the slide is ABOUT. Too loose and it strips the discovery
 * terms the slide exists to show; too tight and brand traffic dominates a table
 * labelled non-brand. Both failures render perfectly, so pin the boundary.
 */
function checkBrandTerms_(t) {
  var brand = ['xero shoes', 'xeroshoes', 'xero', 'zero shoes', 'zeroshoes',
               'xero shoes prio', 'buy xero shoes online', 'XERO SHOES'];
  var nonBrand = ['barefoot shoes', 'minimalist running shoes', 'wide toe box sandals',
                  'zero drop boots', 'prio', 'hfs womens'];

  var wrong = [];
  for (var i = 0; i < brand.length; i++) {
    if (!BRAND_TERM_RE.test(brand[i])) wrong.push('missed brand: "' + brand[i] + '"');
  }
  for (var j = 0; j < nonBrand.length; j++) {
    if (BRAND_TERM_RE.test(nonBrand[j])) wrong.push('wrongly brand: "' + nonBrand[j] + '"');
  }
  t.ok('BRAND_TERM_RE splits brand from non-brand', wrong.length === 0, wrong.join('; '));

  // "zero drop" is Xero's own product category and appears in genuine non-brand
  // queries. A regex matching bare "zero" would swallow it — and swallow the single
  // most on-topic non-brand term on the slide.
  t.ok('"zero drop" is not treated as brand', !BRAND_TERM_RE.test('zero drop running shoes'));
  // Model names stay non-brand, on purpose and by decision — assert it so the choice
  // cannot drift silently.
  t.ok('model names stay non-brand', !BRAND_TERM_RE.test('prio') && !BRAND_TERM_RE.test('hfs'));
}

/**
 * Slide 8's two dimensions.
 *
 * These are settable from a spreadsheet cell, and a cell that fails to resolve
 * falls back silently to the Config.gs default — so the failure mode is a slide
 * headed and segmented by a dimension nobody chose. Pin the resolver instead of
 * trusting it.
 */
function checkProductDims_(t) {
  t.ok('PRODUCT_DIM_1 is a real product dimension', !!resolveProductDim_(PRODUCT_DIM_1.field),
    PRODUCT_DIM_1.field + ' is not in PRODUCT_DIM_VOCAB');
  t.ok('PRODUCT_DIM_2 is a real product dimension', !!resolveProductDim_(PRODUCT_DIM_2.field),
    PRODUCT_DIM_2.field + ' is not in PRODUCT_DIM_VOCAB');

  // Both columns showing the same dimension is a table that breaks nothing down.
  t.ok('the two dimensions differ', PRODUCT_DIM_1.field !== PRODUCT_DIM_2.field,
    'both are ' + PRODUCT_DIM_1.field);

  // Every field in the vocabulary must round-trip, because the Google Ads script
  // has its own copy of this resolver and either side may be given the other's
  // output. A field one accepts and the other rejects means the Ads script queries
  // one dimension while the deck labels another.
  var bad = [];
  for (var i = 0; i < PRODUCT_DIM_VOCAB.length; i++) {
    var field = PRODUCT_DIM_VOCAB[i][0];
    var got = resolveProductDim_(field);
    if (!got || got.field !== field) bad.push(field);
    var byLabel = resolveProductDim_(PRODUCT_DIM_VOCAB[i][1]);
    if (!byLabel || byLabel.field !== field) bad.push(PRODUCT_DIM_VOCAB[i][1]);
  }
  t.ok('every dimension resolves from its field AND its UI label', bad.length === 0, bad.join(', '));

  // The shorthand a person actually types into a cell.
  t.ok('"Custom label 4" resolves', (resolveProductDim_('Custom label 4') || {}).field ===
    'product_custom_attribute4');
  t.ok('"cl4" resolves', (resolveProductDim_('cl4') || {}).field === 'product_custom_attribute4');
  t.ok('"product_type_l1" resolves', (resolveProductDim_('product_type_l1') || {}).field ===
    'product_type_l1');
  t.ok('"l2" resolves', (resolveProductDim_('l2') || {}).field === 'product_type_l2');
  t.ok('"brand" resolves', (resolveProductDim_('brand') || {}).field === 'product_brand');

  // And must REJECT, so a typo falls back visibly rather than resolving to
  // something adjacent. cl5 does not exist; label 6 does not exist.
  t.ok('a non-existent dimension is rejected', resolveProductDim_('cl5') === null);
  t.ok('nonsense is rejected', resolveProductDim_('shoes') === null);
  t.ok('empty is rejected', resolveProductDim_('') === null);

  // productDimsOf_ must prefer what the tab recorded, so the columns are always
  // headed for the data present rather than for the current configuration.
  var stamped = productDimsOf_([{ dim1_field: 'product_type_l1', dim2_field: 'product_brand' }]);
  t.ok('the engine tab\'s own dim fields win over the config',
    stamped[0].field === 'product_type_l1' && stamped[1].field === 'product_brand',
    stamped[0].field + ' / ' + stamped[1].field);
  var shouldWarn = PRODUCT_DIM_1.field !== 'product_type_l1' ||
                   PRODUCT_DIM_2.field !== 'product_brand';
  t.ok('a config/tab mismatch is reported, not hidden',
    shouldWarn === (stamped.mismatchNote.length > 0),
    shouldWarn ? 'expected a warning, got none' : 'warned when config and tab agree');
  var unstamped = productDimsOf_([{ dim1: 'x', dim2: 'y' }]);
  t.ok('a pre-stamp engine tab falls back to the configured labels',
    unstamped[0].field === PRODUCT_DIM_1.field && unstamped.mismatchNote === '');
}

/**
 * The pasted-export number parser.
 *
 * A Google Ads download carries thousands separators and currency symbols, which
 * Number() turns into NaN — and one NaN summed into a column is a wrong slide with
 * nothing visibly broken. Cheap to assert, so assert it.
 */
function checkLoosePasteParsing_(t) {
  t.ok('a thousands separator parses', numLoose_('1,234') === 1234);
  t.ok('a currency symbol parses', numLoose_('$1,234.56') === 1234.56);
  t.ok('a percentage becomes a ratio', numLoose_('12.5%') === 0.125);
  t.ok('Google\'s em-dash blank is zero, not NaN', numLoose_('—') === 0);
  t.ok('an empty cell is zero', numLoose_('') === 0);
  t.ok('a real number passes through', numLoose_(42.5) === 42.5);
  t.ok('a negative parses', numLoose_('-17') === -17);
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

  // CHANNELS MUST PARTITION THE BLENDED TOTAL. If a channel were ever dropped —
  // by a classifier change, a coverage bug, or a channel id that stopped matching
  // TW_ADS_CHANNELS — every table would still render and still be internally
  // consistent, just quietly missing that channel's spend. This is the assertion
  // that notices.
  ['current', 'prior', 'yoy'].forEach(function (pk) {
    var b = derive_(ctx.segments.blended[pk]);
    if (b.cost === null) return;
    var chans = Object.keys(ctx.channelSegments);
    ['cost', 'impressions', 'clicks', 'tw_revenue'].forEach(function (metric) {
      var sum = 0;
      for (var i = 0; i < chans.length; i++) sum += num_(derive_(ctx.channelSegments[chans[i]][pk])[metric]);
      t.near(pk + ': channels sum to Blended ' + metric, sum, num_(b[metric]));
    });
  });
  t.note('channels present: ' + Object.keys(ctx.channelSegments).join(', ') +
    '  (ChatGPT Ads is reported separately on slide 13)');

  // NO CHANNEL MAY BE SILENTLY EXCLUDED.
  //
  // The partition check above cannot catch this: remove a channel from
  // TW_ADS_CHANNELS and it vanishes from blended AND from the channel list, so the
  // sums still close perfectly while real spend has left the report entirely.
  // The only way to notice is to compare config against what the SOURCE holds.
  var sourceChannels = {};
  for (var si = 0; si < ctx.twMeta.rows.length; si++) sourceChannels[ctx.twMeta.rows[si].channel] = true;
  for (var ei = 0; ei < ctx.engRows.length; ei++) sourceChannels[ctx.engRows[ei].channel] = true;

  var orphaned = Object.keys(sourceChannels).filter(function (ch) {
    return ch && TW_ADS_CHANNELS.indexOf(ch) === -1 && TW_OPENAI_CHANNELS.indexOf(ch) === -1;
  });
  t.ok('every channel in the source data is claimed by Config.gs',
    orphaned.length === 0,
    'these carry spend but appear in neither TW_ADS_CHANNELS nor TW_OPENAI_CHANNELS, so they are ' +
    'excluded from every table: ' + orphaned.join(', '));

  // MONTHLY-GRAIN SAFETY. Microsoft Advertising Scripts have no report query
  // surface, so Bing history arrives as whole-month totals dated the 1st. Such a
  // row must be matched by MONTH and never by date range — otherwise a five-day
  // promo starting on the 1st would absorb an entire month of Bing spend and
  // report a catastrophic promo ROAS on a client slide.
  var monthRow = [{ date: '2026-07-01', grain: 'month', channel: 'bing', spend: 22312 }];
  var dayRow   = [{ date: '2026-07-01', grain: 'day',   channel: 'bing', spend: 700 }];
  var wholeMonth = { month: '2026-07', start: '2026-07-01', end: '2026-07-31' };
  var promoWindow = { start: '2026-07-01', end: '2026-07-05' };   // no `month` — sub-month

  t.ok('a monthly row IS matched by its own month',
    rowsInPeriod_(monthRow, wholeMonth).length === 1);
  t.ok('a monthly row is NOT matched by a sub-month window',
    rowsInPeriod_(monthRow, promoWindow).length === 0,
    'matched ' + rowsInPeriod_(monthRow, promoWindow).length + ' row(s) — a promo would absorb a ' +
    'whole month of spend');
  t.ok('a monthly row is NOT matched by a different month',
    rowsInPeriod_(monthRow, { month: '2026-06', start: '2026-06-01', end: '2026-06-30' }).length === 0);
  t.ok('a daily row IS still matched by a sub-month window',
    rowsInPeriod_(dayRow, promoWindow).length === 1);

  // Promo windows read Triple Whale, not the engine, so monthly rows cannot reach
  // them at all. Belt and braces: the assertions above hold even if that changes.
  var monthlyRows = 0;
  for (var mi = 0; mi < ctx.engRows.length; mi++) if (ctx.engRows[mi].grain === 'month') monthlyRows++;
  if (monthlyRows) {
    t.note(monthlyRows + ' engine row(s) are whole-month totals (Bing history). They contribute to ' +
      'the month tables and are invisible to promo windows, by design.');
  }

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

function checkCampaignMap_(t, ctx) {
  t.section('F · Campaign Map integrity');
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MAP_SHEET);
  var noData = !ctx.twCoverage.current && !ctx.engCoverage.current;

  if (!sheet || sheet.getLastRow() < 2) {
    // An empty map is CORRECT when the report month has no campaigns in it. Only
    // an empty map for a month that does have data means something went wrong.
    if (noData) {
      t.note(MAP_SHEET + ' is empty because ' + ctx.periods.current.label + ' has no data from ' +
        'either source — expected, not a failure.');
    } else {
      t.ok(MAP_SHEET + ' populated', false, 'empty, but ' + ctx.periods.current.label +
        ' has data — run Build report');
    }
    return;
  }

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
 * SETUP: docs/SETUP.md.  Run Setup → Settings to fill in the ids, then
 * Setup → First-run check. Settings live on a spreadsheet TAB, not in Config.gs,
 * so pasting an updated dist/Code.gs never disturbs them.
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
      .addItem('Settings (IDs, region, month)', 'openSettings')
      .addItem('Find the deck template in Drive', 'findDeckTemplate')
      .addSeparator()
      .addItem('First-run check (verify config + sources)', 'firstRunCheck')
      .addItem('Create the manual input tabs', 'createInputTabs')
      .addSeparator()
      .addItem('Refresh product images (slide 11)', 'refreshProductImages')
      .addItem('Product image status', 'productImageStatus')
      .addItem('Diagnose the product feed', 'diagnoseProductFeed')
      .addItem('Prepare product image rows (paste URLs by hand)', 'prepareProductImageRows')
      .addSeparator()
      .addItem('Set up the Bing webhook', 'setupBingWebhook')
      .addItem('Bing webhook status', 'bingWebhookStatus'))
    .addSubMenu(ui.createMenu('Automation')
      .addItem('Set up / repair monthly run', 'setupAutomation')
      .addItem('Automation status', 'automationStatus')
      .addItem('Remove all automation', 'removeAllAutomation'))
    .addSubMenu(ui.createMenu('Diagnostics')
      .addItem('Check data sources', 'diagCheckSources')
      .addItem('Show period coverage', 'diagCoverage')
      .addItem('Show classification summary', 'diagClassification')
      .addItem('Show product dimensions (slide 8)', 'diagProductDims')
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
  applySettings_();
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
  applySettings_();
  var ctx = buildReportContext_();
  renderReportTab_(ctx);
  renderCampaignMap_(ctx.mapRows, ctx.classify);
  return writeDeck_(ctx);
}

/** Build for an arbitrary month without editing Config.gs. */
function buildForMonthPrompt() {
  applySettings_();
  var answer = ask_('Report a specific month',
    'Enter the month as yyyy-MM (e.g. 2026-07).\n\n' +
    'This affects THIS RUN ONLY — nothing is saved. Leave blank to use ' +
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
      tell_('Report built', 'DECK_TEMPLATE_ID is not set, so no deck was generated. Run Setup → ' +
        'Find the deck template in Drive.');
    }
  } finally {
    REPORT_MONTH = saved;
  }
}

function createInputTabs() {
  applySettings_();
  ensureInputTabs_();
  tell_('Input tabs ready',
    'Created (or confirmed) three hand-fed tabs:\n\n' +
    '· "' + AUCTION_SHEET + '" — paste your Auction Insights export here. No Google API exposes ' +
    'this data, so slide 9\'s competitor block cannot be automated.\n\n' +
    '· "' + PMAXCAT_MANUAL_SHEET + '" — slide 10, Performance Max non-brand search terms. The MCC ' +
    'script now fills this automatically from campaign_search_term_view, so this tab is a FALLBACK: ' +
    'Google Ads → Campaigns → Insights → search terms → Download, then paste. Column names are ' +
    'matched loosely, so the export\'s own headers are fine, and brand terms are filtered out at ' +
    'build time so you can paste everything. A paste takes PRIORITY over the automated tab.\n\n' +
    '· "' + PROMO_SHEET + '" — list promo windows (name, start, end). Slide 12 measures any promo ' +
    'overlapping the report month.');
}

// ============================== FIRST-RUN CHECK ============================

/**
 * Verifies everything that has to be true before a first build, and says exactly
 * what to fix. Cheap to run, and the fastest way to diagnose a broken setup.
 */
function firstRunCheck() {
  ensureSettingsTab_();
  applySettings_();
  var problems = [], notes = [];
  notes.push('Settings come from the "' + SETTINGS_SHEET + '" tab, which survives code updates. ' +
    'Edit values there, not in Config.gs.');

  if (!TW_SPREADSHEET_ID) {
    problems.push('TW_SPREADSHEET_ID is empty. Set it on the "' + SETTINGS_SHEET + '" tab — the ' +
      'id is in that spreadsheet\'s URL, between /d/ and /edit.');
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
        periods.current.label + '). Sync that sheet, or set REPORT_MONTH on the "' +
        SETTINGS_SHEET + '" tab.');
      if (!cov.yoy) notes.push('No year-ago Triple Whale data → %YoY will read n/a for the Triple ' +
        'Whale columns. Lower BACKFILL_START in ld-x-tw-script to ' + periods.yoy.start + ' to fix.');
      if (!tw.sessionsAvailable) notes.push('No sessions column → "TW Sessions" reads n/a and TW CVR ' +
        'is computed on clicks. See docs/GAPS.md.');
    } catch (e) {
      problems.push(e.message);
    }
  }

  var engTabs = [ENGINE_DAY_SHEET, ENGINE_PRODUCT_SHEET, ENGINE_PMAXTERM_SHEET,
                 ENGINE_ITEM_SHEET, ENGINE_ASSET_SHEET];
  var present = [], missing = [];
  for (var i = 0; i < engTabs.length; i++) {
    (readEngineTab_(engTabs[i]).length ? present : missing).push(engTabs[i]);
  }
  if (present.length) notes.push('Engine tabs with data: ' + present.join(', ') + '.');
  if (missing.length) notes.push('Engine tabs empty or absent: ' + missing.join(', ') +
    '. Slides 8–12 will render as empty labelled tables until the MCC Google Ads Script runs.');

  // Slide 8's usefulness depends on the FEED, not the config — a dimension that
  // holds one value everywhere produces a table with one row, which reads as a bug.
  var dimRows = readEngineTab_(PRODUCT_DIMS_SHEET);
  if (dimRows.length) {
    notes.push('Slide 8 dimensions: ' + PRODUCT_DIM_1.field + ' × ' + PRODUCT_DIM_2.field +
      '. Run Diagnostics → Show product dimensions to see what each one holds in your feed and ' +
      'whether these are the right two.');
  } else {
    notes.push('Slide 8 dimensions: ' + PRODUCT_DIM_1.field + ' × ' + PRODUCT_DIM_2.field +
      '. No "' + PRODUCT_DIMS_SHEET + '" tab yet, so there is nothing to check them against — ' +
      're-paste and Run the MCC script to have it probe every dimension.');
  }

  var termRows = readEngineTab_(ENGINE_PMAXTERM_SHEET).length;
  if (!termRows && !readEngineTab_(PMAXCAT_MANUAL_SHEET).length) {
    notes.push('Slide 10 (PMax non-brand search terms) has no data. Re-paste and Run the MCC Google ' +
      'Ads Script — it queries campaign_search_term_view, the only resource that returns raw search ' +
      'terms for Performance Max. If "' + ENGINE_PMAXTERM_SHEET + '" stays empty, "_eng_status" ' +
      'carries Google\'s exact error. Fallback: paste the UI export into the "' +
      PMAXCAT_MANUAL_SHEET + '" tab.');
  } else if (!termRows && readEngineTab_(ENGINE_PMAXCAT_SHEET).length) {
    notes.push('Slide 10 is falling back to the older "' + ENGINE_PMAXCAT_SHEET + '" tab, which holds ' +
      'search CATEGORIES rather than terms. Re-paste and Run the MCC script to get actual terms.');
  }

  if (!DECK_TEMPLATE_ID) {
    notes.push('DECK_TEMPLATE_ID is empty → the Report tab is built but no deck is generated. ' +
      'Fix it with Setup → Find the deck template in Drive, which locates the converted Slides ' +
      'file and writes the id to the "' + SETTINGS_SHEET + '" tab for you. Setting it in Config.gs ' +
      'instead would be lost the next time you paste an updated dist/Code.gs.');
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

  // Probe the external-request permission HERE rather than letting it surface
  // later. An explicit oauthScopes list in appsscript.json overrides Apps Script's
  // automatic scope detection, so a manifest written before the code needed
  // UrlFetchApp withholds it permanently and Apps Script never prompts. That is
  // invisible until something tries to fetch, which is the wrong time to find out.
  if (PRODUCT_FEED_URL) {
    try {
      var probe = UrlFetchApp.fetch(PRODUCT_FEED_URL, { muteHttpExceptions: true, followRedirects: true });
      var pc = probe.getResponseCode();
      notes.push(pc === 200
        ? 'Product feed reachable (HTTP 200, ' + Math.round(probe.getContentText().length / 1024) +
          ' KB). Run Setup → Diagnose the product feed to confirm the parser reads it.'
        : 'Product feed returned HTTP ' + pc + ' — it must be reachable without a login.');
    } catch (e) {
      if (/permission to call UrlFetchApp|script\.external_request/i.test(String(e.message))) {
        problems.push('This project cannot make external requests, so slide 11 product images ' +
          'cannot be fetched. Add "https://www.googleapis.com/auth/script.external_request" to ' +
          'oauthScopes in appsscript.json (⚙ Project Settings → show the manifest), or delete the ' +
          'oauthScopes key entirely so scopes are inferred from the code. dist/appsscript.json in ' +
          'the repo is the correct manifest. Everything else works without this.');
      } else {
        notes.push('Product feed could not be fetched: ' + e.message);
      }
    }
  } else {
    notes.push('PRODUCT_FEED_URL is not set → slide 11 keeps its "Product Image" placeholders. ' +
      'Set it on the ' + SETTINGS_SHEET + ' tab to fill them automatically.');
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
  applySettings_();
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


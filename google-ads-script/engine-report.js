/**
 * Xero Shoes — Monthly Report  ·  GOOGLE ADS ENGINE FEED
 * =============================================================================
 * A Google Ads Script that writes the engine-only data the monthly deck needs
 * into the reporting spreadsheet, as `_eng_*` tabs.
 *
 * WHY A GOOGLE ADS SCRIPT AND NOT THE GOOGLE ADS API
 * -----------------------------------------------------------------------------
 * This runs inside Google Ads, so it needs no developer token, no OAuth client,
 * no GCP project, and no refresh-token plumbing — and it still speaks full GAQL
 * via AdsApp.search(). Setup is "paste, authorise the sheet, schedule". The
 * Apps Script side only READS the tabs this writes, so if you later want to
 * replace this with a REST integration, nothing downstream changes.
 *
 * WHAT IT DOES NOT COVER
 * -----------------------------------------------------------------------------
 * Auction insights. Google exposes competitor auction data through no API and no
 * script surface, at any access level. Slide 9's competitor block is a manual
 * paste into the `Auction Insights` tab. See docs/GAPS.md.
 *
 * Install: Google Ads (MCC) → Tools → Bulk actions → Scripts → new script →
 * paste → set CONFIG below → Preview → Run → schedule monthly on day 1.
 * Full walkthrough in docs/SETUP.md.
 */

// ============================== CONFIG =====================================

var CONFIG = {
  // The MONTHLY REPORT spreadsheet — the one the Apps Script project is bound
  // to. NOT the Triple Whale spreadsheet.
  //
  // Defaulted to the US sheet ("Xero Shoes — Monthly Report (US)") so re-pasting
  // this file does not mean re-typing the id every time.
  //
  // ⚠  THIS IS THE US SHEET. For the EU deployment, change it to the EU reporting
  // spreadsheet's id. The currency guard below catches getting that wrong — it
  // refuses to write EUR accounts into a sheet configured for USD, because mixing
  // currencies in one set of tabs adds euros to dollars and nothing looks broken.
  SPREADSHEET_ID: '1ZZBv5X0mNhSnJAezGy_dk7gKmKyej-VFglUcrvRJ59M',

  // Accounts to pull, as customer ids ('123-456-7890' or '1234567890').
  // [] means every account under the MCC this script runs in — which is wrong for
  // this project, because that would sweep other clients' accounts into the Xero
  // Shoes tabs. So it is pinned to the one account that pairs with the spreadsheet
  // above.
  //
  // Xero Shoes US: 602-681-1446. For the EU deployment, put the EU account here
  // AND change SPREADSHEET_ID — one region per spreadsheet, since nothing here
  // converts currency and mixing them would add euros to dollars.
  CUSTOMER_IDS: ['602-681-1446'],

  // How many months of daily history to (re)write each run.
  //
  // 26 gives two full years plus slack, which is the point of this feed: Google
  // and Microsoft have years of front-end history, Triple Whale does not, so the
  // engine is what makes %YoY real.
  //
  // HARD CEILING 37. Since June 2026 Google returns a date-range error for
  // segments.date beyond 37 months; past that you must switch to monthly
  // segments. main() refuses to run above the ceiling rather than failing
  // halfway through.
  MONTHS_BACK: 26,

  // Detail reports are heavier than the daily campaign feed. Limit them to the
  // most recent N months — slides 8/10/11 are single-month views, so 3 is plenty
  // and keeps the run well inside the 30-minute script limit.
  DETAIL_MONTHS_BACK: 3,

  // Tab names. These MUST match the ENGINE_*_SHEET constants in Config.gs on the
  // Apps Script side.
  TAB_DAY:      '_eng_day',
  TAB_PRODUCT:  '_eng_product',
  TAB_PMAX_CAT: '_eng_pmax_cat',
  TAB_ITEM:     '_eng_item',
  TAB_ASSET:    '_eng_asset',
  TAB_STATUS:   '_eng_status',

  // Every product dimension with its distinct values and spend, so you can SEE
  // what each custom label actually contains and choose the two worth reporting,
  // instead of guessing and re-running.
  TAB_PRODUCT_DIMS: '_eng_product_dims',

  // NOT written by this script — listed only so writeTab_ can refuse to touch
  // it. Hand-imported engine history (e.g. a one-time Microsoft Ads export of
  // the months before Triple Whale existed) lives here and must survive every
  // run. Must match ENGINE_MANUAL_SHEET in the Apps Script Config.gs.
  TAB_MANUAL_NEVER_WRITE: '_eng_manual',

  // The two dimensions slide 8 breaks products down by — DEFAULTS ONLY.
  //
  // The reporting spreadsheet's `Settings` tab overrides these if it names a
  // dimension there (PRODUCT_DIM_1 / PRODUCT_DIM_2). That is deliberately the same
  // cell the Apps Script side reads, so switching dimension is one spreadsheet
  // edit and a re-run — never a code change in two places that can drift apart.
  //
  // Google's custom labels are zero-indexed in the API: the UI's "Custom label 1"
  // is segments.product_custom_attribute1. Other options include product_type_l1
  // ..l5, product_brand, product_condition, product_channel.
  PRODUCT_DIM_1: 'product_type_l1',
  PRODUCT_DIM_2: 'product_type_l2',

  // The Settings tab in the reporting spreadsheet. Must match SETTINGS_SHEET in
  // the Apps Script Config/Settings.gs.
  TAB_SETTINGS: 'Settings',

  // Rows to keep per detail report, per month, ordered by conversion value.
  TOP_PRODUCT_ROWS: 60,
  TOP_ITEM_ROWS:    40,
  TOP_CATEGORY_ROWS: 60,
};

var CHANNEL = 'google-ads';   // matches the Triple Whale channel id, so the
                              // Apps Script classifier keys line up exactly

// Google's cap on daily-grain history (segments.date), effective June 2026.
var MAX_DAILY_MONTHS = 37;

// ============================== ENTRY POINT ================================

function main() {
  if (!CONFIG.SPREADSHEET_ID) {
    throw new Error('CONFIG.SPREADSHEET_ID is empty. Paste the id of the monthly report ' +
      'spreadsheet (from its URL, between /d/ and /edit).');
  }

  if (CONFIG.MONTHS_BACK > MAX_DAILY_MONTHS) {
    throw new Error('CONFIG.MONTHS_BACK is ' + CONFIG.MONTHS_BACK + ', above Google\'s ' +
      MAX_DAILY_MONTHS + '-month limit for segments.date (effective June 2026). Requests beyond ' +
      'that return a date-range error. Lower it, or rewrite the queries to use segments.month.');
  }

  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var settingsNote = applySpreadsheetSettings_(ss);
  var range = dateRange_(CONFIG.MONTHS_BACK);
  var detailRange = dateRange_(CONFIG.DETAIL_MONTHS_BACK);
  var log = [];

  Logger.log('Window: ' + range.start + ' → ' + range.end +
    '   detail: ' + detailRange.start + ' → ' + detailRange.end);

  var accounts = resolveAccounts_();
  Logger.log('Accounts: ' + accounts.map(function (a) { return a.label; }).join(', '));

  assertCurrencyMatches_(ss, accounts);

  // Each report is collected across all accounts, then written once. Every one is
  // isolated: a GAQL field that has been renamed in a newer API version fails
  // that report alone, is recorded on the status tab, and the rest still land.
  var reports = [
    { tab: CONFIG.TAB_DAY,      header: HEADER_DAY,      fn: fetchCampaignDays_,   range: range },
    { tab: CONFIG.TAB_PRODUCT,  header: HEADER_PRODUCT,  fn: fetchProductTypes_,   range: detailRange },
    { tab: CONFIG.TAB_ITEM,     header: HEADER_ITEM,     fn: fetchItems_,          range: detailRange },
    { tab: CONFIG.TAB_PMAX_CAT, header: HEADER_PMAX_CAT, fn: fetchPmaxCategories_, range: detailRange },
    { tab: CONFIG.TAB_ASSET,    header: HEADER_ASSET,    fn: fetchAssets_,         range: detailRange },
    { tab: CONFIG.TAB_PRODUCT_DIMS, header: HEADER_PRODUCT_DIMS, fn: fetchProductDims_, range: detailRange },
  ];

  for (var i = 0; i < reports.length; i++) {
    var rep = reports[i];
    var rows = [], errors = [];

    for (var a = 0; a < accounts.length; a++) {
      selectAccount_(accounts[a]);
      try {
        var got = rep.fn(rep.range, accounts[a]);
        rows = rows.concat(got);
        Logger.log(rep.tab + ' · ' + accounts[a].label + ': ' + got.length + ' rows');
      } catch (e) {
        var msg = accounts[a].label + ': ' + e.message;
        errors.push(msg);
        Logger.log('ERROR ' + rep.tab + ' · ' + msg);
      }
    }

    if (errors.length && !rows.length) {
      // Nothing came back at all — leave whatever was there from a previous good
      // run rather than blanking the tab and silently emptying the deck.
      log.push([rep.tab, 'FAILED — tab left unchanged', errors.join(' | '), rows.length]);
      continue;
    }
    writeTab_(ss, rep.tab, rep.header, rows);
    log.push([rep.tab, errors.length ? 'PARTIAL' : 'OK', errors.join(' | '), rows.length]);
  }

  log.push(['(settings)', 'INFO', settingsNote, '']);
  writeStatus_(ss, log, range, detailRange, accounts);
  Logger.log('Done. ' + log.map(function (l) { return l[0] + '=' + l[1]; }).join(', '));
}

// ============================== SETTINGS FROM THE SPREADSHEET ==============

/**
 * The product dimensions slide 8 uses are a per-feed choice that gets iterated on,
 * so they live on the reporting spreadsheet's `Settings` tab — the SAME cells the
 * Apps Script side reads. Changing dimension is then one edit, and the two sides
 * cannot drift into disagreeing about what the deck's columns mean.
 *
 * Non-fatal by design: no tab, no rows, or a value that is not a real dimension
 * all fall back to the CONFIG defaults above and say so on `_eng_status`.
 */
function applySpreadsheetSettings_(ss) {
  var notes = [];
  var stored = readSheetSettings_(ss);
  if (!stored) {
    return 'No "' + CONFIG.TAB_SETTINGS + '" tab — using script defaults: ' +
      CONFIG.PRODUCT_DIM_1 + ' / ' + CONFIG.PRODUCT_DIM_2 +
      '. Run Monthly Report → Setup → Settings in the spreadsheet to create it.';
  }

  ['PRODUCT_DIM_1', 'PRODUCT_DIM_2'].forEach(function (key) {
    var raw = String(stored[key] === undefined ? '' : stored[key]).trim();
    if (!raw) return;
    var field = resolveDimField_(raw);
    if (!field) {
      notes.push(key + '="' + raw + '" is not a product dimension — ignored, kept ' + CONFIG[key]);
      return;
    }
    if (field === CONFIG[key]) return;
    notes.push(key + ': ' + CONFIG[key] + ' → ' + field);
    CONFIG[key] = field;
  });

  Logger.log('Product dimensions: ' + CONFIG.PRODUCT_DIM_1 + ' × ' + CONFIG.PRODUCT_DIM_2 +
    (notes.length ? '   (' + notes.join('; ') + ')' : '   (from script defaults)'));

  return 'Slide 8 dimensions: ' + CONFIG.PRODUCT_DIM_1 + ' × ' + CONFIG.PRODUCT_DIM_2 +
    (notes.length ? '  ·  ' + notes.join('; ') : '  ·  no override on the Settings tab');
}

/** The reporting spreadsheet's `Settings` tab as { KEY: value }, or null if absent. */
function readSheetSettings_(ss) {
  var sheet = ss.getSheetByName(CONFIG.TAB_SETTINGS);
  if (!sheet || sheet.getLastRow() < 2) return null;

  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
  var out = {};
  for (var i = 0; i < values.length; i++) {
    var key = String(values[i][0] || '').trim();
    if (key) out[key] = values[i][1];
  }
  return out;
}

/**
 * Refuse to write accounts into a spreadsheet configured for a different currency.
 *
 * WHY THIS IS WORTH A HARD FAILURE
 * ---------------------------------------------------------------------------
 * CONFIG.SPREADSHEET_ID is defaulted to the US sheet so it survives re-pasting.
 * That convenience creates exactly one new way to be wrong: running this from the
 * EU MCC without changing it, which writes EUR costs into tabs the Apps Script
 * sums as USD. Nothing errors, no cell looks odd, and the deck reports a spend
 * figure that is the sum of two currencies.
 *
 * The account knows its currency and the Settings tab states the sheet's, so this
 * is checkable rather than a matter of remembering. Throwing BEFORE any query runs
 * means a wrong pairing costs a clear error, not a corrupted tab — the previous
 * good data is untouched.
 *
 * Silent when it cannot know: no Settings tab, no CURRENCY value, or an account
 * whose currency the API won't report all pass, because refusing to run on missing
 * information would block a first-time setup for no safety gain.
 */
function assertCurrencyMatches_(ss, accounts) {
  var stored = readSheetSettings_(ss) || {};
  var expected = String(stored.CURRENCY === undefined ? '' : stored.CURRENCY).trim().toUpperCase();
  if (!expected) {
    Logger.log('Currency guard: the Settings tab names no CURRENCY, so nothing to check against.');
    return;
  }

  var mismatched = [], unknown = 0;
  for (var i = 0; i < accounts.length; i++) {
    var got = accounts[i].currency;
    if (!got) { unknown++; continue; }
    if (got.toUpperCase() !== expected) mismatched.push(accounts[i].label + ' is in ' + got);
  }

  if (mismatched.length) {
    throw new Error('CURRENCY MISMATCH — refusing to write, so the tabs keep their previous good ' +
      'data. The spreadsheet "' + ss.getName() + '" is configured for ' + expected +
      ' on its Settings tab, but ' + mismatched.length + ' of ' + accounts.length +
      ' account(s) report a different currency: ' + mismatched.join('; ') + '. ' +
      'Either point CONFIG.SPREADSHEET_ID at that region\'s own reporting spreadsheet, or limit ' +
      'CONFIG.CUSTOMER_IDS to the accounts belonging to this one. One region per spreadsheet — ' +
      'nothing here converts currency, so mixing them adds euros to dollars.');
  }

  Logger.log('Currency guard: ' + (accounts.length - unknown) + ' account(s) confirmed as ' +
    expected + (unknown ? ', ' + unknown + ' did not report a currency' : '') + '.');
}

/**
 * Same tolerant vocabulary as resolveProductDim_() on the Apps Script side: the
 * API field, the UI's label, or shorthand. Returns the GAQL field or null.
 *
 * Duplicated rather than shared because Google Ads Scripts and Apps Script are two
 * separate runtimes with no module system between them. Keep the two in step — the
 * Apps Script self-test asserts its own copy accepts every field listed here.
 */
function resolveDimField_(input) {
  var s = String(input).trim().toLowerCase().replace(/[\s_\-.]/g, '');
  var named = {
    productbrand: 'product_brand', brand: 'product_brand',
    productcondition: 'product_condition', condition: 'product_condition',
    productchannel: 'product_channel', channel: 'product_channel',
    productitemid: 'product_item_id', itemid: 'product_item_id',
    producttitle: 'product_title', title: 'product_title',
  };
  if (named[s]) return named[s];

  var m = s.match(/^(?:productcustomattribute|cl|customlabel|label|attr|attribute|customattribute)(\d)$/);
  if (m && Number(m[1]) <= 4) return 'product_custom_attribute' + m[1];
  m = s.match(/^(?:producttypel|pt|producttype|type|l)(\d)$/);
  if (m && Number(m[1]) >= 1 && Number(m[1]) <= 5) return 'product_type_l' + m[1];

  return null;
}

// ============================== ACCOUNTS ===================================

function resolveAccounts_() {
  var isMcc = typeof AdsManagerApp !== 'undefined';
  if (!isMcc) {
    var cur = AdsApp.currentAccount();
    return [{ id: cur.getCustomerId(), label: cur.getName(), mcc: false,
              currency: currencyOf_(cur) }];
  }

  var sel = AdsManagerApp.accounts();
  if (CONFIG.CUSTOMER_IDS.length) sel = sel.withIds(CONFIG.CUSTOMER_IDS.map(normalizeId_));

  var out = [], it = sel.get();
  while (it.hasNext()) {
    var acc = it.next();
    out.push({ id: acc.getCustomerId(), label: acc.getName() + ' (' + acc.getCustomerId() + ')',
               account: acc, mcc: true, currency: currencyOf_(acc) });
  }
  if (!out.length) {
    throw new Error('No accounts matched. CONFIG.CUSTOMER_IDS = [' + CONFIG.CUSTOMER_IDS.join(', ') +
      ']. Leave it empty to pull every account under this MCC.');
  }
  return out;
}

function selectAccount_(acc) { if (acc.mcc) AdsManagerApp.select(acc.account); }

/**
 * An account's currency, or '' if this Ads Scripts version does not expose it.
 *
 * Defensive rather than assumed: getCurrencyCode() exists on both Account and
 * ManagedAccount, but a guard that throws when its own probe is unavailable would
 * be worse than the problem it prevents.
 */
function currencyOf_(acc) {
  try {
    var c = acc.getCurrencyCode && acc.getCurrencyCode();
    return c ? String(c).trim() : '';
  } catch (e) {
    return '';
  }
}

function normalizeId_(id) { return String(id).replace(/-/g, '').replace(/^(\d{3})(\d{3})(\d{4})$/, '$1-$2-$3'); }

// ============================== REPORT: CAMPAIGN × DAY =====================

var HEADER_DAY = ['date', 'channel', 'account', 'campaign_id', 'campaign',
                  'channel_type', 'channel_sub_type', 'labels', 'impressions', 'clicks', 'cost',
                  'conversions', 'conversions_value', 'search_impression_share'];

/**
 * Daily campaign metrics, plus impression share.
 *
 * Impression share is fetched in a SEPARATE query restricted to Search and
 * Shopping campaigns. metrics.search_impression_share is undefined for
 * Performance Max and Demand Gen, and asking for it across all campaign types is
 * the kind of request that fails the whole query rather than returning nulls.
 */
function fetchCampaignDays_(range, acc) {
  // Campaign labels, fetched once per account. A label is attached to the
  // campaign so it survives a rename, which makes it a far better brand signal
  // than a regex on the name. Applied by the Apps Script classifier via
  // BRAND_LABEL_MAP; a campaign with no mapped label falls back to name rules.
  var labelsFor = {};
  try {
    eachRow_('SELECT campaign.id, label.name FROM campaign_label', function (r) {
      var id = String(r.campaign.id);
      (labelsFor[id] || (labelsFor[id] = [])).push(String(r.label.name));
    });
  } catch (e) {
    Logger.log('Campaign label query failed (brand falls back to name rules): ' + e.message);
  }

  var base = 'SELECT segments.date, campaign.id, campaign.name, ' +
    'campaign.advertising_channel_type, campaign.advertising_channel_sub_type, ' +
    'metrics.impressions, metrics.clicks, metrics.cost_micros, ' +
    'metrics.conversions, metrics.conversions_value ' +
    'FROM campaign ' +
    'WHERE segments.date BETWEEN "' + range.start + '" AND "' + range.end + '" ' +
    'AND campaign.status != "REMOVED" AND metrics.impressions > 0';

  var rows = [], index = {};
  eachRow_(base, function (r) {
    var key = r.segments.date + '||' + r.campaign.id;
    var row = [
      r.segments.date, CHANNEL, acc.label, String(r.campaign.id), r.campaign.name,
      r.campaign.advertisingChannelType || '', r.campaign.advertisingChannelSubType || '',
      (labelsFor[String(r.campaign.id)] || []).join('|'),
      n_(r.metrics.impressions), n_(r.metrics.clicks), micros_(r.metrics.costMicros),
      n_(r.metrics.conversions), n_(r.metrics.conversionsValue), '',
    ];
    index[key] = row;
    rows.push(row);
  });

  // Impression share, merged onto the rows above by (date, campaign).
  var isQuery = 'SELECT segments.date, campaign.id, metrics.search_impression_share ' +
    'FROM campaign ' +
    'WHERE segments.date BETWEEN "' + range.start + '" AND "' + range.end + '" ' +
    'AND campaign.status != "REMOVED" ' +
    'AND campaign.advertising_channel_type IN ("SEARCH", "SHOPPING")';
  try {
    eachRow_(isQuery, function (r) {
      var row = index[r.segments.date + '||' + r.campaign.id];
      if (row) row[13] = n_(r.metrics.searchImpressionShare);   // last column of HEADER_DAY
    });
  } catch (e) {
    Logger.log('Impression share query failed (slide 9 will be empty): ' + e.message);
  }

  return rows;
}

// ============================== REPORT: PRODUCT TAXONOMY ===================

// Column names are FIXED (`dim1`, `dim2`) even though the dimensions behind them
// are configurable, so changing PRODUCT_DIM_* needs no change on the reading side.
// The dimension actually used is recorded in `dim1_field` / `dim2_field` so the
// tab is self-describing and a mismatch is visible rather than inferred.
var HEADER_PRODUCT = ['month', 'dim1', 'dim2', 'dim1_field', 'dim2_field',
                      'impressions', 'clicks', 'cost', 'conversions', 'conversions_value'];

function fetchProductTypes_(range) {
  var f1 = CONFIG.PRODUCT_DIM_1, f2 = CONFIG.PRODUCT_DIM_2;
  var q = 'SELECT segments.date, segments.' + f1 + ', segments.' + f2 + ', ' +
    'metrics.impressions, metrics.clicks, metrics.cost_micros, ' +
    'metrics.conversions, metrics.conversions_value ' +
    'FROM shopping_performance_view ' +
    'WHERE segments.date BETWEEN "' + range.start + '" AND "' + range.end + '"';

  var k1 = camel_(f1), k2 = camel_(f2);
  var acc = {};
  eachRow_(q, function (r) {
    var month = String(r.segments.date).slice(0, 7);
    // A product with no value for a custom label comes back empty, not absent.
    // '(not set)' keeps those rows visible instead of silently merging them.
    var d1 = r.segments[k1] || '(not set)';
    var d2 = r.segments[k2] || '(not set)';
    addTo_(acc, [month, d1, d2, f1, f2].join('||'), r);
  });
  return topPerMonth_(acc, 5, CONFIG.TOP_PRODUCT_ROWS);
}

/** snake_case GAQL field → the lowerCamelCase key AdsApp.search() returns. */
function camel_(field) {
  return String(field).replace(/_([a-z0-9])/g, function (m, c) { return c.toUpperCase(); });
}

// ============================== REPORT: DIMENSION DISCOVERY ================

var HEADER_PRODUCT_DIMS = ['month', 'dimension', 'value', 'impressions', 'clicks', 'cost',
                           'conversions', 'conversions_value'];

/**
 * What every product dimension actually CONTAINS.
 *
 * Custom labels are free text the feed sets, so which one holds a useful category
 * is a property of the feed, not of Google. Guessing costs a full round trip —
 * change the config, re-run, rebuild, look at the deck — and "Custom Label 1 =
 * shoes for every product" is only visible at the end of it.
 *
 * This exports every dimension's distinct values with spend, so choosing the right
 * two is a matter of reading one tab.
 *
 * One query per dimension rather than one query selecting all of them: segmenting
 * by several product dimensions at once multiplies the rows out and reports the
 * cross-product rather than each dimension's own totals.
 */
function fetchProductDims_(range) {
  var dims = [
    'product_custom_attribute0', 'product_custom_attribute1', 'product_custom_attribute2',
    'product_custom_attribute3', 'product_custom_attribute4',
    'product_type_l1', 'product_type_l2', 'product_type_l3',
    'product_brand',
  ];

  var month = range.end.slice(0, 7);
  var out = [], failures = [];

  for (var d = 0; d < dims.length; d++) {
    var field = dims[d], key = camel_(field);
    var q = 'SELECT segments.' + field + ', metrics.impressions, metrics.clicks, ' +
      'metrics.cost_micros, metrics.conversions, metrics.conversions_value ' +
      'FROM shopping_performance_view ' +
      'WHERE segments.date BETWEEN "' + range.start + '" AND "' + range.end + '"';

    var acc = {};
    try {
      eachRow_(q, function (r) {
        var v = r.segments[key];
        addTo_(acc, [month, field, (v === undefined || v === null || v === '') ? '(not set)' : v].join('||'), r);
      });
    } catch (e) {
      failures.push(field + ': ' + e.message);
      continue;
    }

    // Top 25 values per dimension by conversion value — enough to judge whether a
    // dimension is useful without flooding the tab.
    var rows = topPerMonth_(acc, 3, 25);
    // topPerMonth_ keys on month, so re-sort within this dimension.
    out = out.concat(rows);
  }

  if (failures.length) Logger.log('Product dimension probe failures: ' + failures.join(' | '));
  if (!out.length && failures.length) throw new Error(failures.join(' | '));
  return out;
}

// ============================== REPORT: ITEM LEVEL =========================

var HEADER_ITEM = ['month', 'item_id', 'title',
                   'impressions', 'clicks', 'cost', 'conversions', 'conversions_value'];

function fetchItems_(range) {
  var q = 'SELECT segments.date, segments.product_item_id, segments.product_title, ' +
    'metrics.impressions, metrics.clicks, metrics.cost_micros, ' +
    'metrics.conversions, metrics.conversions_value ' +
    'FROM shopping_performance_view ' +
    'WHERE segments.date BETWEEN "' + range.start + '" AND "' + range.end + '" ' +
    'AND metrics.conversions_value > 0';

  var acc = {};
  eachRow_(q, function (r) {
    var month = String(r.segments.date).slice(0, 7);
    var id = r.segments.productItemId || '(not set)';
    var title = r.segments.productTitle || id;
    addTo_(acc, [month, id, title].join('||'), r);
  });
  return topPerMonth_(acc, 3, CONFIG.TOP_ITEM_ROWS);
}

// ============================== REPORT: PMAX SEARCH CATEGORIES =============

var HEADER_PMAX_CAT = ['month', 'campaign_id', 'campaign', 'category', 'search_volume',
                       'impressions', 'clicks', 'cost', 'conversions', 'conversions_value',
                       'source_query'];

/**
 * PMax / search-term-category insights — the data behind the Google Ads UI's
 * "Search terms insights" panel.
 *
 * WHY THIS TRIES SEVERAL QUERIES
 * ---------------------------------------------------------------------------
 * These resources carry undocumented constraints that are not caught by the query
 * builder and only surface as runtime errors — which combination of fields,
 * segments and filters is legal has changed between API versions, and
 * `customer_search_term_insight` and `campaign_search_term_insight` do not accept
 * the same ones.
 *
 * So rather than commit to one guess, this walks a list of candidate queries from
 * richest to plainest and uses the first that returns rows. The query that worked
 * is written into the `source_query` column, and every failure's exact error text
 * lands on the `_eng_status` tab. When the tab is empty you therefore learn WHY
 * from Google's own words instead of guessing.
 *
 * Account level first, because that is what the UI panel shows (and it needs one
 * query rather than one per campaign). Campaign level is the fallback:
 * `campaign_search_term_insight` may only be selected while filtering to a single
 * campaign id, hence the loop.
 */
function fetchPmaxCategories_(range) {
  var month = range.end.slice(0, 7);
  var attempts = [];

  // ---- account level: one query, matches the UI's account-wide panel ----
  var customerVariants = [
    // Richest first. metrics.search_volume is what the UI shows as a bucketed
    // range ("10K-100K"); if it is not selectable this variant fails and the next
    // one drops it.
    'SELECT customer_search_term_insight.category_label, customer_search_term_insight.id, ' +
      'metrics.impressions, metrics.clicks, metrics.conversions, metrics.conversions_value, ' +
      'metrics.search_volume FROM customer_search_term_insight ' +
      'WHERE segments.date BETWEEN "@start" AND "@end"',

    'SELECT customer_search_term_insight.category_label, customer_search_term_insight.id, ' +
      'metrics.impressions, metrics.clicks, metrics.conversions, metrics.conversions_value ' +
      'FROM customer_search_term_insight WHERE segments.date BETWEEN "@start" AND "@end"',

    // Some versions reject segments.date here and require a coarser segment.
    'SELECT customer_search_term_insight.category_label, customer_search_term_insight.id, ' +
      'metrics.impressions, metrics.clicks, metrics.conversions, metrics.conversions_value ' +
      'FROM customer_search_term_insight WHERE segments.month BETWEEN "@monthStart" AND "@monthEnd"',
  ];

  for (var v = 0; v < customerVariants.length; v++) {
    var q = fillQuery_(customerVariants[v], range);
    var acc = {}, rows = 0;
    try {
      eachRow_(q, function (r) {
        var label = (r.customerSearchTermInsight && r.customerSearchTermInsight.categoryLabel) || '(uncategorised)';
        addTo_(acc, [month, '', 'ALL CAMPAIGNS', label, searchVolumeOf_(r), 'customer_search_term_insight'].join('||'), r);
        rows++;
      });
    } catch (e) {
      attempts.push('customer_search_term_insight v' + (v + 1) + ': ' + e.message);
      continue;
    }
    if (rows) {
      Logger.log('PMax categories: customer_search_term_insight variant ' + (v + 1) + ' returned ' + rows + ' rows');
      return topPerMonth_(acc, 6, CONFIG.TOP_CATEGORY_ROWS);
    }
    attempts.push('customer_search_term_insight v' + (v + 1) + ': query ran but returned 0 rows');
  }

  // ---- campaign level fallback, one query per PMax campaign ----
  var campaigns = [];
  try {
    eachRow_('SELECT campaign.id, campaign.name FROM campaign ' +
      'WHERE campaign.advertising_channel_type = "PERFORMANCE_MAX" AND campaign.status != "REMOVED"',
      function (r) { campaigns.push({ id: String(r.campaign.id), name: r.campaign.name }); });
  } catch (e) {
    attempts.push('PMax campaign list: ' + e.message);
  }

  if (campaigns.length) {
    var acc2 = {}, total = 0, failures = [];
    for (var i = 0; i < campaigns.length; i++) {
      var c = campaigns[i];
      var cq = 'SELECT campaign_search_term_insight.category_label, campaign_search_term_insight.id, ' +
        'campaign_search_term_insight.campaign_id, metrics.impressions, metrics.clicks, ' +
        'metrics.conversions, metrics.conversions_value FROM campaign_search_term_insight ' +
        'WHERE segments.date BETWEEN "' + range.start + '" AND "' + range.end + '" ' +
        'AND campaign_search_term_insight.campaign_id = ' + c.id;
      try {
        eachRow_(cq, function (r) {
          var label = (r.campaignSearchTermInsight && r.campaignSearchTermInsight.categoryLabel) || '(uncategorised)';
          addTo_(acc2, [month, c.id, c.name, label, '', 'campaign_search_term_insight'].join('||'), r);
          total++;
        });
      } catch (e2) {
        if (failures.length < 3) failures.push(c.name + ': ' + e2.message);
      }
    }
    if (failures.length) attempts.push('campaign_search_term_insight — ' + failures.join(' | '));
    if (total) {
      Logger.log('PMax categories: campaign_search_term_insight returned ' + total + ' rows across ' +
        campaigns.length + ' campaign(s)');
      return topPerMonth_(acc2, 6, CONFIG.TOP_CATEGORY_ROWS);
    }
    attempts.push('campaign_search_term_insight: ran across ' + campaigns.length +
      ' PMax campaign(s) and returned 0 rows');
  } else {
    attempts.push('no PERFORMANCE_MAX campaigns found to query');
  }

  // Nothing worked. Throw so main() records this on _eng_status as FAILED and
  // leaves any previous good data alone — with every error Google gave us, which
  // is the only way to tell a permissions problem from a renamed field.
  throw new Error('Search term category insights unavailable. Tried ' + attempts.length +
    ' approach(es): ' + attempts.join('  ||  '));
}

/**
 * The UI shows search volume as a bucketed RANGE ("10K-100K"), not a number.
 * Whether any of that is selectable varies by API version, so read it defensively
 * from whichever shape came back and fall back to blank.
 */
function searchVolumeOf_(r) {
  var m = r.metrics || {};
  if (m.searchVolume === undefined || m.searchVolume === null) return '';
  var v = m.searchVolume;
  // Could be a scalar or a {min,max} range object depending on version.
  if (typeof v === 'object') {
    var lo = v.lowerBound !== undefined ? v.lowerBound : v.min;
    var hi = v.upperBound !== undefined ? v.upperBound : v.max;
    if (lo === undefined && hi === undefined) return '';
    return (lo === undefined ? '' : lo) + '-' + (hi === undefined ? '' : hi);
  }
  return v;
}

/** Substitute the date placeholders a candidate query uses. */
function fillQuery_(template, range) {
  return template
    .replace('@start', range.start).replace('@end', range.end)
    .replace('@monthStart', range.start.slice(0, 7) + '-01')
    .replace('@monthEnd', range.end.slice(0, 7) + '-01');
}

// ============================== REPORT: ASSETS / SITELINKS =================

var HEADER_ASSET = ['date', 'campaign', 'asset_type', 'asset_text',
                    'impressions', 'clicks', 'cost', 'conversions', 'conversions_value'];

/** Daily grain, because slide 12 measures arbitrary promo windows. */
function fetchAssets_(range) {
  var q = 'SELECT segments.date, campaign.name, campaign_asset.field_type, ' +
    'asset.type, asset.sitelink_asset.link_text, asset.text_asset.text, ' +
    'metrics.impressions, metrics.clicks, metrics.cost_micros, ' +
    'metrics.conversions, metrics.conversions_value ' +
    'FROM campaign_asset ' +
    'WHERE segments.date BETWEEN "' + range.start + '" AND "' + range.end + '" ' +
    'AND campaign_asset.status != "REMOVED" AND metrics.impressions > 0';

  var rows = [];
  eachRow_(q, function (r) {
    var asset = r.asset || {};
    var text = (asset.sitelinkAsset && asset.sitelinkAsset.linkText) ||
               (asset.textAsset && asset.textAsset.text) || '';
    if (!text) return;
    rows.push([
      r.segments.date, r.campaign.name,
      (r.campaignAsset && r.campaignAsset.fieldType) || asset.type || '',
      text,
      n_(r.metrics.impressions), n_(r.metrics.clicks), micros_(r.metrics.costMicros),
      n_(r.metrics.conversions), n_(r.metrics.conversionsValue),
    ]);
  });
  return rows;
}

// ============================== GAQL / AGGREGATION HELPERS =================

function eachRow_(query, fn) {
  var it = AdsApp.search(query);
  while (it.hasNext()) fn(it.next());
}

/** Accumulate metrics under a '||'-joined key. */
function addTo_(acc, key, r) {
  var g = acc[key] || (acc[key] = { key: key, impressions: 0, clicks: 0, cost: 0, conversions: 0, value: 0 });
  g.impressions += n_(r.metrics.impressions);
  g.clicks      += n_(r.metrics.clicks);
  g.cost        += micros_(r.metrics.costMicros);
  g.conversions += n_(r.metrics.conversions);
  g.value       += n_(r.metrics.conversionsValue);
}

/**
 * Flatten an accumulator to rows, keeping only the top `limit` by conversion
 * value WITHIN each month, so one big month cannot crowd out another entirely.
 * `keyLen` is how many '||' parts the key has.
 */
function topPerMonth_(acc, keyLen, limit) {
  var byMonth = {};
  Object.keys(acc).forEach(function (k) {
    var month = k.split('||')[0];
    (byMonth[month] || (byMonth[month] = [])).push(acc[k]);
  });

  var out = [];
  Object.keys(byMonth).sort().forEach(function (month) {
    byMonth[month].sort(function (a, b) { return b.value - a.value; });
    var keep = byMonth[month].slice(0, limit);
    for (var i = 0; i < keep.length; i++) {
      var parts = keep[i].key.split('||');
      while (parts.length < keyLen) parts.push('');
      out.push(parts.concat([keep[i].impressions, keep[i].clicks, round2_(keep[i].cost),
        round2_(keep[i].conversions), round2_(keep[i].value)]));
    }
  });
  return out;
}

function n_(v) { var x = Number(v); return isFinite(x) ? x : 0; }
function micros_(v) { return n_(v) / 1000000; }
function round2_(v) { return Math.round(n_(v) * 100) / 100; }

// ============================== DATES ======================================

function dateRange_(monthsBack) {
  var tz = AdsApp.currentAccount().getTimeZone();
  var now = new Date();
  var endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
  var start = new Date(endOfLastMonth.getFullYear(), endOfLastMonth.getMonth() - (monthsBack - 1), 1);
  return {
    start: Utilities.formatDate(start, tz, 'yyyy-MM-dd'),
    // Through today, so a mid-month run still sees the current partial month.
    end: Utilities.formatDate(now, tz, 'yyyy-MM-dd'),
  };
}

// ============================== SHEET I/O ==================================

function writeTab_(ss, name, header, rows) {
  if (name === CONFIG.TAB_MANUAL_NEVER_WRITE) {
    throw new Error('Refusing to write "' + name + '" — it holds hand-imported history that no ' +
      'script may overwrite.');
  }
  var sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  sheet.clear();
  sheet.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold');
  sheet.setFrozenRows(1);

  if (rows.length) {
    // Normalise width — a short row would otherwise throw on setValues.
    var grid = rows.map(function (r) {
      var out = r.slice(0, header.length);
      while (out.length < header.length) out.push('');
      return out;
    });
    sheet.getRange(2, 1, grid.length, header.length).setValues(grid);
    // Dates as text: the Apps Script side parses 'yyyy-MM-dd' strings, and a
    // locale-formatted date value is exactly how that goes wrong silently.
    if (header[0] === 'date' || header[0] === 'month') {
      sheet.getRange(2, 1, grid.length, 1).setNumberFormat('@');
    }
  }
  sheet.hideSheet();
  Logger.log('Wrote ' + name + ': ' + rows.length + ' rows');
}

function writeStatus_(ss, log, range, detailRange, accounts) {
  var sheet = ss.getSheetByName(CONFIG.TAB_STATUS) || ss.insertSheet(CONFIG.TAB_STATUS);
  sheet.clear();
  sheet.getRange(1, 1).setValue('Google Ads engine feed — last run').setFontWeight('bold').setFontSize(12);
  sheet.getRange(2, 1).setValue('finished ' + Utilities.formatDate(new Date(),
    AdsApp.currentAccount().getTimeZone(), 'yyyy-MM-dd HH:mm:ss z'));
  sheet.getRange(3, 1).setValue('window ' + range.start + ' → ' + range.end +
    '   ·   detail window ' + detailRange.start + ' → ' + detailRange.end);
  sheet.getRange(4, 1).setValue('accounts: ' + accounts.map(function (a) { return a.label; }).join(', '));

  var header = ['tab', 'status', 'errors', 'rows'];
  sheet.getRange(6, 1, 1, header.length).setValues([header]).setFontWeight('bold');
  if (log.length) sheet.getRange(7, 1, log.length, header.length).setValues(log);
  sheet.setColumnWidth(1, 140);
  sheet.setColumnWidth(3, 620);

  var failed = log.filter(function (l) { return l[1] !== 'OK' && l[1] !== 'INFO'; });
  if (failed.length) {
    sheet.getRange(6 + log.length + 2, 1).setValue(
      'A FAILED or PARTIAL row above almost always means a GAQL field name changed in a newer ' +
      'Google Ads API version. Fix the query in engine-report.js — the report functions are ' +
      'independent, so the others kept working. A FAILED tab was left with its previous contents ' +
      'rather than blanked.').setFontColor('#b45309').setWrap(true);
  }
}

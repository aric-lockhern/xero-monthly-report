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
  var raw = readEngineTab_(ENGINE_DAY_SHEET);
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

    if (r.channel_type) {
      types[classKey_(channel, campaign)] = {
        channelType: String(r.channel_type),
        subType: String(r.channel_sub_type || ''),
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

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

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
  'Cost (report month)', 'TW Revenue (report month)',
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
    var autoB = autoBrand_(campaign);

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
function renderCampaignMap_(rows, classify) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(MAP_SHEET) || ss.insertSheet(MAP_SHEET);
  var overrides = readOverrides_();

  // Aggregate the report month by campaign.
  var seen = {};
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var key = classKey_(r.channel, r.campaign);
    var s = seen[key] || (seen[key] = { channel: r.channel, campaign: r.campaign, cost: 0, rev: 0 });
    s.cost += num_(r.spend);
    s.rev  += num_(r.tw_revenue);
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
    out.push(mapRow_({ channel: parts[0], campaign: parts[1], cost: null, rev: null },
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
    s.cost, s.rev,
  ];
}

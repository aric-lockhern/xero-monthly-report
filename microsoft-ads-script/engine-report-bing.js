/**
 * Xero Shoes — Monthly Report  ·  MICROSOFT ADS ENGINE FEED
 * =============================================================================
 * A Microsoft Advertising Script that pushes Bing front-end history into the
 * monthly report spreadsheet, so the engine spine covers Microsoft as well as
 * Google and %YoY stops understating total spend.
 *
 * TWO THINGS ABOUT MICROSOFT SCRIPTS THAT SHAPE THIS FILE
 * -----------------------------------------------------------------------------
 * 1. THERE IS NO REPORT QUERY SURFACE. Google Ads Scripts give you
 *    AdsApp.search() with full GAQL, so one query returns 26 months of daily
 *    campaign rows. Microsoft's AdsApp has no report() and no search() — only
 *    entity selectors (campaigns(), shoppingCampaigns(), …) with
 *    forDateRange() + getStats(). getStats() returns ONE AGGREGATE for the
 *    range, not a row per day.
 *
 *    So daily grain over two years would mean ~790 sequential selector passes,
 *    which is marginal against the 30-minute script limit and would be a slow,
 *    fragile job.
 *
 *    MONTHLY GRAIN INSTEAD — 26 passes, seconds of work. That is genuinely all
 *    the deck needs from Bing history: slides 4–7 and 13 are month totals. The
 *    two things that want daily data don't want it from Bing anyway — slide 9's
 *    impression-share chart is Google brand search only, and slide 12's promo
 *    windows are measured on Triple Whale, which has daily Bing from June 2026.
 *
 *    Rows are written with grain='month'. The Apps Script side matches those by
 *    MONTH, never by date range, so a monthly total can never be absorbed whole
 *    into a narrower window.
 *
 * 2. WRITING TO GOOGLE SHEETS DOESN'T NEED GOOGLE OAUTH. Microsoft documents
 *    calling the Sheets API directly, but that needs a Google Cloud OAuth client
 *    id, secret and refresh token stored in this script. UrlFetchApp is
 *    available, so instead this POSTs JSON to an Apps Script Web App published
 *    from the report spreadsheet, authenticated with a shared secret. No Google
 *    OAuth client, no refresh token, and all sheet-writing logic stays in the
 *    Apps Script project where the rest of it lives.
 *
 * SETUP: docs/SETUP.md § D. In short — deploy the Apps Script as a Web App, put
 * its URL and the shared secret below, Preview, Run, schedule monthly.
 *
 * Lockhern Digital — internal reporting tool.
 */

// ============================== CONFIG =====================================

var CONFIG = {
  // Apps Script Web App URL from the report spreadsheet. Ends in /exec.
  // Extensions → Apps Script → Deploy → New deployment → Web app.
  WEBHOOK_URL: '',

  // Must match the BING_WEBHOOK_SECRET script property in the Apps Script
  // project. Any long random string. This is the only thing stopping someone who
  // guesses the URL from writing rows, so treat it as a password.
  WEBHOOK_SECRET: '',

  // Accounts to pull, as Microsoft account numbers or ids. Leave [] for every
  // account this script can see.
  //
  // KEEP REGIONS SEPARATE. One run per region, pointed at that region's own
  // webhook, because the Apps Script side is one-region-per-spreadsheet and
  // nothing here converts currency.
  ACCOUNT_IDS: [],

  // Months of history to push, counting back from last month. 26 matches the
  // Google feed's MONTHS_BACK.
  MONTHS_BACK: 26,

  // Also push the current, partial month. Useful for a mid-month sanity check,
  // but Triple Whale already covers recent Bing, so it is off by default.
  INCLUDE_CURRENT_MONTH: false,

  // Rows per POST. Keeps each request well under Apps Script's payload limit.
  BATCH_SIZE: 400,
};

// Must match TW_ADS_CHANNELS in the Apps Script Config.gs, so Bing rows from
// here and Bing rows from Triple Whale land in the same channel bucket.
var CHANNEL = 'bing';

// ============================== ENTRY POINT ================================

function main() {
  if (!CONFIG.WEBHOOK_URL)    throw new Error('CONFIG.WEBHOOK_URL is empty — see docs/SETUP.md § D.');
  if (!CONFIG.WEBHOOK_SECRET) throw new Error('CONFIG.WEBHOOK_SECRET is empty — it must match the ' +
    'BING_WEBHOOK_SECRET script property in the Apps Script project.');

  var months = monthList_(CONFIG.MONTHS_BACK, CONFIG.INCLUDE_CURRENT_MONTH);
  Logger.log('Pushing ' + months.length + ' month(s): ' + months[0].month + ' → ' +
    months[months.length - 1].month);

  var accounts = resolveAccounts_();
  Logger.log('Accounts: ' + accounts.map(function (a) { return a.label; }).join(', '));

  var rows = [];
  for (var a = 0; a < accounts.length; a++) {
    selectAccount_(accounts[a]);
    for (var m = 0; m < months.length; m++) {
      try {
        var got = monthRows_(months[m], accounts[a]);
        rows = rows.concat(got);
        if (m === 0 || m === months.length - 1 || got.length === 0) {
          Logger.log(accounts[a].label + ' · ' + months[m].month + ': ' + got.length + ' campaign row(s)');
        }
      } catch (e) {
        // One bad month must not lose the other 25.
        Logger.log('ERROR ' + accounts[a].label + ' · ' + months[m].month + ': ' + e.message);
      }
    }
  }

  if (!rows.length) {
    Logger.log('No rows collected — nothing sent. Check ACCOUNT_IDS and that the account has ' +
      'spend in the window.');
    return;
  }

  var sent = post_(rows, months);
  Logger.log('Done. ' + sent + '/' + rows.length + ' row(s) accepted by the webhook.');
}

// ============================== ACCOUNTS ===================================

/**
 * Microsoft's multi-account object is AccountsApp, not AdsManagerApp — that one
 * is Google's. In a single-account script AccountsApp is absent entirely.
 */
function resolveAccounts_() {
  if (typeof AccountsApp === 'undefined') {
    var cur = AdsApp.currentAccount();
    return [{ label: cur.getName() + ' (' + cur.getAccountId() + ')', mcc: false }];
  }

  var sel = AccountsApp.accounts();
  if (CONFIG.ACCOUNT_IDS.length) sel = sel.withIds(CONFIG.ACCOUNT_IDS.map(String));

  var out = [], it = sel.get();
  while (it.hasNext()) {
    var acc = it.next();
    out.push({ label: acc.getName() + ' (' + acc.getAccountId() + ')', account: acc, mcc: true });
  }
  if (!out.length) {
    throw new Error('No accounts matched CONFIG.ACCOUNT_IDS = [' + CONFIG.ACCOUNT_IDS.join(', ') +
      ']. Leave it empty to use every account this script can see.');
  }
  return out;
}

function selectAccount_(acc) { if (acc.mcc) AccountsApp.select(acc.account); }

// ============================== ONE MONTH ==================================

/**
 * All campaigns' stats for one month, as report rows.
 *
 * Three selectors, not one: Microsoft exposes shopping and Performance Max
 * campaigns through their own selectors, and campaigns() does not reliably
 * include them. Results are deduped by campaign id, so a campaign returned by
 * two selectors is counted once — double-counting spend here would be invisible
 * downstream.
 */
function monthRows_(month, acc) {
  var seen = {}, rows = [];

  var selectors = [
    ['campaigns', function () { return AdsApp.campaigns(); }],
    ['shoppingCampaigns', function () { return AdsApp.shoppingCampaigns(); }],
    ['performanceMaxCampaigns', function () { return AdsApp.performanceMaxCampaigns(); }],
  ];

  for (var s = 0; s < selectors.length; s++) {
    var name = selectors[s][0];
    var it;
    try {
      it = selectors[s][1]().forDateRange(month.from, month.to).get();
    } catch (e) {
      // Not every account type exposes every selector.
      Logger.log('  (' + name + ' unavailable for ' + acc.label + ': ' + e.message + ')');
      continue;
    }

    while (it.hasNext()) {
      var c = it.next();
      var id = String(c.getId());
      if (seen[id]) continue;
      seen[id] = true;

      var st = c.getStats();
      var impressions = num_(st.getImpressions());
      var clicks      = num_(st.getClicks());
      var cost        = num_(st.getCost());
      if (!impressions && !clicks && !cost) continue;    // month with no activity

      rows.push({
        // Dated the 1st purely as a stable key. grain='month' is what actually
        // tells the Apps Script side to match this by month rather than by day.
        date: month.month + '-01',
        grain: 'month',
        channel: CHANNEL,
        account: acc.label,
        campaign_id: id,
        campaign: c.getName(),
        channel_type: campaignType_(name),
        channel_sub_type: '',
        labels: labelsOf_(c),
        impressions: impressions,
        clicks: clicks,
        cost: round2_(cost),
        conversions: num_(st.getConversions()),
        conversions_value: round2_(st.getRevenue()),
        search_impression_share: '',   // not exposed on Stats; slide 9 is Google-only
      });
    }
  }
  return rows;
}

/** Which selector found it → the tactic vocabulary the Apps Script expects. */
function campaignType_(selectorName) {
  if (selectorName === 'shoppingCampaigns')       return 'SHOPPING';
  if (selectorName === 'performanceMaxCampaigns') return 'PERFORMANCE_MAX';
  return 'SEARCH';
}

/**
 * Campaign labels, which the Apps Script prefers over name regexes for the brand
 * axis. Wrapped because label support varies by campaign type and account.
 */
function labelsOf_(campaign) {
  try {
    var out = [], it = campaign.labels().get();
    while (it.hasNext()) out.push(it.next().getName());
    return out.join('|');
  } catch (e) {
    return '';
  }
}

// ============================== POST =======================================

function post_(rows, months) {
  var accepted = 0;

  for (var i = 0; i < rows.length; i += CONFIG.BATCH_SIZE) {
    var batch = rows.slice(i, i + CONFIG.BATCH_SIZE);
    var payload = {
      secret: CONFIG.WEBHOOK_SECRET,
      source: 'microsoft-ads-script',
      channel: CHANNEL,
      // The months this run covers. The receiver replaces exactly these months
      // for this channel, so a re-run is idempotent and a month that has gone to
      // zero spend is cleared rather than left stale.
      months: months.map(function (m) { return m.month; }),
      // Only the first batch may clear; later batches append to it.
      replace: i === 0,
      rows: batch,
    };

    var res = UrlFetchApp.fetch(CONFIG.WEBHOOK_URL, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
      followRedirects: true,
    });

    var code = res.getResponseCode();
    var body = res.getContentText();

    if (code !== 200) {
      throw new Error('Webhook returned HTTP ' + code + ' on batch ' +
        (Math.floor(i / CONFIG.BATCH_SIZE) + 1) + '. Body: ' + body.slice(0, 400) +
        '\n\nCommon causes: the deployment is not set to "Anyone" access, the URL is the /dev ' +
        'one instead of /exec, or the deployment was not re-published after a code change.');
    }

    var parsed;
    try { parsed = JSON.parse(body); }
    catch (e) {
      throw new Error('Webhook did not return JSON. This almost always means the URL is an Apps ' +
        'Script HTML error page — check the deployment is a Web App with "Anyone" access. ' +
        'First 300 chars: ' + body.slice(0, 300));
    }

    if (!parsed.ok) {
      throw new Error('Webhook rejected the batch: ' + (parsed.error || '(no reason given)') +
        (parsed.error && parsed.error.indexOf('secret') !== -1
          ? '  →  CONFIG.WEBHOOK_SECRET must match the BING_WEBHOOK_SECRET script property exactly.'
          : ''));
    }

    accepted += num_(parsed.written);
    Logger.log('  batch ' + (Math.floor(i / CONFIG.BATCH_SIZE) + 1) + ': ' +
      parsed.written + ' row(s) written' + (parsed.replaced ? ' (tab reset first)' : ''));
  }
  return accepted;
}

// ============================== MONTHS =====================================

/**
 * Months to push, oldest first, each with the {year, month, day} objects
 * forDateRange() expects.
 */
function monthList_(monthsBack, includeCurrent) {
  var now = new Date();
  var out = [];
  var last = includeCurrent ? 0 : 1;    // 0 = this month, 1 = last complete month

  for (var i = monthsBack - 1 + last; i >= last; i--) {
    var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    var y = d.getFullYear(), m = d.getMonth() + 1;
    var lastDay = new Date(y, m, 0).getDate();
    out.push({
      month: y + '-' + pad2_(m),
      from: { year: y, month: m, day: 1 },
      to:   { year: y, month: m, day: lastDay },
    });
  }
  return out;
}

function pad2_(n) { return (n < 10 ? '0' : '') + n; }
function num_(v) { var x = Number(v); return isFinite(x) ? x : 0; }
function round2_(v) { return Math.round(num_(v) * 100) / 100; }

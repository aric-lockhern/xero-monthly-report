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

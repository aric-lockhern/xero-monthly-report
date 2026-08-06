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

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
    '  CVR basis           ' + CVR_BASIS);
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

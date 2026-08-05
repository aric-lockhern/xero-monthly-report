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

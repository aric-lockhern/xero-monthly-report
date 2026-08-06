#!/usr/bin/env node
/**
 * Local harness — run the real report logic with no Google account.
 * =============================================================================
 * Loads every apps-script/*.gs file into a sandbox with the Google Apps Script
 * globals stubbed, points it at a CSV export of the Triple Whale `_store` tab,
 * builds the whole report in memory, and runs the SelfTest.gs invariants.
 *
 * This is the cheapest way to pressure-test a change: no deploy, no Google
 * account, no waiting on a trigger. It exercises ingest, classification,
 * component summing, ratio derivation, block layout and the named-range shapes —
 * everything except the Sheets/Slides API calls themselves.
 *
 * USAGE
 *   1. In the Triple Whale spreadsheet, unhide the `_store` tab
 *      (Extensions → Apps Script is not needed — right-click the tab strip).
 *   2. File → Download → Comma-separated values, with `_store` active.
 *   3. node tools/harness.js --store ~/Downloads/store.csv --month 2026-07
 *
 * OPTIONS
 *   --store <path>     CSV or JSON export of the `_store` tab        (required)
 *   --month <yyyy-MM>  month to report          (default: last complete month)
 *   --region <US|EU>   sets REGION and CURRENCY                 (default: US)
 *   --engine [path]    inject engine fixtures, so slides 8-12 and the
 *                      engine-only YoY fallback are exercised too.
 *                      Defaults to tools/fixtures/engine-sample.json
 *   --blocks <a,b>     only print these named ranges (default: all)
 *   --quiet            self-test results only, no block dumps
 *
 * EXIT CODE is non-zero if any self-test invariant fails, so this drops into CI
 * or a pre-commit hook unchanged.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC_DIR = path.join(__dirname, '..', 'apps-script');
// Config first so its top-level vars exist; the rest share one global scope, as
// they do in Apps Script itself.
const LOAD_ORDER = ['Config', 'Metrics', 'Util', 'Ingest', 'Classify', 'Report',
                    'ReportDetail', 'Slides', 'Diagnostics', 'SelfTest', 'Code'];

// ============================== ARGS ======================================

function parseArgs(argv) {
  const out = { region: 'US', month: '', store: '', engine: null, blocks: null, quiet: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith('--')) die(`${a} needs a value`);
      i++;
      return v;
    };
    switch (a) {
      case '--store':  out.store = next(); break;
      case '--month':  out.month = next(); break;
      case '--region': out.region = next().toUpperCase(); break;
      case '--blocks': out.blocks = next().split(',').map(s => s.trim()); break;
      case '--quiet':  out.quiet = true; break;
      case '--engine':
        out.engine = (argv[i + 1] && !argv[i + 1].startsWith('--'))
          ? argv[++i]
          : path.join(__dirname, 'fixtures', 'engine-sample.json');
        break;
      case '--help': case '-h': usage(); process.exit(0); break;
      default: die(`unknown option ${a}`);
    }
  }
  if (!out.store) die('--store is required. See --help.');
  if (out.month && !/^\d{4}-\d{2}$/.test(out.month)) die(`--month must be yyyy-MM, got "${out.month}"`);
  return out;
}

function usage() {
  console.log(fs.readFileSync(__filename, 'utf8')
    .split('\n').slice(1).filter(l => l.startsWith(' *')).map(l => l.replace(/^ \*ent?/, '').replace(/^ \*ent? ?/, '').replace(/^ \* ?/, '')).join('\n'));
}
function die(msg) { console.error('harness: ' + msg); process.exit(2); }

const ARGS = parseArgs(process.argv);

// ============================== STORE LOADING =============================

/** Minimal RFC4180 CSV parser — quoted fields, embedded commas and newlines. */
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  // Strip a UTF-8 BOM, which Google Sheets exports include.
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(c => String(c).trim() !== ''));
}

/**
 * Load the store as a 2-D grid. Numeric-looking cells become numbers so the
 * sandbox sees what the real Sheets API would hand it; the Date column stays a
 * string, which is how the `_store` tab writes it (`@` format).
 */
function loadStore(file) {
  const raw = fs.readFileSync(file, 'utf8');
  let grid;
  if (file.toLowerCase().endsWith('.json')) {
    const parsed = JSON.parse(raw);
    grid = Array.isArray(parsed) ? parsed : (parsed[ARGS.region] || parsed.rows);
    if (!grid) die(`${file} has no array, and no "${ARGS.region}" or "rows" key`);
  } else {
    grid = parseCsv(raw);
  }
  if (!grid.length) die(`${file} is empty`);

  const header = grid[0].map(h => String(h).trim());
  const dateCol = header.findIndex(h => h.toLowerCase() === 'date');
  if (dateCol === -1) {
    die(`${file} has no "Date" column — is this really the _store tab? Found: ${header.join(', ')}`);
  }

  const body = grid.slice(1).map(r => r.map((v, c) => {
    if (c === dateCol) return String(v).trim().slice(0, 10);
    if (typeof v === 'number') return v;
    const s = String(v).trim();
    if (s === '') return '';
    const n = Number(s);
    return (isFinite(n) && /^-?[\d.]+(e[-+]?\d+)?$/i.test(s)) ? n : s;
  }));

  return [header].concat(body);
}

// ============================== APPS SCRIPT STUBS =========================

const TZ = 'America/New_York';
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
                     'July', 'August', 'September', 'October', 'November', 'December'];
const pad = (n) => String(n).padStart(2, '0');

const Utilities = {
  formatDate(d, tz, fmt) {
    const Y = d.getFullYear(), M = d.getMonth(), D = d.getDate();
    const h = d.getHours(), m = d.getMinutes(), s = d.getSeconds();
    switch (fmt) {
      case 'yyyy-MM-dd':          return `${Y}-${pad(M + 1)}-${pad(D)}`;
      case 'yyyy-MM':             return `${Y}-${pad(M + 1)}`;
      case 'MMMM yyyy':           return `${MONTH_NAMES[M]} ${Y}`;
      case 'MMM yyyy':            return `${MONTH_NAMES[M].slice(0, 3)} ${Y}`;
      case 'MM/dd/yy':            return `${pad(M + 1)}/${pad(D)}/${String(Y).slice(2)}`;
      case 'yyyy-MM-dd HH:mm':    return `${Y}-${pad(M + 1)}-${pad(D)} ${pad(h)}:${pad(m)}`;
      case 'yyyy-MM-dd HH:mm:ss': return `${Y}-${pad(M + 1)}-${pad(D)} ${pad(h)}:${pad(m)}:${pad(s)}`;
      default: throw new Error('harness: unhandled date format "' + fmt + '"');
    }
  },
};

const statusLog = [];
const Session = { getScriptTimeZone: () => TZ };
const Logger = { log: (m) => statusLog.push(String(m)) };

const sheets = {};
const namedRanges = {};

function mockSheet(name, grid) {
  const data = grid ? grid.map(r => r.slice()) : [];
  const charts = [];
  const self = {
    _name: name, _data: data,
    getName: () => name,
    getLastRow: () => data.length,
    getLastColumn: () => data.reduce((m, r) => Math.max(m, r.length), 0),
    getMaxRows: () => Math.max(data.length, 1000),
    getMaxColumns: () => 40,
    getRange: (r, c, nr, nc) => mockRange(self, r, c, nr === undefined ? 1 : nr, nc === undefined ? 1 : nc),
    clear() { data.length = 0; return self; },
    clearContents() { data.length = 0; return self; },
    clearNotes: () => self,
    getCharts: () => charts,
    removeChart: () => self,
    insertChart: (c) => { charts.push(c); return self; },
    newChart: () => chartBuilder(),
    setFrozenRows: () => self, setFrozenColumns: () => self,
    setColumnWidth: () => self, autoResizeColumn: () => self,
    hideSheet: () => self, getFilter: () => null,
  };
  return self;
}

function chartBuilder() {
  const b = {};
  ['asLineChart', 'addRange', 'setNumHeaders', 'setPosition', 'setOption'].forEach(m => { b[m] = () => b; });
  b.build = () => ({ chart: true });
  return b;
}

function mockRange(sheet, row, col, nr, nc) {
  const d = sheet._data;
  const self = {
    getNumRows: () => nr, getNumColumns: () => nc,
    getSheet: () => sheet,
    getA1Notation: () => `R${row}C${col}:R${row + nr - 1}C${col + nc - 1}`,
    getValues() {
      const out = [];
      for (let r = 0; r < nr; r++) {
        const src = d[row - 1 + r] || [];
        const line = [];
        for (let c = 0; c < nc; c++) {
          const v = src[col - 1 + c];
          line.push(v === undefined ? '' : v);
        }
        out.push(line);
      }
      return out;
    },
    getDisplayValues() {
      return self.getValues().map(r => r.map(v => (v === null || v === undefined) ? '' : String(v)));
    },
    setValues(vals) {
      for (let r = 0; r < vals.length; r++) {
        const target = row - 1 + r;
        while (d.length <= target) d.push([]);
        for (let c = 0; c < vals[r].length; c++) d[target][col - 1 + c] = vals[r][c];
      }
      return self;
    },
    setValue(v) { return self.setValues([[v]]); },
  };
  ['setFontWeight', 'setBackground', 'setFontColor', 'setFontSize', 'setFontStyle',
   'setNumberFormat', 'setBorder', 'setWrap', 'setVerticalAlignment', 'setNote',
   'setHorizontalAlignment'].forEach(m => { self[m] = () => self; });
  return self;
}

const activeSpreadsheet = {
  getSheetByName: (n) => sheets[n] || null,
  insertSheet: (n) => (sheets[n] = mockSheet(n)),
  getRangeByName: (n) => namedRanges[n] || null,
  setNamedRange: (n, r) => { namedRanges[n] = r; },
  removeNamedRange: (n) => { delete namedRanges[n]; },
  getNamedRanges: () => Object.keys(namedRanges)
    .map(n => ({ getName: () => n, getRange: () => namedRanges[n] })),
};

const twStoreSheet = mockSheet('_store', loadStore(ARGS.store));

const SpreadsheetApp = {
  getActiveSpreadsheet: () => activeSpreadsheet,
  openById: () => ({ getSheetByName: (n) => (n === '_store' ? twStoreSheet : null) }),
  flush: () => {},
  // No UI in Node: tell_() catches this and falls back to the status log, which
  // is exactly what happens on a real trigger run.
  getUi: () => { throw new Error('harness: no UI'); },
  BorderStyle: { SOLID: 'SOLID' },
};

const SlidesApp = { openById: () => { throw new Error('harness: Slides is not stubbed'); } };
const DriveApp = { getFileById: () => { throw new Error('harness: Drive is not stubbed'); } };
const ScriptApp = { getProjectTriggers: () => [], newTrigger: () => { throw new Error('harness: no triggers'); } };
const LockService = { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) };
const PropertiesService = { getScriptProperties: () => ({ getProperty: () => null, setProperty: () => {} }) };

// ============================== ENGINE FIXTURES ===========================

if (ARGS.engine) {
  if (!fs.existsSync(ARGS.engine)) die(`--engine file not found: ${ARGS.engine}`);
  const fixtures = JSON.parse(fs.readFileSync(ARGS.engine, 'utf8'));
  const reportMonth = ARGS.month || defaultMonth();

  Object.keys(fixtures).forEach(tab => {
    // Documentation keys such as "_comment" are underscore-prefixed but are not
    // engine tabs. `_comment` holds an array of strings, so an Array.isArray
    // test is not enough to tell them apart.
    if (tab.charAt(0) === '_' && tab.indexOf('_eng') !== 0) return;
    let grid = fixtures[tab];
    // A `_generate` block expands to daily rows, so the fixture file stays short
    // and its dates track the month under test.
    grid = (grid && grid._generate) ? expandGenerated(grid, tab)
                                    : substituteMonth(grid, reportMonth);
    sheets[tab] = mockSheet(tab, grid);
  });
}

/** Replace $REPORT_MONTH in plain fixture grids, including 'yyyy-MM-dd' dates. */
function substituteMonth(grid, month) {
  if (!Array.isArray(grid)) die('fixture tab is neither an array nor a _generate spec');
  return grid.map(row => row.map(cell =>
    (typeof cell === 'string' && cell.indexOf('$REPORT_MONTH') !== -1)
      ? cell.replace('$REPORT_MONTH', month)
      : cell));
}

/**
 * Expand { header, _generate: { months: [[monthOffset, factor]], days, rows } }
 * into daily rows. Month offsets are relative to the month under test, so
 * offset 0 = report month, -1 = prior, -12 = year-ago.
 */
function expandGenerated(spec, tab) {
  const base = ARGS.month || defaultMonth();
  const out = [spec.header];
  const [Y, M] = [Number(base.slice(0, 4)), Number(base.slice(5, 7))];

  spec._generate.months.forEach(([offset, factor]) => {
    const dt = new Date(Y, M - 1 + offset, 1);
    const month = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}`;
    const daysInMonth = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate();
    const days = Math.min(spec._generate.days || daysInMonth, daysInMonth);

    for (let day = 1; day <= days; day++) {
      spec._generate.rows.forEach(template => {
        out.push(template.map(cell => {
          if (cell === '$DATE')  return `${month}-${pad(day)}`;
          if (cell === '$MONTH') return month;
          if (typeof cell === 'object' && cell && cell.scale !== undefined) {
            return Math.round(cell.scale * factor);
          }
          return cell;
        }));
      });
    }
  });
  if (!ARGS.quiet) console.log(`  fixture ${tab}: ${out.length - 1} generated rows`);
  return out;
}

function defaultMonth() {
  const now = new Date();
  const last = new Date(now.getFullYear(), now.getMonth(), 0);
  return `${last.getFullYear()}-${pad(last.getMonth() + 1)}`;
}

// ============================== LOAD + PATCH CONFIG =======================

let source = LOAD_ORDER.map(f => {
  const p = path.join(SRC_DIR, f + '.gs');
  if (!fs.existsSync(p)) die(`missing source file ${p}`);
  return `/* ===== ${f}.gs ===== */\n` + fs.readFileSync(p, 'utf8');
}).join('\n;\n');

/** Rewrite a top-level `var NAME = ...;` so Config.gs stays untouched on disk. */
function setConfig(name, literal) {
  const re = new RegExp(`^var ${name} = [^\\n]*?;`, 'm');
  if (!re.test(source)) die(`could not find "var ${name} = …;" in Config.gs`);
  source = source.replace(re, `var ${name} = ${literal};`);
}

setConfig('TW_SPREADSHEET_ID', "'HARNESS'");
setConfig('REPORT_MONTH', `'${ARGS.month}'`);
setConfig('REGION', `'${ARGS.region}'`);
setConfig('CURRENCY', ARGS.region === 'EU' ? "'EUR'" : "'USD'");

const sandbox = {
  Utilities, Session, Logger, SpreadsheetApp, SlidesApp, DriveApp,
  ScriptApp, LockService, PropertiesService, console,
};
const context = vm.createContext(sandbox);

try {
  vm.runInContext(source, context, { filename: 'apps-script-bundle.js' });
} catch (e) {
  console.error('harness: failed to load the Apps Script source.\n' + e.stack);
  process.exit(2);
}

// ============================== RUN =======================================

const HR = '='.repeat(78);
console.log(HR);
console.log(`Xero Shoes monthly report — LOCAL HARNESS`);
console.log(`  store   ${ARGS.store}`);
console.log(`  region  ${ARGS.region}      month  ${ARGS.month || '(last complete)'}`);
console.log(`  engine  ${ARGS.engine || 'not injected — slides 8-12 will be empty'}`);
console.log(HR);

let ctx;
try {
  ctx = vm.runInContext('buildReportContext_()', context);
  sandbox.__ctx = ctx;
  vm.runInContext('renderReportTab_(__ctx)', context);
  vm.runInContext('renderCampaignMap_(__ctx.mapRows, __ctx.classify)', context);
} catch (e) {
  console.error('\n✗ BUILD FAILED\n' + e.stack);
  process.exit(1);
}

console.log(`\nBuilt ${Object.keys(namedRanges).length} blocks for ${ctx.periods.current.label}.`);
if (ctx.warnings.length) {
  console.log('\nWARNINGS');
  ctx.warnings.forEach(w => console.log(wrap('  ⚠ ', w)));
}

if (!ARGS.quiet) {
  const want = ARGS.blocks || Object.keys(namedRanges).sort();
  want.forEach(dumpBlock);
  dumpCampaignMap();
}

// ---- the same invariants the live sheet checks ----
console.log('\n' + HR);
console.log('SELF-TEST  (apps-script/SelfTest.gs — identical to Diagnostics → Run self-test)');
console.log(HR);

let report;
try {
  report = vm.runInContext('selfTestReport_()', context);
} catch (e) {
  console.error('\n✗ SELF-TEST CRASHED\n' + e.stack);
  process.exit(1);
}
report.lines.forEach(l => console.log(l));

process.exit(report.failed ? 1 : 0);

// ============================== OUTPUT HELPERS ============================

function wrap(prefix, text, width) {
  width = width || 74;
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  words.forEach(word => {
    if ((line + ' ' + word).trim().length > width) { lines.push(line.trim()); line = word; }
    else line += ' ' + word;
  });
  if (line.trim()) lines.push(line.trim());
  const indent = ' '.repeat(prefix.length);
  return lines.map((l, i) => (i ? indent : prefix) + l).join('\n');
}

function cell(v, w) {
  w = w || 13;
  if (v === null || v === undefined || v === '') return '·'.padStart(w);
  if (typeof v === 'number') {
    const s = (Number.isInteger(v) && Math.abs(v) < 1e15)
      ? v.toLocaleString()
      : (Math.abs(v) < 1 ? v.toFixed(4) : v.toFixed(2));
    return s.slice(0, w).padStart(w);
  }
  return String(v).slice(0, w).padStart(w);
}

function dumpBlock(name) {
  const r = namedRanges[name];
  if (!r) { console.log(`\n[${name}]  MISSING`); return; }
  const v = r.getValues();
  console.log(`\n[${name}]  ${v.length}×${v[0].length}`);
  const w = v[0].length > 9 ? 13 : 20;
  v.forEach(row => console.log('  ' + row.map(c => cell(c, w)).join('')));
}

function dumpCampaignMap() {
  const sheet = sheets['Campaign Map'];
  if (!sheet) return;
  const rows = sheet._data;
  console.log(`\n[Campaign Map]  ${rows.length - 1} campaign(s)`);
  const cols = [0, 1, 6, 7, 8, 9];   // channel, campaign, tactic, brand, group, cost
  rows.slice(0, 11).forEach(r => {
    console.log('  ' + cols.map(c => cell(r[c], c === 1 ? 34 : 14)).join(''));
  });
  if (rows.length > 11) console.log(`  … ${rows.length - 11} more`);
}

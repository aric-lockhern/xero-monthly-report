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
 *   --bundled          load dist/Code.gs instead of apps-script/*.gs, to verify
 *                      the single-file build people actually paste into Apps
 *                      Script behaves identically to the sources
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
const LOAD_ORDER = ['Config', 'Settings', 'Metrics', 'Util', 'Ingest', 'Classify', 'Report',
                    'ReportDetail', 'ProductImages', 'Slides', 'Webhook', 'Diagnostics', 'SelfTest', 'Code'];

// ============================== ARGS ======================================

function parseArgs(argv) {
  const out = { region: 'US', month: '', store: '', engine: null, blocks: null, quiet: false, bundled: false };
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
      case '--bundled': out.bundled = true; break;
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

/**
 * Calls into the Sheets API that only work by accident. Recorded rather than
 * swallowed, because a stub that is more forgiving than the real API hides bugs
 * instead of finding them — which is exactly how the first-run
 * removeNamedRange crash reached a live spreadsheet.
 */
const apiViolations = [];

const activeSpreadsheet = {
  getSheetByName: (n) => sheets[n] || null,
  insertSheet: (n) => (sheets[n] = mockSheet(n)),
  getRangeByName: (n) => (namedRanges[n] ? namedRanges[n].range : null),
  setNamedRange: (n, r) => { namedRanges[n] = { range: r }; },

  // Apps Script THROWS here when the name does not exist:
  //   Exception: The named range "RPT_KPI" does not exist.
  // And because Apps Script batches writes, that throw can surface at the next
  // flush() rather than at the call site — so a try/catch around it is not a
  // reliable guard. Correct code must not call this on a missing name at all.
  removeNamedRange: (n) => {
    if (!namedRanges[n]) {
      apiViolations.push(`removeNamedRange("${n}") on a name that does not exist — ` +
        `throws in Apps Script, and the throw may be deferred to the next flush() ` +
        `where a try/catch cannot help. Check whether the range exists first.`);
      throw new Error(`The named range "${n}" does not exist.`);
    }
    delete namedRanges[n];
  },

  getNamedRanges: () => Object.keys(namedRanges).map(n => ({
    getName: () => n,
    getRange: () => namedRanges[n].range,
    setRange: (r) => { namedRanges[n].range = r; },
  })),
};

// A Settings tab, so the override path is exercised rather than assumed. The
// values deliberately differ from the Config.gs defaults.
sheets['Settings'] = mockSheet('Settings', [
  ['Setting', 'Value', 'What it is'],
  ['TW_SPREADSHEET_ID', 'HARNESS', ''],
  ['DECK_TEMPLATE_ID', 'HARNESS_DECK_ID', ''],
  ['DECK_OUTPUT_FOLDER_ID', '', ''],
  ['REGION', ARGS.region, ''],
  ['CURRENCY', ARGS.region === 'EU' ? 'EUR' : 'USD', ''],
  ['REPORT_MONTH', ARGS.month, ''],
  ['CVR_BASIS', 'clicks', ''],
  ['TW_SESSION_FIELD', '', ''],
  ['PRODUCT_FEED_URL', '', ''],
  // Written the way a person would type it, not as the API field, so the tolerant
  // resolver is exercised rather than the exact-match path.
  ['PRODUCT_DIM_1', 'Custom label 2', ''],
  ['PRODUCT_DIM_2', 'l1', ''],
  ['BOGUS_KEY', 'ignored', ''],
]);

// Slide 10's manual paste, headed the way a Google Ads export is — NOT the way the
// tab is seeded. That is the case worth testing: the loose column matching is the
// whole reason a paste works at all, so a fixture using our own headers would prove
// nothing. Note the CATEGORY-style header, which must still be accepted now that the
// slide is about terms.
//
// Dated 1999-01 on purpose. The paste takes priority over the engine tab, so rows in
// the report month would mask the `_eng_pmax_term` path entirely and only one of the
// two sources would ever be tested. Dating them to a month under no test lets the
// month filter, the parser, and the engine path all be checked independently.
sheets['PMax Categories'] = mockSheet('PMax Categories', [
  ['Month', 'Search category', 'Search volume', 'Impr.', 'Clicks', 'Cost', 'Conv.', 'Conv. value'],
  ['', 'Paste your PMax search terms export here →', '', '', '', '', '', ''],
  ['1999-01', 'barefoot running shoes', '10K-100K', '48,200', '1,910', '$2,410.55', '61', '$7,880'],
  ['1999-01', 'minimalist sandals', '1K-10K', '12,050', '402', '$610.20', '14', '$1,940'],
]);

// Product Images, so slide 11's image resolution is exercised. Deliberately mixed:
// one match by item id, one by title, one row with a blank URL that must be ignored.
//
// The last row is the case that failed in the real deck. A Shopping feed carries one
// row per SIZE variant and an out-of-stock variant drops out, so the item id Google
// Ads reports can be absent while a sibling size — same title, same photo — is
// present. On top of that the feed and the Ads report punctuate the title
// differently: "Light Gray/Pink Sand" here versus "Light Gray / Pink Sand" there.
// Both have to be tolerated or the frame stays empty.
sheets['Product Images'] = mockSheet('Product Images', [
  ['item_id', 'title', 'image_url', 'source'],
  ['XS-PRIO-NEO-M', '', 'https://example.com/prio-neo.jpg', 'feed'],
  ['', 'Z-Trail EV Womens Sandal', 'https://example.com/ztrail.jpg', 'manual'],
  ['XS-HFS-II-M', 'HFS II Mens Running Shoe', '', 'feed'],
  ['shopify_us_111_9001',
   'Xero Shoes - Barefoot Shoes - HFS Original - Women - Light Gray/Pink Sand - Zero Drop Shoes',
   'https://example.com/hfs-original-gray.jpg', 'feed'],
]);

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
const UrlFetchApp = {
  fetch: () => { throw new Error('harness: UrlFetchApp is not stubbed (no network in tests)'); },
};
const XmlService = {
  parse: () => { throw new Error('harness: XmlService is not stubbed'); },
  getNamespace: (u) => ({ uri: u }),
};
const DriveApp = { getFileById: () => { throw new Error('harness: Drive is not stubbed'); } };
const ScriptApp = { getProjectTriggers: () => [], newTrigger: () => { throw new Error('harness: no triggers'); } };
const LockService = { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) };
const scriptProps = {};
const PropertiesService = {
  getScriptProperties: () => ({
    getProperty: (k) => (scriptProps[k] === undefined ? null : scriptProps[k]),
    setProperty: (k, v) => { scriptProps[k] = v; },
  }),
};
const ContentService = {
  MimeType: { JSON: 'application/json' },
  createTextOutput: (t) => ({ _text: t, setMimeType: () => ({ _text: t, getContent: () => t }), getContent: () => t }),
};

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
    // Belt and braces: a documentation key that happens to start with `_eng` would
    // otherwise be loaded as a tab and crash inside substituteMonth, which is a
    // confusing way to learn you named a comment badly.
    const shape = fixtures[tab];
    if (Array.isArray(shape) && shape.length && !Array.isArray(shape[0])) {
      die(`fixture key "${tab}" looks like a comment (array of strings) but is named as an engine ` +
          `tab. Rename it to start with "_comment".`);
    }
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

let source;
if (ARGS.bundled) {
  // Verify the artifact that actually gets pasted into Apps Script, not just the
  // sources it was built from.
  const bundlePath = path.join(__dirname, '..', 'dist', 'Code.gs');
  if (!fs.existsSync(bundlePath)) die('dist/Code.gs not found — run `node tools/bundle.js` first');
  source = fs.readFileSync(bundlePath, 'utf8');
} else {
  source = LOAD_ORDER.map(f => {
    const p = path.join(SRC_DIR, f + '.gs');
    if (!fs.existsSync(p)) die(`missing source file ${p}`);
    return `/* ===== ${f}.gs ===== */\n` + fs.readFileSync(p, 'utf8');
  }).join('\n;\n');
}

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
  ScriptApp, LockService, PropertiesService, ContentService, console,
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
  // Overlay the Settings tab exactly as every entry point does.
  const settingsResult = vm.runInContext('applySettings_()', context);
  if (!ARGS.quiet && settingsResult) {
    console.log(`  settings applied from tab: ${(settingsResult.applied || []).join(', ') || 'none'}`);
  }
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

// ---- product image resolution (slide 11) ----
const imgChecks = vm.runInContext(`(function () {
  var map = readProductImages_();
  return {
    count: map.count,
    byId: productImageUrl_(map, 'XS-PRIO-NEO-M', 'whatever'),
    byIdCaseInsensitive: productImageUrl_(map, 'xs-prio-neo-m', ''),
    byTitle: productImageUrl_(map, 'NO-SUCH-ID', 'Z-Trail EV Womens Sandal'),
    byTitleWhitespace: productImageUrl_(map, '', '  z-trail  ev   womens sandal '),
    blankUrlRowIgnored: productImageUrl_(map, 'XS-HFS-II-M', 'HFS II Mens Running Shoe'),
    unknown: productImageUrl_(map, 'NOPE', 'Nope'),

    // The real failure: an out-of-stock variant's id is absent from the feed, and the
    // feed spaces the slash differently. Two sibling variant ids, one shared title —
    // both must resolve to the one image, which is what the deck's two blank frames
    // needed.
    variantIdAbsent: productImageUrl_(map, 'shopify_us_111_9002',
      'Xero Shoes - Barefoot Shoes - HFS Original - Women - Light Gray / Pink Sand - Zero Drop Shoes'),
    siblingVariant: productImageUrl_(map, 'shopify_us_111_9003',
      'Xero Shoes - Barefoot Shoes - HFS Original - Women - Light Gray / Pink Sand - Zero Drop Shoes'),
    // Title beats id when both are present and they disagree — for imagery the title
    // is the correct key, because everything sharing a title looks identical.
    titleWinsOverId: productImageUrl_(map, 'XS-PRIO-NEO-M', 'Z-Trail EV Womens Sandal'),
  };
})()`, context);

/**
 * Assert, print, and fail the process — ALWAYS evaluated, printed in full only
 * when verbose.
 *
 * The distinction matters: these checks used to live inside `if (!ARGS.quiet)`,
 * which meant `npm test` — the quiet one, the one CI runs — skipped them entirely.
 * A test that only runs when a human is watching is not a test. Failures print
 * either way.
 */
const harnessFailures = [];
function expectEq(section, name, got, want) {
  const ok = got === want;
  if (!ok) {
    process.exitCode = 1;
    harnessFailures.push(`${section} · ${name}  →  got ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`);
  }
  if (!ARGS.quiet) {
    console.log(`  ${ok ? '✓' : '✗'} ${name}${ok ? '' : `  got ${JSON.stringify(got)} expected ${JSON.stringify(want)}`}`);
  }
  return ok;
}

if (!ARGS.quiet) console.log('\nPRODUCT IMAGES (slide 11 resolution)');
{
  const want = {
    count: 3,
    byId: 'https://example.com/prio-neo.jpg',
    byIdCaseInsensitive: 'https://example.com/prio-neo.jpg',
    byTitle: 'https://example.com/ztrail.jpg',
    byTitleWhitespace: 'https://example.com/ztrail.jpg',
    blankUrlRowIgnored: '',
    unknown: '',
    variantIdAbsent: 'https://example.com/hfs-original-gray.jpg',
    siblingVariant: 'https://example.com/hfs-original-gray.jpg',
    titleWinsOverId: 'https://example.com/ztrail.jpg',
  };
  Object.keys(want).forEach(k => expectEq('product images', k, imgChecks[k], want[k]));
}

// ---- slide 10's manual paste, and slide 8's dimension resolution ----
// The fixture rows are dated 1999-01 so they do not mask the engine path during the
// build; read that month directly to exercise the parser.
const pmax = vm.runInContext(`readPmaxManual_('1999-01')`, context);
const dimChecks = vm.runInContext(`(function () {
  return {
    dim1: PRODUCT_DIM_1.field, dim1Label: PRODUCT_DIM_1.label,
    dim2: PRODUCT_DIM_2.field, dim2Label: PRODUCT_DIM_2.label,
  };
})()`, context);

if (!ARGS.quiet) console.log('\nSLIDE 8 DIMENSIONS (resolved from the Settings tab)');
// 'Custom label 2' and 'l1' as typed on the tab must land on the API fields — the
// tolerant path, not the exact-match one.
[['dim1', 'product_custom_attribute2'], ['dim1Label', 'Custom Label 2'],
 ['dim2', 'product_type_l1'], ['dim2Label', 'Product Type 1']]
  .forEach(([k, want]) => expectEq('slide 8 dimensions', k, dimChecks[k], want));

// The engine fixture's `_eng_product` was written with attribute1 × attribute4,
// while the Settings tab above asks for attribute2 × product_type_l1. That is the
// real state between changing the setting and re-running the MCC script, and the
// block must head its columns for the DATA and say the two disagree — labelling
// real numbers with a dimension they don't describe is the one slide-8 failure
// that looks like success.
// Only meaningful with the engine fixtures loaded — with no `_eng_product` tab
// there is no recorded dimension to prefer, and the correct behaviour is to fall
// back to the configured labels.
if (ARGS.engine) {
  [
    ['columns are headed for the data, not the config',
      namedRanges['RPT_PRODUCT'] ? namedRanges['RPT_PRODUCT'].range.getValues()[0][0] : null,
      'Custom Label 1'],
    ['the disagreement is stated on the Report tab',
      /These columns are headed for what the tab HOLDS/.test(reportText()), true],
  ].forEach(([name, got, want]) => expectEq('slide 8 dimensions', name, got, want));
} else {
  expectEq('slide 8 dimensions', 'with no engine tab, the configured labels are used',
    namedRanges['RPT_PRODUCT'] ? namedRanges['RPT_PRODUCT'].range.getValues()[0][0] : null,
    'Custom Label 2');
}

if (!ARGS.quiet) console.log('\nSLIDE 10 MANUAL PASTE (loose column matching)');
[
  ['rows kept', pmax.rows.length, 2],
  ['placeholder row skipped', pmax.rows.some(r => /Paste your/.test(r.category)), false],
  // A category-headed export must still parse now that the slide is about terms.
  ['a "Search category" header still resolves', pmax.rows[0] && pmax.rows[0].category,
    'barefoot running shoes'],
  ['thousands separator parsed', pmax.rows[0] && pmax.rows[0].impressions, 48200],
  ['currency parsed', pmax.rows[0] && pmax.rows[0].cost, 2410.55],
  ['bucketed volume kept as text', pmax.rows[0] && pmax.rows[0].search_volume, '10K-100K'],
  ['no columns went unmapped', pmax.unmapped.length, 0],
  ['a paste for another month does not reach the slide', /Pasted by hand/.test(reportText()), false],
].forEach(([name, got, want]) => expectEq('slide 10 paste', name, got, want));

// ---- slide 10 from the engine: non-brand only, sorted by traffic ----
if (ARGS.engine) {
  if (!ARGS.quiet) console.log('\nSLIDE 10 PMAX SEARCH TERMS (engine path)');
  const block = namedRanges['RPT_PMAX_CAT']
    ? namedRanges['RPT_PMAX_CAT'].range.getValues()
    : [[]];
  const header = block[0] || [];
  const body = block.slice(1).filter(r => String(r[0] || '').trim());
  const terms = body.map(r => String(r[0]));
  const impr = body.map(r => Number(r[1]) || 0);

  [
    ['reads from campaign_search_term_view', /campaign_search_term_view/.test(reportText()), true],
    ['the column is headed Search Term', header[0], 'Search Term'],
    // The fixture's biggest term by far is "xero shoes" at 402k impressions. If it
    // appears at all, the brand filter is broken.
    ['brand terms are excluded', terms.some(t => /xero/i.test(t)), false],
    ['the brand exclusion is quantified in the note',
      /Excluded 2 brand term\(s\)/.test(reportText()), true],
    // "barefoot shoes" has the most impressions of the non-brand terms AND converts
    // at zero. Sorting by conversion value would bury it; it must lead.
    ['sorted by traffic, not by value', terms[0], 'barefoot shoes'],
    ['the zero-converting top term survived', body[0] && Number(body[0][5]), 0],
    ['impressions descend', impr.every((v, i) => i === 0 || impr[i - 1] >= v), true],
    ['"zero drop" survives as non-brand', terms.indexOf('zero drop running shoes') !== -1, true],
    ['all five non-brand terms are present', terms.length, 5],
    ['the click threshold is disclosed', /minimum monthly click count/.test(reportText()), true],
  ].forEach(([name, got, want]) => expectEq('slide 10 terms', name, got, want));

  // The search-terms feed keeps ONE month and rewrites the tab, so "I asked for a
  // month the feed no longer holds" is now the commonest way slide 10 comes back
  // empty — and it is not a failure. It must not read like one, because the fix is
  // completely different from the fix for a broken query.
  const wrongMonth = vm.runInContext(`(function () {
    var saved = REPORT_MONTH;
    REPORT_MONTH = '2001-09';
    try {
      var ctx = buildReportContext_();
      var said = [];
      var w = { block: function (o) { said.push(o.note || ''); } };
      renderPmaxCategoryBlock_(w, ctx);
      return said.join('\\n');
    } finally { REPORT_MONTH = saved; }
  })()`, context);

  [
    ['a month the feed lacks says so, and names what it has',
      /holds 2026-07/.test(wrongMonth) || /holds \d{4}-\d{2}/.test(wrongMonth), true],
    ['and says nothing is broken', /Nothing is broken/.test(wrongMonth), true],
    ['and does not claim the query failed',
      /_eng_status. carries Google/.test(wrongMonth), false],
  ].forEach(([name, got, want]) => expectEq('slide 10 window', name, got, want));
}

// ---- the dimension-discovery diagnostic's recommendation ----
//
// The fixture mirrors the real US feed: custom label 1 is the single value "shoes"
// for every product, and custom label 4 is female/male/unisex. Both are useless as
// a slide-8 category, and recommending either is the mistake this diagnostic exists
// to prevent — so assert what it recommends, not just that it runs.
{
  const advice = vm.runInContext(`(function () {
    var said = [];
    var realTell = tell_;
    tell_ = function (title, body) { said.push(String(body)); };
    try { diagProductDims(); } finally { tell_ = realTell; }
    return said.join('\\n');
  })()`, context);

  if (!ARGS.quiet) console.log('\nDIMENSION DIAGNOSTIC (slide 8 recommendation)');
  // With no engine fixtures there is no `_eng_product_dims` tab, and the only
  // correct behaviour is to say so and name the script that writes it.
  (ARGS.engine ? [
    ['recommends product_type_l1 first', /SUGGESTED:\s+PRODUCT_DIM_1 = product_type_l1/.test(advice), true],
    ['recommends product_type_l2 second', /PRODUCT_DIM_2 = product_type_l2/.test(advice), true],
    // A single-value dimension splits nothing — the deck would get a one-row table.
    ['flags the single-value label as unusable',
      /product_custom_attribute1\s+1 value\(s\).*← not usable/.test(advice), true],
    ['flags the all-brand dimension as unusable',
      /product_brand\s+1 value\(s\).*← not usable/.test(advice), true],
    // Mostly-blank is the other failure mode, and it must be reported as coverage
    // rather than silently ranked on its populated slice alone.
    ['reports low coverage on the sparse label',
      /product_custom_attribute0\s+1 value\(s\), 9% of spend populated/.test(advice), true],
    ['shows values with spend so the ranking can be overruled',
      /female\s+—\s+\$16,800 cost/.test(advice), true],
    ['tells you where to change it',
      /Set them on the Settings tab/.test(advice), true],
  ] : [
    ['says the tab is missing rather than recommending blindly',
      /is empty or absent/.test(advice), true],
    ['names the script that writes it',
      /engine-report\.js/.test(advice), true],
  ]).forEach(([name, got, want]) => expectEq('dimension diagnostic', name, got, want));
}

// ---- the two dimension resolvers, one per runtime, must agree ----
//
// Apps Script and Google Ads Scripts are separate runtimes with no module system
// between them, so resolveProductDim_() and resolveDimField_() are duplicated. A
// field one accepts and the other rejects means the Ads script queries one
// dimension while the deck labels another — real data under the wrong heading,
// which is the one slide-8 failure nobody would notice. Check them against each
// other here, where both files are readable.
{
  const adsSrc = fs.readFileSync(path.join(__dirname, '..', 'google-ads-script', 'engine-report.js'), 'utf8');
  const adsCtx = vm.createContext({ CONFIG: {}, Logger: { log() {} } });
  const fn = adsSrc.match(/function resolveDimField_[\s\S]*?\n}/);
  if (!fn) die('could not find resolveDimField_ in engine-report.js');
  vm.runInContext(fn[0], adsCtx);

  // The Ads script's pinned defaults. Both are hardcoded so re-pasting the file
  // does not mean re-typing them, and that convenience creates one way to be wrong:
  // a SPREADSHEET_ID pointing at a specific client's sheet while CUSTOMER_IDS is []
  // means "every account under this MCC", which sweeps other clients' spend into
  // these tabs. Pin the pairing so a future edit cannot half-undo it.
  {
    const cfg = adsSrc.match(/SPREADSHEET_ID:\s*'([^']*)'/);
    const ids = adsSrc.match(/CUSTOMER_IDS:\s*\[([^\]]*)\]/);
    const hasSheet = !!(cfg && cfg[1].trim());
    const hasIds = !!(ids && ids[1].trim());
    if (!ARGS.quiet) console.log('\nADS SCRIPT PINNED DEFAULTS');
    expectEq('ads defaults', 'a pinned spreadsheet is paired with pinned account ids',
      hasSheet === hasIds, true);
  }

  // ---- static guards on the PMax search-terms query ----
  //
  // Two ways to break this query that NO local test can catch, because both are GAQL
  // semantics only Google evaluates — the query still parses, still runs, and still
  // returns plausible rows. Assert them against the source instead.
  {
    const fn = adsSrc.match(/function fetchPmaxSearchTerms_[\s\S]*?\n}/);
    if (!fn) die('could not find fetchPmaxSearchTerms_ in engine-report.js');
    const src = fn[0];
    const filtersOnMetrics = /metrics\.clicks\s*>/.test(src);
    const selectsDate = /SELECT\s+segments\.date/.test(src);

    if (!ARGS.quiet) console.log('\nPMAX SEARCH-TERMS QUERY (static guards)');
    [
      // With segments.date selected, each row is a term-DAY, so a metrics filter in the
      // WHERE means "clicks in one day". A term with 4 clicks a day for a month — 120
      // clicks, top of the slide — would vanish, and the output would look fine.
      ['a metrics filter is never combined with segments.date',
        filtersOnMetrics && selectsDate, false],
      // Google documents that any keyword-related segment silently filters out every
      // Performance Max row. The query succeeds and still returns Search rows, so the
      // symptom is "PMax had no search terms" — indistinguishable from a quiet account.
      ['no keyword segment (it silently drops all PMax rows)',
        /keyword\.(info|text|criterion)/.test(src), false],
      // The resource itself: search_term_view returns no PMax data at all.
      ['queries campaign_search_term_view, not search_term_view',
        /FROM campaign_search_term_view/.test(src) && !/FROM search_term_view/.test(src), true],
    ].forEach(([name, got, want]) => expectEq('pmax terms query', name, got, want));
  }

  // ---- run the Ads script's fetch functions against a stubbed AdsApp ----
  //
  // The Ads script had no executable coverage at all, and it cost a full 30-minute
  // MCC run to discover that `_eng_product_dims` died on every row: the API OMITS the
  // `segments` container rather than returning empty values, so a query selecting only
  // `segments.product_custom_attribute0` yields rows with no `segments` key for every
  // product where that label is unset, and `r.segments[key]` throws. Reports that also
  // select `segments.date` never hit it, which is why every other one worked.
  //
  // Stubbing AdsApp.search is enough to run these for real, so do that.
  {
    const adsCtx = vm.createContext({
      Logger: { log() {} },
      Utilities: {
        formatDate: (d, tz, f) => {
          const iso = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString();
          return f === 'yyyy-MM' ? iso.slice(0, 7) : iso.slice(0, 10);
        },
      },
      SpreadsheetApp: { openById: () => { throw new Error('not used'); } },
      AdsManagerApp: undefined,
      console,
    });
    let queries = [];
    let nextRows = [];
    adsCtx.AdsApp = {
      currentAccount: () => ({
        getTimeZone: () => 'Etc/UTC', getCustomerId: () => '602-681-1446',
        getName: () => 'Xero Shoes US', getCurrencyCode: () => 'USD',
      }),
      search: (q) => {
        queries.push(q);
        const rows = nextRows.slice();
        let i = 0;
        return { hasNext: () => i < rows.length, next: () => rows[i++] };
      },
    };
    vm.runInContext(adsSrc, adsCtx);

    if (!ARGS.quiet) console.log('\nADS SCRIPT FETCH FUNCTIONS (stubbed AdsApp)');

    // A row with metrics but NO `segments` key — exactly what the API returns for an
    // unpopulated label, and exactly what broke the live run.
    nextRows = [
      { metrics: { impressions: 1000, clicks: 40, costMicros: 50000000, conversions: 3, conversionsValue: 400 } },
      { segments: { productCustomAttribute0: 'seasonal' },
        metrics: { impressions: 500, clicks: 20, costMicros: 25000000, conversions: 1, conversionsValue: 120 } },
    ];
    let dims = null, threw = null;
    try {
      dims = vm.runInContext(
        `fetchProductDims_({ start: '2026-07-01', end: '2026-07-31' })`, adsCtx);
    } catch (e) { threw = e.message; }

    expectEq('ads fetch', 'a row with no segments container does not throw', threw, null);
    if (!threw) {
      const values = dims.map(r => r[2]);
      expectEq('ads fetch', 'the missing segment is recorded as (not set)',
        values.indexOf('(not set)') !== -1, true);
      expectEq('ads fetch', 'the populated segment still comes through',
        values.indexOf('seasonal') !== -1, true);
      // Count DISTINCT dimension names, not rows: only attribute0 is populated in the
      // stub, so the other eight collapse both rows into one "(not set)" group each.
      // That collapsing is correct behaviour, which is why the row count is not 9×2.
      expectEq('ads fetch', 'all nine dimensions are probed',
        Object.keys(dims.reduce((a, r) => (a[r[1]] = 1, a), {})).length, 9);
      expectEq('ads fetch', 'one query per dimension, never a combined one',
        queries.length, 9);
    }

    // And the search-terms query: assert the shape the click threshold depends on.
    queries = [];
    nextRows = [
      { campaignSearchTermView: { searchTerm: 'barefoot shoes' },
        campaign: { id: 1001, name: 'PMAX' },
        metrics: { impressions: 9000, clicks: 300, costMicros: 100000000, conversions: 0, conversionsValue: 0 } },
    ];
    const termRows = vm.runInContext(
      `fetchPmaxSearchTerms_(monthRange_(1))`, adsCtx);

    expectEq('ads fetch', 'one query per month, not one for the whole range', queries.length, 1);
    expectEq('ads fetch', 'the query bounds a whole calendar month',
      /BETWEEN "\d{4}-\d{2}-01" AND "\d{4}-\d{2}-(28|29|30|31)"/.test(queries[0]), true);
    expectEq('ads fetch', 'the click threshold is in the query',
      /metrics\.clicks > 5/.test(queries[0]), true);
    expectEq('ads fetch', 'a term row survives and keeps its month',
      termRows.length === 1 && /^\d{4}-\d{2}$/.test(termRows[0][0]), true);
    expectEq('ads fetch', 'the month is the last COMPLETE month, never the current one',
      termRows[0][0] !== new Date().toISOString().slice(0, 7), true);

    // With a 3-month window the per-month loop becomes distinguishable from one
    // range-wide query — at TERM_MONTHS_BACK=1 the two are identical, so a regression
    // to a single query would pass unnoticed if this were the only case tested.
    queries = [];
    const wide = vm.runInContext(`fetchPmaxSearchTerms_(monthRange_(3))`, adsCtx);
    expectEq('ads fetch', 'a 3-month window issues 3 separate monthly queries',
      queries.length, 3);
    expectEq('ads fetch', 'each query covers exactly one month',
      queries.every(q => {
        const m = q.match(/BETWEEN "(\d{4}-\d{2})-01" AND "(\d{4}-\d{2})-\d{2}"/);
        return !!m && m[1] === m[2];
      }), true);
    expectEq('ads fetch', 'and the three months are distinct',
      new Set(wide.map(r => r[0])).size, 3);
  }

  const vocab = vm.runInContext('PRODUCT_DIM_VOCAB.map(function (v) { return v; })', context);
  const inputs = [];
  vocab.forEach(([field, label]) => inputs.push(field, label));
  inputs.push('cl4', 'l2', 'Custom label 1', 'brand', 'pt3', 'shoes', 'cl5', '');

  const disagree = [];
  inputs.forEach(input => {
    const mine = vm.runInContext(`(resolveProductDim_(${JSON.stringify(input)}) || {}).field || null`, context);
    const theirs = vm.runInContext(`resolveDimField_(${JSON.stringify(input)})`, adsCtx);
    if (mine !== theirs) disagree.push(`"${input}": Apps Script → ${mine}, Ads script → ${theirs}`);
  });

  if (!ARGS.quiet) console.log('\nDIMENSION RESOLVERS AGREE ACROSS RUNTIMES');
  if (disagree.length) {
    process.exitCode = 1;
    disagree.forEach(d => harnessFailures.push(
      'dimension resolvers · ' + d +
      '  → the Ads script would query a different dimension than the deck labels'));
    if (!ARGS.quiet) disagree.forEach(d => console.log('  ✗ ' + d));
  } else if (!ARGS.quiet) {
    console.log(`  ✓ ${inputs.length} inputs resolve identically in both`);
  }
}

// ---- the same invariants the live sheet checks ----
console.log('\n' + HR);
console.log('SELF-TEST  (apps-script/SelfTest.gs — identical to Diagnostics → Run self-test)');
console.log(HR);

if (apiViolations.length) {
  console.log('\n' + HR);
  console.log('SHEETS API MISUSE  (' + apiViolations.length + ')');
  console.log(HR);
  apiViolations.forEach(v => console.log(wrap('  ✗ ', v)));
  console.log('\nThese would throw against the real Sheets API. Fix them before deploying.');
  process.exitCode = 1;
}

let report;
try {
  report = vm.runInContext('selfTestReport_()', context);
} catch (e) {
  console.error('\n✗ SELF-TEST CRASHED\n' + e.stack);
  process.exit(1);
}
report.lines.forEach(l => console.log(l));

// Harness-only checks (the things SelfTest.gs cannot see: image resolution, loose
// paste parsing against a real export's headers, and the two runtimes' resolvers).
// Printed even in quiet mode when they fail, or the quiet run reports success while
// something is broken.
if (harnessFailures.length) {
  console.log('\n' + HR);
  console.log('HARNESS CHECKS  (' + harnessFailures.length + ' failed)');
  console.log(HR);
  harnessFailures.forEach(f => console.log(wrap('  ✗ ', f)));
} else {
  console.log(`\n✓ harness checks: product images, slide 8 dimensions, slide 10 paste, ` +
    `cross-runtime resolvers.`);
}

process.exit((report.failed || apiViolations.length || harnessFailures.length) ? 1 : 0);

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
  const entry = namedRanges[name];
  if (!entry) { console.log(`\n[${name}]  MISSING`); return; }
  const v = entry.range.getValues();
  console.log(`\n[${name}]  ${v.length}×${v[0].length}`);
  const w = v[0].length > 9 ? 13 : 20;
  v.forEach(row => console.log('  ' + row.map(c => cell(c, w)).join('')));
}

/**
 * The whole Report tab as one string. Each block writes an explanatory note into
 * column A above itself, and those notes are how a reader learns WHICH source a
 * slide came from — so they are worth asserting on, not just the numbers.
 */
function reportText() {
  const sheet = sheets['Report'];
  return sheet ? sheet._data.map(r => r.join(' ')).join('\n') : '';
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

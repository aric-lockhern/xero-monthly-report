/**
 * Xero Shoes — Monthly Report  ·  SELF-TEST
 * =============================================================================
 * Asserts the report's invariants against a report that has just been built.
 *
 * These are the checks worth running before a deck reaches a client, and they run
 * in TWO places from this one file:
 *
 *   · live, from the menu — Diagnostics → Run self-test
 *   · locally, with no Google account at all — tools/harness.js
 *
 * One definition of "correct" for both. If you add an invariant, add it here.
 *
 * The most valuable check is C: it reads the values the Report tab actually
 * WROTE and re-derives the %MoM row from the two rows above it. That exercises
 * the whole path — ingest, classify, sum, derive, format, write — rather than
 * re-running the same functions and agreeing with itself.
 */

// Ratio comparisons are done to a relative tolerance: these are sums of
// thousands of floats, so exact equality is the wrong test.
var SELFTEST_TOL = 1e-6;

function runSelfTest() {
  var report = selfTestReport_();
  tell_(report.failed ? 'Self-test — ' + report.failed + ' FAILED' : 'Self-test — all ' + report.passed + ' passed',
    report.lines.join('\n'));
}

/**
 * Run every invariant. Assumes buildReport() has already run in this session, and
 * rebuilds the context so the checks compare written output against a fresh
 * computation rather than against cached intermediates.
 */
function selfTestReport_() {
  var t = newAsserter_();
  var ctx = buildReportContext_();

  // Has a report ever been written to this spreadsheet?
  //
  // Checks A, C and F read the Report tab's OUTPUT; the rest recompute from
  // source. Running the self-test before a first successful build therefore used
  // to emit twenty identical "missing — run Build report first" failures, which
  // buries the one instruction that matters under a wall of red. Say it once.
  var built = false;
  var existing = SpreadsheetApp.getActiveSpreadsheet().getNamedRanges();
  for (var n = 0; n < existing.length; n++) {
    if (existing[n].getName().indexOf('RPT_') === 0) { built = true; break; }
  }

  checkDeckContract_(t);
  if (built) {
    checkShapes_(t);
  } else {
    t.section('A / C / F · Report tab output — SKIPPED');
    t.note('No RPT_* named range exists, so no report has been built in this spreadsheet yet.');
    t.note('→  Run  Monthly Report → Build report,  then run this self-test again.');
    t.note('Everything below checks the computation from source data and is still meaningful.');
  }
  checkSpine_(t, ctx);
  checkPartitions_(t, ctx);
  if (built) checkWrittenDeltas_(t);
  checkDerivedRatios_(t, ctx);
  checkRatiosHaveComponents_(t, ctx);
  if (built) checkCampaignMap_(t, ctx);
  reportCoverage_(t, ctx);

  if (!built) {
    t.lines.push('');
    t.lines.push('NOTE: the output checks were skipped because nothing has been built yet. ' +
      'Run Build report and re-run to get the full ' + '~130' + ' checks.');
  }

  var lines = t.lines.slice();
  lines.push('');
  lines.push(t.failed
    ? '✗ ' + t.failed + ' failed, ' + t.passed + ' passed. Do not ship the deck until these are ' +
      'understood — each failure names the block involved.'
    : '✓ all ' + t.passed + ' invariants hold.');

  return { passed: t.passed, failed: t.failed, lines: lines };
}

function newAsserter_() {
  return {
    passed: 0, failed: 0, lines: [],
    ok: function (name, cond, detail) {
      if (cond) { this.passed++; this.lines.push('  ✓ ' + name); }
      else { this.failed++; this.lines.push('  ✗ ' + name + (detail ? '  →  ' + detail : '')); }
    },
    near: function (name, a, b, detail) {
      // Relative comparison, with an absolute floor so 0-vs-0 passes and a cent
      // of float residue on a six-figure sum doesn't fail.
      var scale = Math.max(Math.abs(num_(a)), Math.abs(num_(b)), 1);
      var diff = Math.abs(num_(a) - num_(b));
      this.ok(name, diff / scale < SELFTEST_TOL || diff < 0.01,
        detail || (fmtNum_(a) + ' vs ' + fmtNum_(b) + '  (Δ ' + fmtNum_(diff) + ')'));
    },
    note: function (text) { this.lines.push('    ' + text); },
    section: function (title) { this.lines.push((this.lines.length ? '\n' : '') + title); },
  };
}

function fmtNum_(v) {
  if (v === null || v === undefined) return 'n/a';
  var n = Number(v);
  if (!isFinite(n)) return String(v);
  return Math.abs(n) >= 1000 ? Math.round(n).toLocaleString() : String(Math.round(n * 10000) / 10000);
}

// ============================== G · DECK CONTRACT ==========================

/**
 * Ground truth, measured from template/Xero_Shoes_Monthly_Reporting_Framework.pptx.
 * `rows` EXCLUDES the deck table's own header row.
 *
 * These literals exist because checking a named range against `slidePlan_()` is
 * partly self-referential: both are built from the `*_ROWS` constants in
 * Config.gs, so changing a constant moves both sides and the check still passes
 * while the real deck table stays the size it always was.
 */
function deckTruth_() {
  return {
    RPT_BLENDED:         { slide: 4,  rows: 4,  cols: 15 },
    RPT_SEARCH:          { slide: 5,  rows: 4,  cols: 15 },
    RPT_SHOPPING:        { slide: 5,  rows: 4,  cols: 15 },
    RPT_SEARCH_BRAND:    { slide: 6,  rows: 4,  cols: 15 },
    RPT_SEARCH_NONBRAND: { slide: 6,  rows: 4,  cols: 15 },
    RPT_SHOP_BRAND:      { slide: 7,  rows: 4,  cols: 15 },
    RPT_SHOP_NONBRAND:   { slide: 7,  rows: 4,  cols: 15 },
    RPT_PRODUCT:         { slide: 8,  rows: 16, cols: 9  },
    RPT_PMAX_CAT:        { slide: 10, rows: 16, cols: 8  },
    RPT_PROMO_ASSETS:    { slide: 12, rows: 4,  cols: 5  },
    RPT_CHATGPT:         { slide: 13, rows: 4,  cols: 12 },
  };
}

/**
 * Pin the semantics that arithmetic checks cannot see.
 *
 * Check B verifies the segments PARTITION the total — but a partition stays a
 * valid partition if you move Performance Max from Shopping into Search. Every
 * identity would still hold while six figures of spend silently swapped slides.
 * These assertions are the ones that catch that class of drift.
 */
function checkDeckContract_(t) {
  t.section('G · Config matches the deck\'s definitions');

  // The framework deck, slide 5 footnote: "Search = text campaigns. Shopping =
  // Standard Shopping + PMax retail."
  t.ok('PMAX rolls up to the Shopping tables', DECK_GROUP_OF_TACTIC.PMAX === 'SHOPPING',
    'is ' + DECK_GROUP_OF_TACTIC.PMAX);
  t.ok('SHOPPING rolls up to the Shopping tables', DECK_GROUP_OF_TACTIC.SHOPPING === 'SHOPPING',
    'is ' + DECK_GROUP_OF_TACTIC.SHOPPING);
  t.ok('SEARCH rolls up to the Search tables', DECK_GROUP_OF_TACTIC.SEARCH === 'SEARCH',
    'is ' + DECK_GROUP_OF_TACTIC.SEARCH);
  t.ok('DSA rolls up to the Search tables', DECK_GROUP_OF_TACTIC.DSA === 'SEARCH',
    'is ' + DECK_GROUP_OF_TACTIC.DSA);
  t.ok('DEMAND_GEN belongs to neither tactic table', DECK_GROUP_OF_TACTIC.DEMAND_GEN === 'OTHER',
    'is ' + DECK_GROUP_OF_TACTIC.DEMAND_GEN);

  var unmapped = [];
  for (var i = 0; i < VALID_TACTICS.length; i++) {
    if (!DECK_GROUP_OF_TACTIC[VALID_TACTICS[i]]) unmapped.push(VALID_TACTICS[i]);
  }
  t.ok('every valid tactic has a deck group', unmapped.length === 0, unmapped.join(', '));

  // Conquesting is non-brand spend. Excluding it would leave slides 6-7 not
  // summing to slide 5, which check B would then report as an unassigned gap.
  t.ok('the deck\'s Non-Brand includes COMPETITOR', isDeckNonBrand_('COMPETITOR'));
  t.ok('the deck\'s Non-Brand includes NON_BRAND', isDeckNonBrand_('NON_BRAND'));
  t.ok('the deck\'s Non-Brand excludes BRAND', !isDeckNonBrand_('BRAND'));
  t.ok('UNKNOWN is in neither brand table', !isDeckNonBrand_('UNKNOWN') && !isDeckBrand_('UNKNOWN'));

  // Column counts: +1 for the leading Month column the deck tables carry.
  t.ok('the main table has 15 columns', tableColumns_().length + 1 === 15,
    'has ' + (tableColumns_().length + 1));
  t.ok('the ChatGPT table has 12 columns', chatgptColumns_().length + 1 === 12,
    'has ' + (chatgptColumns_().length + 1));

  // Row-count constants against the deck's real table heights.
  var truth = deckTruth_();
  t.ok('PRODUCT_ROWS matches slide 8 (16)', PRODUCT_ROWS === truth.RPT_PRODUCT.rows,
    'is ' + PRODUCT_ROWS);
  t.ok('PMAX_CAT_ROWS matches slide 10 (16)', PMAX_CAT_ROWS === truth.RPT_PMAX_CAT.rows,
    'is ' + PMAX_CAT_ROWS);
  t.ok('PROMO_ROWS + total row matches slide 12 (4)', PROMO_ROWS + 1 === truth.RPT_PROMO_ASSETS.rows,
    'is ' + (PROMO_ROWS + 1));

  // Every block the writer maps must be in the deck-truth table, and vice versa.
  var plan = slidePlan_(), planned = {};
  for (var p = 0; p < plan.length; p++) {
    planned[plan[p].range] = true;
    t.ok(plan[p].range + ' is a known deck table', !!truth[plan[p].range],
      'not in deckTruth_() — add it, or the shape check cannot validate it');
  }
  var unplanned = Object.keys(truth).filter(function (k) { return !planned[k]; });
  t.ok('every deck table is mapped by slidePlan_', unplanned.length === 0, unplanned.join(', '));
}

// ============================== H · SPINE / SOURCE COMBINATION =============

/**
 * The engine is the spine; Triple Whale is the overlay. These assertions pin that
 * relationship, because getting it wrong is silent: every table still renders and
 * every table is still internally consistent.
 *
 * The dangerous case is a per-channel mismatch — engine cost for Google only,
 * divided into Triple Whale revenue that includes Microsoft. That inflates ROAS
 * on the headline slide with nothing visibly wrong.
 */
function checkSpine_(t, ctx) {
  t.section('H · Engine spine and Triple Whale overlay');

  var bag = ctx.segments.blended.current;

  // Front end must come from the engine once the backfill has run.
  if (ctx.engCoverage.current) {
    t.ok('current month front end comes from the engine',
      bag._frontSource === 'engine' || bag._frontSource === 'mixed',
      'is "' + bag._frontSource + '"');
  } else {
    t.note('no engine data for the report month — front end falls back to Triple Whale, ' +
      'which is the documented degraded mode');
  }

  // Both sources should describe the same program — but only where BOTH cover the
  // channel. Comparing totals would report a large false "drift" whenever the
  // engine feed covers fewer channels than Triple Whale, which is the normal
  // state before a Microsoft feed exists.
  var engSpend = ctx.channelCoverage.currentEngSpend || {};
  var twSpend  = ctx.channelCoverage.currentTwSpend  || {};
  var overlapping = Object.keys(engSpend).filter(function (ch) { return twSpend[ch] !== undefined; });

  if (!overlapping.length) {
    t.note('no channel is covered by both sources this month, so there is nothing to cross-check');
  } else {
    overlapping.forEach(function (ch) {
      var e = num_(engSpend[ch]), w = num_(twSpend[ch]);
      if (w <= 0) return;
      var drift = Math.abs(e - w) / w;
      t.ok(ch + ': engine cost within 5% of Triple Whale spend', drift < 0.05,
        fmtNum_(e) + ' vs ' + fmtNum_(w) + '  (' + (drift * 100).toFixed(1) + '%)');
    });
  }

  // Blended cost must equal engine cost for engine-covered channels plus Triple
  // Whale spend for the rest. This is the identity that guarantees the ROAS
  // denominator describes the same spend as its numerator.
  var expected = 0;
  Object.keys(twSpend).forEach(function (ch) {
    expected += (engSpend[ch] !== undefined) ? num_(engSpend[ch]) : num_(twSpend[ch]);
  });
  Object.keys(engSpend).forEach(function (ch) {
    if (twSpend[ch] === undefined) expected += num_(engSpend[ch]);
  });
  t.near('blended cost = engine cost where covered + Triple Whale spend elsewhere',
    derive_(bag).cost, expected);

  // Attributed columns must be n/a, never 0, in periods Triple Whale misses.
  ['prior', 'yoy'].forEach(function (p) {
    if (ctx.twCoverage[p]) return;
    var d = derive_(ctx.segments.blended[p]);
    t.ok(p + ': TW Revenue is n/a (no Triple Whale data)', d.tw_revenue === null,
      'got ' + fmtNum_(d.tw_revenue));
    if (ctx.engCoverage[p]) {
      t.ok(p + ': Cost is still real (engine covers it)', d.cost !== null && num_(d.cost) > 0,
        'got ' + fmtNum_(d.cost));
    }
  });

  // CHANNELS MUST PARTITION THE BLENDED TOTAL. If a channel were ever dropped —
  // by a classifier change, a coverage bug, or a channel id that stopped matching
  // TW_ADS_CHANNELS — every table would still render and still be internally
  // consistent, just quietly missing that channel's spend. This is the assertion
  // that notices.
  ['current', 'prior', 'yoy'].forEach(function (pk) {
    var b = derive_(ctx.segments.blended[pk]);
    if (b.cost === null) return;
    var chans = Object.keys(ctx.channelSegments);
    ['cost', 'impressions', 'clicks', 'tw_revenue'].forEach(function (metric) {
      var sum = 0;
      for (var i = 0; i < chans.length; i++) sum += num_(derive_(ctx.channelSegments[chans[i]][pk])[metric]);
      t.near(pk + ': channels sum to Blended ' + metric, sum, num_(b[metric]));
    });
  });
  t.note('channels present: ' + Object.keys(ctx.channelSegments).join(', ') +
    '  (ChatGPT Ads is reported separately on slide 13)');

  // NO CHANNEL MAY BE SILENTLY EXCLUDED.
  //
  // The partition check above cannot catch this: remove a channel from
  // TW_ADS_CHANNELS and it vanishes from blended AND from the channel list, so the
  // sums still close perfectly while real spend has left the report entirely.
  // The only way to notice is to compare config against what the SOURCE holds.
  var sourceChannels = {};
  for (var si = 0; si < ctx.twMeta.rows.length; si++) sourceChannels[ctx.twMeta.rows[si].channel] = true;
  for (var ei = 0; ei < ctx.engRows.length; ei++) sourceChannels[ctx.engRows[ei].channel] = true;

  var orphaned = Object.keys(sourceChannels).filter(function (ch) {
    return ch && TW_ADS_CHANNELS.indexOf(ch) === -1 && TW_OPENAI_CHANNELS.indexOf(ch) === -1;
  });
  t.ok('every channel in the source data is claimed by Config.gs',
    orphaned.length === 0,
    'these carry spend but appear in neither TW_ADS_CHANNELS nor TW_OPENAI_CHANNELS, so they are ' +
    'excluded from every table: ' + orphaned.join(', '));

  // MONTHLY-GRAIN SAFETY. Microsoft Advertising Scripts have no report query
  // surface, so Bing history arrives as whole-month totals dated the 1st. Such a
  // row must be matched by MONTH and never by date range — otherwise a five-day
  // promo starting on the 1st would absorb an entire month of Bing spend and
  // report a catastrophic promo ROAS on a client slide.
  var monthRow = [{ date: '2026-07-01', grain: 'month', channel: 'bing', spend: 22312 }];
  var dayRow   = [{ date: '2026-07-01', grain: 'day',   channel: 'bing', spend: 700 }];
  var wholeMonth = { month: '2026-07', start: '2026-07-01', end: '2026-07-31' };
  var promoWindow = { start: '2026-07-01', end: '2026-07-05' };   // no `month` — sub-month

  t.ok('a monthly row IS matched by its own month',
    rowsInPeriod_(monthRow, wholeMonth).length === 1);
  t.ok('a monthly row is NOT matched by a sub-month window',
    rowsInPeriod_(monthRow, promoWindow).length === 0,
    'matched ' + rowsInPeriod_(monthRow, promoWindow).length + ' row(s) — a promo would absorb a ' +
    'whole month of spend');
  t.ok('a monthly row is NOT matched by a different month',
    rowsInPeriod_(monthRow, { month: '2026-06', start: '2026-06-01', end: '2026-06-30' }).length === 0);
  t.ok('a daily row IS still matched by a sub-month window',
    rowsInPeriod_(dayRow, promoWindow).length === 1);

  // Promo windows read Triple Whale, not the engine, so monthly rows cannot reach
  // them at all. Belt and braces: the assertions above hold even if that changes.
  var monthlyRows = 0;
  for (var mi = 0; mi < ctx.engRows.length; mi++) if (ctx.engRows[mi].grain === 'month') monthlyRows++;
  if (monthlyRows) {
    t.note(monthlyRows + ' engine row(s) are whole-month totals (Bing history). They contribute to ' +
      'the month tables and are invisible to promo windows, by design.');
  }

  // Per-channel combination: a channel the engine misses must not have its cost
  // dropped while its Triple Whale revenue is kept.
  var cov = ctx.channelCoverage;
  ['current', 'prior', 'yoy'].forEach(function (p) {
    var eng = cov[p].engine, tw = cov[p].triplewhale;
    var twOnly = tw.filter(function (c) { return eng.indexOf(c) === -1; });
    if (!twOnly.length) return;
    t.note(p + ': ' + twOnly.join(', ') + ' present in Triple Whale but not the engine — ' +
      'those channels use Triple Whale for their front end too, so cost and revenue still ' +
      'describe the same spend');
  });
}

// ============================== A · SHAPES =================================

/**
 * Every mapped block must exist at exactly the DECK's shape.
 *
 * Compared against `deckTruth_()`, not `slidePlan_()`, so a wrong `*_ROWS`
 * constant fails here instead of moving both sides of the comparison at once.
 */
function checkShapes_(t) {
  t.section('A · Named range shapes match the deck tables');
  var truth = deckTruth_();
  var plan = slidePlan_();

  for (var i = 0; i < plan.length; i++) {
    var s = plan[i];
    var expect = truth[s.range];
    if (!expect) continue;                       // already reported by check G

    var r = SpreadsheetApp.getActiveSpreadsheet().getRangeByName(s.range);
    if (!r) { t.ok(s.range + ' exists', false, 'missing — run Build report first'); continue; }

    var got = r.getNumRows() + '×' + r.getNumColumns();
    var want = (expect.rows + 1) + '×' + expect.cols;
    t.ok('slide ' + expect.slide + ' ' + s.range + ' is ' + want, got === want, 'got ' + got);

    // The writer's own expectation must agree with the deck, or it will refuse to
    // fill the table at build time.
    t.ok(s.range + ': slidePlan_ agrees with the deck',
      s.rows === expect.rows && s.cols === expect.cols,
      'plan says ' + (s.rows + 1) + '×' + s.cols);
  }
}

// ============================== B · PARTITIONS =============================

/**
 * The segments must PARTITION the blended total — every dollar in exactly one
 * bucket. This is what makes the Reconciliation block trustworthy: if these
 * identities hold, the only reason parts don't sum to the whole is the
 * unclassified bucket, which is reported.
 */
function checkPartitions_(t, ctx) {
  t.section('B · Segments partition the blended total');
  var periods = ['current', 'prior'];

  // Checked against the COMBINED bags the tables are actually built from, so the
  // identities hold whichever source supplied the front end.
  // SEARCH / SHOPPING / OTHER is an exhaustive partition of the tactic axis, so
  // the three must sum to blended EXACTLY on the combined bags the tables are
  // built from — no residual gap term.
  //
  // This is the check that catches a front-end source chosen per segment instead
  // of per channel: a campaign present in Triple Whale but not the engine would
  // then be counted in a narrow segment and excluded from blended, and this sum
  // would not close.
  ['current', 'prior', 'yoy'].forEach(function (pk) {
    var b = derive_(ctx.segments.blended[pk]);
    if (b.cost === null) { t.note(pk + ': no cost from either source, partition skipped'); return; }
    ['cost', 'impressions', 'clicks', 'eng_orders', 'eng_revenue', 'tw_revenue', 'tw_orders'].forEach(function (metric) {
      var parts = ['search', 'shopping', 'other'].reduce(function (acc, seg) {
        return acc + num_(derive_(ctx.segments[seg][pk])[metric]);
      }, 0);
      t.near(pk + ': Search + Shopping + Other = Blended ' + metric, parts, num_(b[metric]));
    });
  });

  for (var p = 0; p < periods.length; p++) {
    var per = periods[p];
    if (!ctx.twCoverage[per]) { t.note(per + ': no Triple Whale data, row-level partition checks skipped'); continue; }

    var rows = rowsInPeriod_(ctx.twAds, ctx.periods[per]);
    var total = 0, byGroup = { SEARCH: 0, SHOPPING: 0, OTHER: 0 };
    var searchByBrand = { BRAND: 0, OTHER: 0 }, shopByBrand = { BRAND: 0, OTHER: 0 };

    for (var i = 0; i < rows.length; i++) {
      var r = rows[i], c = num_(r.spend);
      total += c;
      var g = r.cls.deckGroup;
      byGroup[g] = (byGroup[g] || 0) + c;
      var bucket = isDeckBrand_(r.cls.brand) ? 'BRAND' : (isDeckNonBrand_(r.cls.brand) ? 'NON_BRAND' : 'OTHER');
      if (g === 'SEARCH')   searchByBrand[bucket] = (searchByBrand[bucket] || 0) + c;
      if (g === 'SHOPPING') shopByBrand[bucket]   = (shopByBrand[bucket]   || 0) + c;
    }

    t.near(per + ': Search + Shopping + Other = Blended cost',
      byGroup.SEARCH + byGroup.SHOPPING + byGroup.OTHER, total);
    t.near(per + ': Search Brand + Non-Brand + unassigned = Search cost',
      (searchByBrand.BRAND || 0) + (searchByBrand.NON_BRAND || 0) + (searchByBrand.OTHER || 0), byGroup.SEARCH);
    t.near(per + ': Shopping Brand + Non-Brand + unassigned = Shopping cost',
      (shopByBrand.BRAND || 0) + (shopByBrand.NON_BRAND || 0) + (shopByBrand.OTHER || 0), byGroup.SHOPPING);

    // Not an error, but the number an analyst must see before shipping.
    var unassigned = (searchByBrand.OTHER || 0) + (shopByBrand.OTHER || 0);
    if (unassigned > 0.01) {
      t.note(per + ': ⚠ ' + fmtNum_(unassigned) + ' of cost is in a tactic table but has NO brand ' +
        'assignment — slides 6–7 under-report slide 5 by that much. Pin it on the ' + MAP_SHEET + ' tab.');
    }
  }
}

// ============================== C · WRITTEN DELTAS =========================

/**
 * Re-derive the %MoM row from the two value rows sitting directly above it, using
 * only what the Report tab actually WROTE.
 *
 * This is the end-to-end check. It would catch a column-order slip, an off-by-one
 * in the block writer, or a formatting path that mangles a value — none of which
 * a check that re-calls derive_() could see.
 */
function checkWrittenDeltas_(t) {
  t.section('C · The written %MoM row re-derives from the written values');
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var blocks = ['RPT_BLENDED', 'RPT_SEARCH', 'RPT_SHOPPING', 'RPT_SEARCH_BRAND',
                'RPT_SEARCH_NONBRAND', 'RPT_SHOP_BRAND', 'RPT_SHOP_NONBRAND', 'RPT_CHATGPT'];

  for (var b = 0; b < blocks.length; b++) {
    var range = ss.getRangeByName(blocks[b]);
    if (!range) { t.ok(blocks[b] + ' present', false, 'missing'); continue; }

    var v = range.getValues();          // [header, current, prior, %MoM, %YoY]
    if (v.length < 4) { t.ok(blocks[b] + ' has 4 data rows', false, 'has ' + (v.length - 1)); continue; }

    var mismatches = [], compared = 0;
    for (var c = 1; c < v[0].length; c++) {
      var cur = v[1][c], pri = v[2][c], mom = v[3][c];
      // Only check cells where all three are real numbers; NA is a valid outcome
      // and is covered by check E.
      if (typeof cur !== 'number' || typeof pri !== 'number' || typeof mom !== 'number') continue;
      if (pri === 0) continue;
      compared++;
      var expect = (cur - pri) / Math.abs(pri);
      if (Math.abs(expect - mom) > 1e-6) {
        mismatches.push(String(v[0][c]) + ': wrote ' + fmtNum_(mom) + ', expected ' + fmtNum_(expect));
      }
    }
    t.ok(blocks[b] + ': ' + compared + ' %MoM cell(s) re-derive correctly',
      mismatches.length === 0, mismatches.slice(0, 3).join('; '));
  }
}

// ============================== D · DERIVED RATIOS =========================

/** Ratios must equal their components' quotient — no stale or averaged values. */
function checkDerivedRatios_(t, ctx) {
  t.section('D · Ratios equal their components');
  if (!ctx.twCoverage.current) { t.note('no current-month data, skipped'); return; }

  var checks = [
    ['blended', 'Blended'], ['search', 'Search'], ['shopping', 'Shopping'],
    ['searchBrand', 'Search·Brand'], ['shopNonBrand', 'Shopping·Non-Brand'],
  ];

  for (var i = 0; i < checks.length; i++) {
    var bag = ctx.segments[checks[i][0]].current;
    var m = derive_(bag), label = checks[i][1];
    if (!bag._rows) { t.note(label + ': empty segment, skipped'); continue; }

    t.near(label + ' CTR = clicks ÷ impressions', m.ctr, bag.clicks / bag.impressions);
    t.near(label + ' CPC = spend ÷ clicks', m.cpc, bag.spend / bag.clicks);
    t.near(label + ' TW ROAS = revenue ÷ spend', m.tw_roas, bag.tw_revenue / bag.spend);
    t.near(label + ' TW AOV = revenue ÷ orders', m.tw_aov, bag.tw_revenue / bag.tw_orders);
    t.near(label + ' Engine ROAS = conv value ÷ spend', m.eng_roas, bag.eng_conv_value / bag.spend);
  }

  // Impression share must be a share, and must be volume-weighted rather than a
  // mean of daily percentages.
  if (ctx.engRows.length) {
    var brandSearch = [];
    for (var j = 0; j < ctx.engRows.length; j++) {
      var r = ctx.engRows[j];
      if (r.date < ctx.periods.current.start || r.date > ctx.periods.current.end) continue;
      if (isDeckBrand_(r.cls.brand) && r.cls.deckGroup === 'SEARCH') brandSearch.push(r);
    }
    if (brandSearch.length) {
      var isBag = sumComponents_(brandSearch);
      var share = derive_(isBag).is_share;
      t.ok('Brand impression share is within (0, 1]', share === null || (share > 0 && share <= 1.0000001),
        'got ' + fmtNum_(share));
      t.near('Brand impression share = Σ impr ÷ Σ eligible impr', share, isBag.is_impr / isBag.is_eligible);
    }
  }
}

// ============================== E · N/A DISCIPLINE =========================

/**
 * A ratio must be n/a whenever its denominator is absent — never 0.
 *
 * The important case: a period covered by Google Ads but NOT by Triple Whale.
 * If that reported 0 attributed revenue instead of n/a, %YoY would claim revenue
 * grew infinitely off a zero base.
 */
function checkRatiosHaveComponents_(t, ctx) {
  t.section('E · Missing data reads n/a, never 0');

  var empty = derive_(emptyComponents_());
  var cols = tableColumns_();
  var zeros = [];
  for (var i = 0; i < cols.length; i++) {
    if (empty[cols[i][1]] !== null) zeros.push(cols[i][0] + '=' + empty[cols[i][1]]);
  }
  t.ok('an empty segment derives every column as n/a', zeros.length === 0, zeros.join(', '));

  // Engine-only bag: Triple Whale columns must be n/a, engine columns must be real.
  var engOnly = sumComponents_([{
    src: 'eng', spend: 100, impressions: 1000, clicks: 50,
    eng_conv: 5, eng_conv_value: 500,
    tw_orders: 0, tw_revenue: 0, tw_nc_orders: 0, tw_nc_revenue: 0,
    sessions: null, is_impr: 0, is_eligible: 0,
  }]);
  var e = derive_(engOnly);
  t.ok('engine-only period: TW Revenue is n/a', e.tw_revenue === null, 'got ' + fmtNum_(e.tw_revenue));
  t.ok('engine-only period: TW ROAS is n/a', e.tw_roas === null, 'got ' + fmtNum_(e.tw_roas));
  t.ok('engine-only period: TW CVR is n/a', e.tw_cvr === null, 'got ' + fmtNum_(e.tw_cvr));
  t.near('engine-only period: Engine ROAS is still real', e.eng_roas, 5);

  t.ok('pctChange_ off a zero base is n/a', pctChange_(10, 0) === null);
  t.ok('pctChange_ off a missing base is n/a', pctChange_(10, null) === null);
  t.near('pctChange_ computes a normal delta', pctChange_(110, 100), 0.1);

  // Sessions must not be invented from a column of blanks.
  if (!TW_SESSION_FIELD) {
    var cur = derive_(ctx.segments.blended.current);
    t.ok('TW Sessions is n/a while TW_SESSION_FIELD is unset', cur.sessions === null,
      'got ' + fmtNum_(cur.sessions));
  }
}

// ============================== F · CAMPAIGN MAP ===========================

function checkCampaignMap_(t, ctx) {
  t.section('F · Campaign Map integrity');
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MAP_SHEET);
  var noData = !ctx.twCoverage.current && !ctx.engCoverage.current;

  if (!sheet || sheet.getLastRow() < 2) {
    // An empty map is CORRECT when the report month has no campaigns in it. Only
    // an empty map for a month that does have data means something went wrong.
    if (noData) {
      t.note(MAP_SHEET + ' is empty because ' + ctx.periods.current.label + ' has no data from ' +
        'either source — expected, not a failure.');
    } else {
      t.ok(MAP_SHEET + ' populated', false, 'empty, but ' + ctx.periods.current.label +
        ' has data — run Build report');
    }
    return;
  }

  var vals = sheet.getRange(2, 1, sheet.getLastRow() - 1, MAP_HEADER.length).getValues();
  var seen = {}, dupes = [], badTactic = [], badBrand = [];
  for (var i = 0; i < vals.length; i++) {
    var key = classKey_(vals[i][0], vals[i][1]);
    if (seen[key]) dupes.push(key); else seen[key] = true;
    if (VALID_TACTICS.indexOf(String(vals[i][6])) === -1) badTactic.push('row ' + (i + 2) + ': ' + vals[i][6]);
    if (VALID_BRANDS.indexOf(String(vals[i][7])) === -1) badBrand.push('row ' + (i + 2) + ': ' + vals[i][7]);
  }

  t.ok('no duplicate channel+campaign rows', dupes.length === 0, dupes.slice(0, 3).join(', '));
  t.ok('every Effective Tactic is a valid value', badTactic.length === 0, badTactic.slice(0, 3).join(', '));
  t.ok('every Effective Brand is a valid value', badBrand.length === 0, badBrand.slice(0, 3).join(', '));
}

// ============================== COVERAGE SUMMARY ===========================

/** Not assertions — the context an analyst needs to read the results. */
function reportCoverage_(t, ctx) {
  t.section('Coverage (context, not assertions)');
  var p = ctx.periods;
  t.note('report month  ' + p.current.label + ': Triple Whale ' + (ctx.twCoverage.current ? 'yes' : 'NO') +
    ', engine ' + (ctx.engCoverage.current ? 'yes' : 'no'));
  t.note('prior month   ' + p.prior.label + ': Triple Whale ' + (ctx.twCoverage.prior ? 'yes' : 'NO') +
    ', engine ' + (ctx.engCoverage.prior ? 'yes' : 'no'));
  t.note('YoY month     ' + p.yoy.label + ': Triple Whale ' + (ctx.twCoverage.yoy ? 'yes' : 'NO') +
    ', engine ' + (ctx.engCoverage.yoy ? 'yes' : 'no'));
  for (var i = 0; i < ctx.warnings.length; i++) t.note('⚠ ' + ctx.warnings[i]);
}

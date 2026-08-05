/**
 * Xero Shoes — Monthly Report  ·  REPORT TAB
 * =============================================================================
 * Builds the `Report` tab: one block per deck table, shaped EXACTLY like the
 * table it feeds, each registered as a named range (`RPT_*`).
 *
 * Why an intermediate tab instead of writing straight into the deck: you get to
 * look at the numbers, and reconcile them, before they reach a client. The
 * Slides writer then reads these same named ranges, so what you checked is
 * literally what ships.
 *
 * Block → slide map:
 *   RPT_KPI              slide 3   executive summary stat cards
 *   RPT_BLENDED          slide 4   blended paid search (the anchor table)
 *   RPT_SEARCH           slide 5   search
 *   RPT_SHOPPING         slide 5   shopping (Standard Shopping + PMax retail)
 *   RPT_SEARCH_BRAND     slide 6   search · brand
 *   RPT_SEARCH_NONBRAND  slide 6   search · non-brand (includes conquesting)
 *   RPT_SHOP_BRAND       slide 7   shopping · brand
 *   RPT_SHOP_NONBRAND    slide 7   shopping · non-brand
 *   RPT_PRODUCT          slide 8   product category performance
 *   RPT_BRAND_IS         slide 9   our brand impression share, by day
 *   RPT_AUCTION          slide 9   competitor auction insights (manual paste)
 *   RPT_PMAX_CAT         slide 10  PMax search categories
 *   RPT_TOP_ITEMS        slide 11  top products by revenue
 *   RPT_PROMO_SUMMARY    slide 12  promo window totals
 *   RPT_PROMO_ASSETS     slide 12  promo sitelinks
 *   RPT_CHATGPT          slide 13  ChatGPT Ads
 *   RPT_RECONCILIATION   —         why the parts do not sum to the whole
 */

var PCT_FORMAT = '+0.0%;-0.0%;0.0%';

// ============================== ENTRY POINT ================================

function buildReport() {
  var ctx = buildReportContext_();
  renderReportTab_(ctx);
  renderCampaignMap_(ctx.mapRows, ctx.classify);
  progress_('Report built for ' + ctx.periods.current.label + ' (' + REGION + ').');
  return ctx;
}

/**
 * Do all the reading, classifying and summing. Returns everything both the
 * Report tab and the Slides writer need, so neither recomputes anything.
 */
function buildReportContext_() {
  var periods = resolvePeriods_();
  progress_('Reporting ' + periods.current.label + '  ·  prior ' + periods.prior.shortLabel +
    '  ·  YoY ' + periods.yoy.shortLabel);

  progress_('Reading Triple Whale store…');
  var tw = readTripleWhale_();
  progress_('Triple Whale: ' + tw.rows.length + ' rows, ' + tw.minDate + ' → ' + tw.maxDate + '.');

  var eng = readEngineDays_();
  if (eng.rows.length) progress_('Google Ads engine tab: ' + eng.rows.length + ' rows.');
  else progress_('No ' + ENGINE_DAY_SHEET + ' tab — slides 8–12 and YoY engine history will be empty. ' +
    'Run the MCC Google Ads Script to populate them.');

  var classify = makeClassifier_(readOverrides_(), eng.types);

  // Tag and classify every row once.
  var twAds = [], twOpenAi = [];
  for (var i = 0; i < tw.rows.length; i++) {
    var r = tw.rows[i];
    r.src = 'tw';
    if (isAdsChannel_(r.channel))        { r.cls = classify(r.channel, r.campaign); twAds.push(r); }
    else if (isOpenAiChannel_(r.channel)) { twOpenAi.push(r); }
  }
  for (var j = 0; j < eng.rows.length; j++) {
    eng.rows[j].src = 'eng';
    eng.rows[j].cls = classify(eng.rows[j].channel, eng.rows[j].campaign);
  }

  var twCoverage  = coverage_(twAds, periods);
  var engCoverage = coverage_(eng.rows, periods);

  /**
   * Component bags per period for one segment.
   *
   * Triple Whale is the source of record. Where it does not cover a period —
   * typically the year-ago month, because its backfill starts later — we fall
   * back to Google Ads engine rows so the engine columns of the %YoY row are
   * still real. Triple Whale columns stay 'n/a' for that period rather than 0.
   */
  var bagsFor = function (pred) {
    var out = {};
    ['current', 'prior', 'yoy'].forEach(function (p) {
      var src = twCoverage[p] ? twAds : (engCoverage[p] ? eng.rows : []);
      var inPeriod = rowsInPeriod_(src, periods[p]);
      var kept = [];
      for (var k = 0; k < inPeriod.length; k++) if (pred(inPeriod[k])) kept.push(inPeriod[k]);
      out[p] = sumComponents_(kept);
    });
    return out;
  };

  var isSearch   = function (r) { return r.cls.deckGroup === 'SEARCH'; };
  var isShopping = function (r) { return r.cls.deckGroup === 'SHOPPING'; };

  var segments = {
    blended:         bagsFor(function () { return true; }),
    search:          bagsFor(isSearch),
    shopping:        bagsFor(isShopping),
    searchBrand:     bagsFor(function (r) { return isSearch(r)   && isDeckBrand_(r.cls.brand); }),
    searchNonBrand:  bagsFor(function (r) { return isSearch(r)   && isDeckNonBrand_(r.cls.brand); }),
    shopBrand:       bagsFor(function (r) { return isShopping(r) && isDeckBrand_(r.cls.brand); }),
    shopNonBrand:    bagsFor(function (r) { return isShopping(r) && isDeckNonBrand_(r.cls.brand); }),
    unclassified:    bagsFor(function (r) { return r.cls.deckGroup === 'OTHER' || r.cls.brand === 'UNKNOWN'; }),
  };

  // ChatGPT Ads is Triple Whale only — OpenAI has no engine tab here.
  var chatgpt = {};
  ['current', 'prior', 'yoy'].forEach(function (p) {
    chatgpt[p] = sumComponents_(rowsInPeriod_(twOpenAi, periods[p]));
  });

  return {
    periods: periods,
    classify: classify,
    twAds: twAds, twOpenAi: twOpenAi, engRows: eng.rows,
    twMeta: tw,
    twCoverage: twCoverage, engCoverage: engCoverage,
    segments: segments, chatgpt: chatgpt,
    mapRows: rowsInPeriod_(twAds, periods.current),
    warnings: coverageWarnings_(twCoverage, engCoverage, periods, tw),
  };
}

function coverageWarnings_(twCov, engCov, periods, tw) {
  var w = [];
  if (!twCov.current) {
    w.push('Triple Whale has NO data for ' + periods.current.label + ' (store covers ' +
      tw.minDate + ' → ' + tw.maxDate + '). Run a sync in the Triple Whale sheet, or set ' +
      'REPORT_MONTH in Config.gs to a month it covers.');
  }
  if (!twCov.prior) {
    w.push('Triple Whale has no data for the prior month (' + periods.prior.label +
      ') — the %MoM row will read n/a.');
  }
  if (!twCov.yoy) {
    w.push('Triple Whale has no data for ' + periods.yoy.label + ', so %YoY is ' +
      (engCov.yoy
        ? 'computed from Google Ads engine data only — the Triple Whale columns read n/a, and ' +
          'Microsoft/Bing is excluded from that row. To get true YoY, lower BACKFILL_START in the ' +
          'ld-x-tw-script project to at least ' + periods.yoy.start + ' and rebuild.'
        : 'unavailable — the whole %YoY row reads n/a. Lower BACKFILL_START in the ld-x-tw-script ' +
          'project to at least ' + periods.yoy.start + ' and rebuild, and/or backfill the MCC ' +
          'Google Ads Script that far.'));
  }
  if (!TW_SESSION_FIELD) {
    w.push('TW Sessions is not available (TW_SESSION_FIELD is unset), so that column reads n/a ' +
      'and TW CVR is computed on clicks. See docs/GAPS.md.');
  }
  return w;
}

// ============================== SHEET WRITER ===============================

/**
 * A cursor over the Report tab that emits titled blocks and registers a named
 * range over each one (header row + data rows — the exact shape of the deck
 * table it feeds).
 */
function newWriter_(sheet) {
  var cursor = 1;
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  return {
    heading: function (text, sub) {
      sheet.getRange(cursor, 1).setValue(text)
        .setFontSize(14).setFontWeight('bold').setFontColor('#1b2a4a');
      cursor++;
      if (sub) {
        sheet.getRange(cursor, 1).setValue(sub).setFontSize(9).setFontColor('#6b7280');
        cursor++;
      }
      cursor++;
      return this;
    },

    lines: function (items, color) {
      for (var i = 0; i < items.length; i++) {
        sheet.getRange(cursor, 1).setValue(items[i]).setFontColor(color || '#6b7280').setFontSize(9);
        cursor++;
      }
      if (items.length) cursor++;
      return this;
    },

    /**
     * opts = { name, slide, title, header, rows, colFormats, rowFormats, note }
     *   colFormats  per-column number format (index parallel to header)
     *   rowFormats  per-data-row override applied across all value columns
     *               (used for the %MoM / %YoY rows)
     */
    block: function (opts) {
      var label = opts.title + (opts.slide ? '   ·   slide ' + opts.slide : '');
      sheet.getRange(cursor, 1).setValue(label).setFontWeight('bold').setFontColor('#374151');
      cursor++;
      if (opts.note) {
        sheet.getRange(cursor, 1).setValue(opts.note).setFontSize(9).setFontColor('#9ca3af');
        cursor++;
      }

      var header = opts.header, rows = opts.rows || [];
      var width = header.length;
      var top = cursor;

      sheet.getRange(top, 1, 1, width).setValues([header])
        .setFontWeight('bold').setBackground(HEAD_BG).setFontColor(HEAD_FG)
        .setVerticalAlignment('middle').setWrap(true);

      if (rows.length) {
        var grid = [];
        for (var r = 0; r < rows.length; r++) {
          var row = [];
          for (var c = 0; c < width; c++) {
            var v = rows[r][c];
            row.push((v === null || v === undefined) ? NA : v);
          }
          grid.push(row);
        }
        sheet.getRange(top + 1, 1, grid.length, width).setValues(grid);

        // Column formats first, then per-row overrides on top.
        if (opts.colFormats) {
          for (var c2 = 0; c2 < width; c2++) {
            if (opts.colFormats[c2]) {
              sheet.getRange(top + 1, c2 + 1, grid.length, 1).setNumberFormat(opts.colFormats[c2]);
            }
          }
        }
        if (opts.rowFormats) {
          for (var r2 = 0; r2 < grid.length; r2++) {
            if (opts.rowFormats[r2] && width > 1) {
              sheet.getRange(top + 1 + r2, 2, 1, width - 1).setNumberFormat(opts.rowFormats[r2]);
              sheet.getRange(top + 1 + r2, 1, 1, width).setFontStyle('italic').setFontColor('#4b5563');
            }
          }
        }
        sheet.getRange(top, 1, grid.length + 1, width).setBorder(true, true, true, true, true, true,
          '#d1d5db', SpreadsheetApp.BorderStyle.SOLID);
      }

      var rangeRows = rows.length + 1;
      if (opts.name) {
        var range = sheet.getRange(top, 1, rangeRows, width);
        try { ss.removeNamedRange(opts.name); } catch (e) {}
        ss.setNamedRange(opts.name, range);
      }

      cursor = top + rangeRows + 2;
      return this;
    },

    at: function () { return cursor; },
  };
}

// ============================== RENDER =====================================

function renderReportTab_(ctx) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(REPORT_SHEET) || ss.insertSheet(REPORT_SHEET);

  // Clearing formats too: last month's blocks may have been taller. Charts are
  // not covered by clear(), so they'd otherwise stack up one per rebuild.
  sheet.clear();
  sheet.clearNotes();
  sheet.getCharts().forEach(function (c) { sheet.removeChart(c); });
  var maxRows = sheet.getMaxRows();
  if (maxRows > 1) sheet.getRange(1, 1, maxRows, sheet.getMaxColumns()).setBackground(null);

  var p = ctx.periods;
  var w = newWriter_(sheet);

  w.heading(CLIENT_NAME + ' — Monthly Performance Review  ·  ' + REGION,
    p.current.label + '   |   prior: ' + p.prior.label + '   |   YoY: ' + p.yoy.label +
    '   |   built ' + Utilities.formatDate(new Date(), tz_(), 'yyyy-MM-dd HH:mm') +
    '   |   attribution: whatever the Triple Whale sheet is set to (Last Click / 28-day by default)');

  if (ctx.warnings.length) w.lines(ctx.warnings.map(function (s) { return '⚠  ' + s; }), '#b45309');

  renderKpiBlock_(w, ctx);
  renderMainTables_(w, ctx);
  renderProductBlock_(w, ctx);
  renderImpressionShareBlocks_(w, ctx);
  renderPmaxCategoryBlock_(w, ctx);
  renderTopItemsBlock_(w, ctx);
  renderPromoBlocks_(w, ctx);
  renderChatgptBlock_(w, ctx);
  renderReconciliationBlock_(w, ctx);
  renderBrandIsChart_(sheet, w.at());

  sheet.setColumnWidth(1, 230);
  for (var c = 2; c <= 16; c++) sheet.setColumnWidth(c, 92);
  sheet.setFrozenColumns(1);
  if (sheet.getFilter()) sheet.getFilter().remove();
}

// ---- slide 3: executive summary stat cards ----

function renderKpiBlock_(w, ctx) {
  var cur = derive_(ctx.segments.blended.current);
  var pri = derive_(ctx.segments.blended.prior);

  var kpis = [
    ['TOTAL SPEND',  'cost',       currencyFormat_(false)],
    ['TW REVENUE',   'tw_revenue', currencyFormat_(false)],
    ['BLENDED ROAS', 'tw_roas',    '#,##0.00'],
    ['TW ORDERS',    'tw_orders',  '#,##0'],
  ];

  var header = ['Metric'], values = ['Value'], moms = ['% MoM'];
  for (var i = 0; i < kpis.length; i++) {
    header.push(kpis[i][0]);
    values.push(cur[kpis[i][1]]);
    moms.push(pctChange_(cur[kpis[i][1]], pri[kpis[i][1]]));
  }

  w.block({
    name: 'RPT_KPI', slide: '3', title: 'Executive Summary — stat cards',
    note: 'Blended paid search: Google Ads + Microsoft Ads. ChatGPT Ads is excluded (it has its own slide).',
    header: header,
    rows: [values, moms],
    colFormats: [null, kpis[0][2], kpis[1][2], kpis[2][2], kpis[3][2]],
    rowFormats: [null, PCT_FORMAT],
  });
}

// ---- slides 4–7: the main comparison tables ----

function renderMainTables_(w, ctx) {
  var cols = tableColumns_();
  var header = ['Month'].concat(cols.map(function (c) { return c[0]; }));
  var colFormats = [null].concat(cols.map(function (c) { return c[2]; }));
  var labels = { current: ctx.periods.current.shortLabel, prior: ctx.periods.prior.shortLabel };

  var tables = [
    ['RPT_BLENDED',         '4', 'Blended Paid Search',      'blended',
      'The anchor table. Every other table must reconcile back to this one.'],
    ['RPT_SEARCH',          '5', 'Search',                   'search',
      'Text campaigns, including DSA.'],
    ['RPT_SHOPPING',        '5', 'Shopping',                 'shopping',
      'Standard Shopping + Performance Max retail, per the deck definition.'],
    ['RPT_SEARCH_BRAND',    '6', 'Search · Brand',           'searchBrand', ''],
    ['RPT_SEARCH_NONBRAND', '6', 'Search · Non-Brand',       'searchNonBrand',
      'Includes conquesting/competitor campaigns.'],
    ['RPT_SHOP_BRAND',      '7', 'Shopping · Brand',         'shopBrand', ''],
    ['RPT_SHOP_NONBRAND',   '7', 'Shopping · Non-Brand',     'shopNonBrand', ''],
  ];

  for (var i = 0; i < tables.length; i++) {
    var t = tables[i];
    var built = periodRows_(ctx.segments[t[3]], cols, labels);
    w.block({
      name: t[0], slide: t[1], title: t[2], note: t[4],
      header: header, rows: built.rows,
      colFormats: colFormats,
      rowFormats: [null, null, PCT_FORMAT, PCT_FORMAT],
    });
  }
}

// ---- slide 13: ChatGPT Ads ----

function renderChatgptBlock_(w, ctx) {
  var cols = chatgptColumns_();
  var header = ['Month'].concat(cols.map(function (c) { return c[0]; }));
  var built = periodRows_(ctx.chatgpt, cols, {
    current: ctx.periods.current.shortLabel, prior: ctx.periods.prior.shortLabel,
  });

  var spend = derive_(ctx.chatgpt.current).cost;
  var blended = derive_(ctx.segments.blended.current).cost;
  var share = div_(spend, num_(blended) + num_(spend));

  w.block({
    name: 'RPT_CHATGPT', slide: '13', title: 'ChatGPT Ads (OpenAI) — test channel',
    note: 'Triple Whale openai-ads channel. OpenAI reports no conversion value, so the Engine ' +
      'columns are omitted rather than shown as zeros. Share of total paid media investment: ' +
      (share === null ? NA : (share * 100).toFixed(1) + '%') + '.',
    header: header, rows: built.rows,
    colFormats: [null].concat(cols.map(function (c) { return c[2]; })),
    rowFormats: [null, null, PCT_FORMAT, PCT_FORMAT],
  });
}

// ---- reconciliation ----

/**
 * The block that makes the deck defensible.
 *
 * Two gaps can open up, and both are reported in dollars:
 *
 *   slide 4 vs. slide 5 — Demand Gen and unclassifiable campaigns are in the
 *     blended total but belong to neither the Search nor the Shopping table.
 *
 *   slide 5 vs. slides 6/7 — a campaign can land in Search or Shopping and still
 *     have no brand assignment, in which case it appears in the tactic table but
 *     in NEITHER the Brand nor the Non-Brand one. Without this row that campaign
 *     is invisible: every table renders, every table is internally consistent,
 *     and the brand split quietly under-reports.
 */
function renderReconciliationBlock_(w, ctx) {
  var d = function (seg) { return derive_(ctx.segments[seg].current); };
  var blended = d('blended'), search = d('search'), shopping = d('shopping');
  var sBr = d('searchBrand'), sNb = d('searchNonBrand');
  var hBr = d('shopBrand'),   hNb = d('shopNonBrand');
  var unc = d('unclassified');

  // Rounded to cents: these are differences of large sums, so float residue would
  // otherwise render a perfectly reconciled month as '-0.0000'.
  var gap = function (whole, parts) {
    var v = num_(whole) - parts.reduce(function (a, p) { return a + num_(p); }, 0);
    return Math.round(v * 100) / 100;
  };

  var tacticGapCost = gap(blended.cost, [search.cost, shopping.cost]);
  var tacticGapRev  = gap(blended.tw_revenue, [search.tw_revenue, shopping.tw_revenue]);
  var searchGapCost = gap(search.cost, [sBr.cost, sNb.cost]);
  var shopGapCost   = gap(shopping.cost, [hBr.cost, hNb.cost]);

  var rows = [
    ['Blended  (slide 4)',                       blended.cost,  blended.tw_revenue],
    ['  Search  (slide 5)',                       search.cost,   search.tw_revenue],
    ['  Shopping  (slide 5)',                     shopping.cost, shopping.tw_revenue],
    ['  In neither tactic table',                 tacticGapCost, tacticGapRev],
    ['    — of which unclassified / Demand Gen',  unc.cost,      unc.tw_revenue],
    ['Search · Brand  (slide 6)',                 sBr.cost,      sBr.tw_revenue],
    ['Search · Non-Brand  (slide 6)',             sNb.cost,      sNb.tw_revenue],
    ['  Search with no brand assignment',         searchGapCost, gap(search.tw_revenue, [sBr.tw_revenue, sNb.tw_revenue])],
    ['Shopping · Brand  (slide 7)',               hBr.cost,      hBr.tw_revenue],
    ['Shopping · Non-Brand  (slide 7)',           hNb.cost,      hNb.tw_revenue],
    ['  Shopping with no brand assignment',       shopGapCost,   gap(shopping.tw_revenue, [hBr.tw_revenue, hNb.tw_revenue])],
  ];

  var pct = function (v, base) {
    var p = div_(v, base);
    return p === null ? '—' : (p * 100).toFixed(1) + '%';
  };

  var note = 'Search + Shopping do not sum to Blended by design: Demand Gen and any campaign the ' +
    'classifier could not place belong to neither table, but both are real spend and stay in the ' +
    'blended total. That gap is ' + pct(tacticGapCost, blended.cost) + ' of blended cost.  ' +
    'The brand rows should sum to their tactic exactly — "no brand assignment" is ' +
    pct(searchGapCost, search.cost) + ' of Search and ' + pct(shopGapCost, shopping.cost) +
    ' of Shopping. Anything materially above zero there means slides 6–7 under-report their ' +
    'slide 5 parent; fix it with the override columns on the "' + MAP_SHEET + '" tab (amber rows).';

  w.block({
    name: 'RPT_RECONCILIATION', title: 'Reconciliation — why the parts do not sum to the whole',
    note: note,
    header: ['Segment', 'Cost', 'TW Revenue'],
    rows: rows,
    colFormats: [null, currencyFormat_(false), currencyFormat_(false)],
  });
}

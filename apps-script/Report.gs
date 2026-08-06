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

  // Which channels each source covers, per period. Drives the honest disclosure
  // about Microsoft being absent from months the engine backfill doesn't reach.
  var channelCoverage = channelCoverage_(twAds, eng.rows, periods);

  // Front-end source per channel per period, decided from ALL rows for that
  // channel — not per segment. See combineChannelBags_ for why that distinction
  // is load-bearing.
  var frontSource = {};
  ['current', 'prior', 'yoy'].forEach(function (p) {
    frontSource[p] = {};
    channelCoverage[p].triplewhale.forEach(function (ch) { frontSource[p][ch] = 'triplewhale'; });
    channelCoverage[p].engine.forEach(function (ch) { frontSource[p][ch] = 'engine'; });
  });

  /**
   * Component bags per period for one segment.
   *
   * The engine is the spine and Triple Whale is the overlay, combined PER
   * CHANNEL and then summed — see the note above FRONT_COMPONENTS in Metrics.gs
   * for why per channel rather than row-by-row.
   */
  var bagsFor = function (pred) {
    var out = {};
    ['current', 'prior', 'yoy'].forEach(function (p) {
      var period = periods[p];
      var byChannel = {};
      var bucket = function (ch) {
        return byChannel[ch] || (byChannel[ch] = { eng: [], tw: [] });
      };

      var engIn = rowsInPeriod_(eng.rows, period);
      for (var i = 0; i < engIn.length; i++) if (pred(engIn[i])) bucket(engIn[i].channel).eng.push(engIn[i]);

      var twIn = rowsInPeriod_(twAds, period);
      for (var j = 0; j < twIn.length; j++) if (pred(twIn[j])) bucket(twIn[j].channel).tw.push(twIn[j]);

      var combined = Object.keys(byChannel).map(function (ch) {
        return combineChannelBags_(sumComponents_(byChannel[ch].eng),
                                   sumComponents_(byChannel[ch].tw),
                                   frontSource[p][ch] || 'none');
      });
      out[p] = mergeBags_(combined);
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
    // Completes the tactic partition: every row is SEARCH, SHOPPING or OTHER, so
    // the three must sum to blended exactly. Asserted in the self-test.
    other:           bagsFor(function (r) { return r.cls.deckGroup === 'OTHER'; }),
    unclassified:    bagsFor(function (r) { return r.cls.deckGroup === 'OTHER' || r.cls.brand === 'UNKNOWN'; }),
  };

  // One bag per channel, so the report can show Google vs Microsoft explicitly.
  // Without this there is no channel breakout anywhere in the deck or the Report
  // tab — the deck splits by tactic and brand only — and "is Bing actually in
  // these numbers?" becomes unanswerable without reading the source data.
  var adsChannels = {};
  ['current', 'prior', 'yoy'].forEach(function (p) {
    channelCoverage[p].engine.forEach(function (c) { adsChannels[c] = true; });
    channelCoverage[p].triplewhale.forEach(function (c) { adsChannels[c] = true; });
  });
  var channelSegments = {};
  Object.keys(adsChannels).sort().forEach(function (ch) {
    channelSegments[ch] = bagsFor(function (r) { return r.channel === ch; });
  });

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
    twCoverage: twCoverage, engCoverage: engCoverage, channelCoverage: channelCoverage,
    frontSource: frontSource,
    segments: segments, channelSegments: channelSegments, chatgpt: chatgpt,
    mapRows: campaignMapRows_(twAds, eng.rows, periods.current),
    warnings: coverageWarnings_(twCoverage, engCoverage, channelCoverage, periods, tw, segments),
  };
}

/**
 * Which channels each source has rows for, per period, plus each channel's share
 * of current-month spend — so a warning about a missing channel can say how much
 * of the program it actually represents.
 */
function channelCoverage_(twRows, engRows, periods) {
  var out = {};
  ['current', 'prior', 'yoy'].forEach(function (p) {
    var eng = {}, tw = {};
    rowsInPeriod_(engRows, periods[p]).forEach(function (r) { eng[r.channel] = true; });
    rowsInPeriod_(twRows,  periods[p]).forEach(function (r) { tw[r.channel]  = true; });
    out[p] = { engine: Object.keys(eng).sort(), triplewhale: Object.keys(tw).sort() };
  });

  // Current-month spend per channel, engine preferred over Triple Whale so a
  // channel present in both is not counted twice.
  var spend = {}, total = 0;
  var engByChannel = {}, twByChannel = {};
  rowsInPeriod_(engRows, periods.current).forEach(function (r) {
    engByChannel[r.channel] = num_(engByChannel[r.channel]) + num_(r.spend);
  });
  rowsInPeriod_(twRows, periods.current).forEach(function (r) {
    twByChannel[r.channel] = num_(twByChannel[r.channel]) + num_(r.spend);
  });
  var channels = {};
  Object.keys(engByChannel).forEach(function (c) { channels[c] = true; });
  Object.keys(twByChannel).forEach(function (c) { channels[c] = true; });
  Object.keys(channels).forEach(function (c) {
    spend[c] = engByChannel[c] !== undefined ? engByChannel[c] : num_(twByChannel[c]);
    total += spend[c];
  });

  out.currentSpend = spend;
  out.currentSpendTotal = total;
  // Kept separately so the cross-source check can compare only the channels both
  // sources actually cover. Comparing totals would flag a 22% "drift" purely
  // because the engine feed is Google-only while Triple Whale includes Bing —
  // which is not drift, it is the fallback working as designed.
  out.currentEngSpend = engByChannel;
  out.currentTwSpend = twByChannel;
  return out;
}

/**
 * One row per campaign for the Campaign Map, from BOTH sources.
 *
 * Cost prefers the engine (the spine); Triple Whale revenue always comes from
 * Triple Whale. Adding both spends would double-count every campaign that
 * appears in both, so the engine figure wins when present.
 */
function campaignMapRows_(twRows, engRows, period) {
  var acc = {};
  var get = function (channel, campaign) {
    var key = classKey_(channel, campaign);
    return acc[key] || (acc[key] = {
      channel: channel, campaign: campaign,
      engCost: 0, twCost: 0, tw_revenue: 0, engRows: 0, twRows: 0,
    });
  };

  rowsInPeriod_(engRows, period).forEach(function (r) {
    var a = get(r.channel, r.campaign);
    a.engCost += num_(r.spend);
    a.engRows++;
  });
  rowsInPeriod_(twRows, period).forEach(function (r) {
    var a = get(r.channel, r.campaign);
    a.twCost     += num_(r.spend);
    a.tw_revenue += num_(r.tw_revenue);
    a.twRows++;
  });

  return Object.keys(acc).map(function (k) {
    var a = acc[k];
    a.spend = a.engRows ? a.engCost : a.twCost;
    a.source = a.engRows && a.twRows ? 'both' : (a.engRows ? 'engine only' : 'Triple Whale only');
    return a;
  });
}

function coverageWarnings_(twCov, engCov, chanCov, periods, tw, segments) {
  var w = [];
  var cur = derive_(segments.blended.current);

  if (!engCov.current && !twCov.current) {
    w.push('NO data at all for ' + periods.current.label + '. Triple Whale covers ' +
      tw.minDate + ' → ' + tw.maxDate + ' and the engine tab is empty. Sync the Triple Whale ' +
      'sheet, run the MCC Google Ads Script, or set REPORT_MONTH in Config.gs to a covered month.');
  } else if (!engCov.current) {
    w.push('No Google Ads engine data for ' + periods.current.label + ', so front-end columns ' +
      '(impressions, clicks, cost, engine orders/revenue) fall back to Triple Whale for this ' +
      'month. Run the MCC Google Ads Script to make the engine the spine as intended.');
  } else if (!twCov.current) {
    w.push('No Triple Whale data for ' + periods.current.label + ' — front-end and engine ' +
      'columns are real, but every attributed column (TW orders/revenue/AOV/CVR/ROAS) reads n/a.');
  }

  // The gap that matters most: engine history exists but Triple Whale's doesn't.
  ['prior', 'yoy'].forEach(function (p) {
    var label = periods[p].label;
    var which = p === 'prior' ? '%MoM' : '%YoY';
    if (twCov[p]) return;
    if (engCov[p]) {
      w.push(label + ' has engine data but no Triple Whale data, so the ' + which + ' row is real ' +
        'for the front-end and engine columns and n/a for the attributed ones. That is expected ' +
        'until the Triple Whale backfill reaches ' + periods[p].start + ' — see docs/GAPS.md.');
    } else {
      w.push(label + ' has no data from either source, so the whole ' + which + ' row reads n/a. ' +
        'Extend the engine backfill (MONTHS_BACK in engine-report.js) to cover it.');
    }
  });

  // Channels the engine misses in a period Triple Whale cannot cover either.
  ['prior', 'yoy'].forEach(function (p) {
    if (twCov[p] || !engCov[p]) return;      // already reported above
    var engChannels = chanCov[p].engine;
    var missing = TW_ADS_CHANNELS.filter(function (ch) { return engChannels.indexOf(ch) === -1; });
    if (!missing.length) return;
    var share = missingChannelShare_(chanCov, missing);
    w.push(periods[p].label + ' engine data covers ' + engChannels.join(' + ') + ' but not ' +
      missing.join(' + ') + ', so that row understates total spend. ' +
      (share === null ? '' : 'Those channels are ' + (share * 100).toFixed(0) +
        '% of current-month spend. ') +
      'See docs/GAPS.md §8 for the two ways to close this.');
  });

  if (!TW_SESSION_FIELD) {
    w.push('TW Sessions is not available (TW_SESSION_FIELD is unset), so that column reads n/a ' +
      'and TW CVR is computed on clicks. See docs/GAPS.md.');
  }
  return w;
}

/**
 * Share of current-month spend sitting in the channels a past period is missing.
 * Uses the current month as the yardstick because it is the only month we can be
 * sure has all channels — which is exactly why the past period is a problem.
 */
function missingChannelShare_(chanCov, missing) {
  var total = num_(chanCov.currentSpendTotal);
  if (!total) return null;
  var sum = 0;
  for (var i = 0; i < missing.length; i++) sum += num_(chanCov.currentSpend[missing[i]]);
  return sum > 0 ? sum / total : null;
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

  // Existing named ranges, read ONCE.
  //
  // Do not be tempted by removeNamedRange()-then-setNamedRange(): that throws
  // ("The named range X does not exist") whenever the name isn't already there,
  // which is every name on a first build. Worse, Apps Script batches writes, so
  // the throw can surface at the next flush() rather than at the call site —
  // a try/catch around it is not a reliable guard. Updating an existing
  // NamedRange in place via setRange() avoids the whole problem.
  var existingRanges = {};
  ss.getNamedRanges().forEach(function (nr) { existingRanges[nr.getName()] = nr; });
  var emitted = {};

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
        if (emitted[opts.name]) {
          throw new Error('Block "' + opts.name + '" was emitted twice in one build. ' +
            'Every RPT_* name must be unique, or the second one silently wins.');
        }
        emitted[opts.name] = true;

        var range = sheet.getRange(top, 1, rangeRows, width);
        var existing = existingRanges[opts.name];
        if (existing) existing.setRange(range);        // repoint, no remove
        else          ss.setNamedRange(opts.name, range);
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
  renderChannelBlock_(w, ctx);
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

// ---- channel breakout (not a deck slide — a visibility and QA block) ----

/**
 * Google vs Microsoft, side by side, with the front-end source named per channel.
 *
 * The deck never breaks out by channel — slides 4-7 split by tactic and brand —
 * so without this there is no way to confirm from the report that Microsoft spend
 * is in the blended total at all. It also makes the two failure modes that would
 * silently drop a channel visible: a channel missing from this block is missing
 * from every table above it, and a channel whose Source says "triplewhale" is one
 * the engine feed is not covering yet.
 */
function renderChannelBlock_(w, ctx) {
  var cols = tableColumns_();
  var header = ['Channel', 'Front-end source', '% of cost']
    .concat(cols.map(function (c) { return c[0]; }));

  var channels = Object.keys(ctx.channelSegments);
  var blendedCost = num_(derive_(ctx.segments.blended.current).cost);
  var rows = [];

  for (var i = 0; i < channels.length; i++) {
    var ch = channels[i];
    var bag = ctx.channelSegments[ch].current;
    var m = derive_(bag);
    if (!bag._rows) continue;
    var row = [ch, bag._frontSource || 'none', div_(num_(m.cost), blendedCost)];
    for (var c = 0; c < cols.length; c++) row.push(m[cols[c][1]]);
    rows.push(row);
  }
  rows.sort(function (a, b) { return num_(b[2]) - num_(a[2]); });

  // A TOTAL row that must equal slide 4, computed from the blended bag rather
  // than by adding the rows above — so a mismatch is visible instead of hidden by
  // the arithmetic agreeing with itself.
  var blended = derive_(ctx.segments.blended.current);
  var totalRow = ['TOTAL (= slide 4)', ctx.segments.blended.current._frontSource || 'none', 1];
  for (var t = 0; t < cols.length; t++) totalRow.push(blended[cols[t][1]]);
  rows.push(totalRow);

  var engineOnly = [], twOnly = [];
  for (var k = 0; k < channels.length; k++) {
    var src = ctx.channelSegments[channels[k]].current._frontSource;
    if (src === 'engine') engineOnly.push(channels[k]);
    else if (src === 'triplewhale') twOnly.push(channels[k]);
  }

  w.block({
    name: 'RPT_CHANNEL', title: 'Channel breakout — Google vs Microsoft',
    note: 'Not a deck slide. The deck splits by tactic and brand, never by channel, so this block ' +
      'exists to answer "is Microsoft in these numbers?" — it is, wherever a bing row appears.  ' +
      (engineOnly.length ? 'Front end from the engine: ' + engineOnly.join(', ') + '.  ' : '') +
      (twOnly.length ? 'Front end from Triple Whale (no engine feed yet): ' + twOnly.join(', ') +
        ' — set up the Microsoft Advertising Script to move these onto the engine spine, which is ' +
        'also what gives them %YoY history. See docs/GAPS.md §8.  ' : '') +
      'ChatGPT Ads is excluded here and on slide 4 — it is a test channel with its own slide (13).',
    header: header,
    rows: rows,
    colFormats: [null, null, '0.0%'].concat(cols.map(function (c) { return c[2]; })),
    rowFormats: (function () {
      var f = [];
      for (var r = 0; r < rows.length - 1; r++) f.push(null);
      f.push(null);   // TOTAL row keeps column formats; bolding is not available here
      return f;
    })(),
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

  // Do the two sources actually describe the same program? This is the check
  // that catches a broken engine backfill, a missing channel, or a Triple Whale
  // sync that stalled — none of which the per-segment sums would reveal, because
  // each source is internally consistent on its own.
  var bag = ctx.segments.blended.current;
  var engSpend = bag._engSpend, twSpend = bag._twSpend;
  var agreement = (engSpend === null || twSpend === null) ? null : div_(engSpend - twSpend, twSpend);

  rows.push(['Engine cost (spine)',            engSpend, null]);
  rows.push(['Triple Whale spend (overlay)',   twSpend,  null]);
  rows.push(['  engine vs TW difference',
    (engSpend === null || twSpend === null) ? null : Math.round((engSpend - twSpend) * 100) / 100, null]);

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
    'slide 5 parent; fix it with the override columns on the "' + MAP_SHEET + '" tab (amber rows).' +
    '\n\nFront-end source this month: ' + (bag._frontSource || 'none') + '. ' +
    (agreement === null
      ? 'Only one source covers this month, so there is nothing to cross-check.'
      : 'Engine cost runs ' + (agreement * 100).toFixed(1) + '% vs Triple Whale spend. A few percent ' +
        'is normal (different currency conversion and refresh timing). More than ~5% means one side ' +
        'is missing a channel or a sync stalled — check Diagnostics → Check data sources.');

  w.block({
    name: 'RPT_RECONCILIATION', title: 'Reconciliation — why the parts do not sum to the whole',
    note: note,
    header: ['Segment', 'Cost', 'TW Revenue'],
    rows: rows,
    colFormats: [null, currencyFormat_(false), currencyFormat_(false)],
  });
}

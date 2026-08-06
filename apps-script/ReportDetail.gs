/**
 * Xero Shoes — Monthly Report  ·  DETAIL BLOCKS (slides 8–12)
 * =============================================================================
 * These five slides need Google Ads data that Triple Whale does not carry, so
 * they read the `_eng_*` tabs written by google-ads-script/engine-report.js.
 *
 * Every block here degrades to an empty, labelled table when its tab is absent —
 * a deck that renders with a visible "no data, run the MCC script" note is far
 * better than one that silently drops a slide.
 *
 * The two manual-input tabs are created here too:
 *   `Auction Insights` — competitor auction data. Google exposes NO auction
 *                        insights through any API, at any access level. There is
 *                        no script that can fetch this. Paste it. See docs/GAPS.md.
 *   `Promos`           — promo windows, so slide 12 knows what dates to measure.
 */

// ============================== SHARED HELPERS =============================

/** Sum a set of engine detail rows into one bag keyed by `keyFn`. */
function groupEngine_(rows, keyFn) {
  var groups = {}, order = [];
  for (var i = 0; i < rows.length; i++) {
    var k = keyFn(rows[i]);
    if (k === null) continue;
    if (!groups[k]) { groups[k] = { key: k, row: rows[i], impressions: 0, clicks: 0, cost: 0, conversions: 0, conversions_value: 0 }; order.push(k); }
    var g = groups[k];
    g.impressions       += num_(rows[i].impressions);
    g.clicks            += num_(rows[i].clicks);
    g.cost              += num_(rows[i].cost);
    g.conversions       += num_(rows[i].conversions);
    g.conversions_value += num_(rows[i].conversions_value);
  }
  return order.map(function (k) { return groups[k]; });
}

function byValueDesc_(a, b) { return b.conversions_value - a.conversions_value; }

/** Pad a row list out to `n` rows with blanks, so the deck table always fills. */
function padRows_(rows, n, width) {
  var out = rows.slice(0, n);
  while (out.length < n) {
    var blank = [];
    for (var c = 0; c < width; c++) blank.push('');
    out.push(blank);
  }
  return out;
}

function monthOf_(v) {
  var s = String(v || '').trim();
  var m = s.match(/^(\d{4})-(\d{2})/);
  if (m) return m[1] + '-' + m[2];
  var d = normDate_(v);
  return d ? d.slice(0, 7) : '';
}

function emptyNote_(tab) {
  return 'No data in the "' + tab + '" tab. Run the MCC Google Ads Script ' +
    '(google-ads-script/engine-report.js) to populate it — see docs/SETUP.md.';
}

// ============================== SLIDE 8: PRODUCT CATEGORY ==================

function renderProductBlock_(w, ctx) {
  var month = ctx.periods.current.month;
  var raw = readEngineTab_(ENGINE_PRODUCT_SHEET).filter(function (r) { return monthOf_(r.month) === month; });

  // The TAB is the authority on which dimensions its numbers describe — it records
  // them in dim1_field / dim2_field. Reading the labels from the Settings tab
  // instead would head the columns with whatever was configured LAST, which after
  // a settings change but before the next MCC run is a slide that mislabels real
  // data. That is the one failure mode worth engineering against here, because it
  // is invisible: the numbers look fine under the wrong heading.
  var dims = productDimsOf_(raw);

  // Fixed column names `dim1`/`dim2` whatever the dimensions are. Older tabs,
  // written before that, used product_type_l1/l2 — read those as a fallback so an
  // existing sheet keeps working until the Ads script next runs.
  var groups = groupEngine_(raw, function (r) {
    var d1 = r.dim1 !== undefined ? r.dim1 : r.product_type_l1;
    var d2 = r.dim2 !== undefined ? r.dim2 : r.product_type_l2;
    return String(d1 || '(not set)') + '||' + String(d2 || '(not set)');
  }).sort(byValueDesc_);

  var rows = groups.map(function (g) {
    var parts = g.key.split('||');
    return [
      parts[0], parts[1],
      g.impressions, g.clicks, g.cost,
      div_(g.cost, g.clicks),
      g.conversions, g.conversions_value,
      div_(g.conversions_value, g.cost),
    ];
  });

  w.block({
    name: 'RPT_PRODUCT', slide: '8', title: 'Product Category Performance',
    note: raw.length
      ? 'Google Ads engine data, shopping_performance_view segmented by ' + dims[0].label +
        ' × ' + dims[1].label + ' (' + dims[0].field + ' / ' + dims[1].field +
        '). Sorted by conversion value, top ' + PRODUCT_ROWS + ' rows.' + dims.mismatchNote +
        '  Custom labels are free text your Shopping feed sets, so which ones carry a category is a ' +
        'property of the feed: run Diagnostics → Show product dimensions to see what each contains, ' +
        'then set PRODUCT_DIM_1 / PRODUCT_DIM_2 on the Settings tab and re-run the MCC script.'
      : emptyNote_(ENGINE_PRODUCT_SHEET),
    header: [dims[0].label, dims[1].label, 'Impr.', 'Clicks', 'Cost',
             'Avg. CPC', 'Conversions', 'Conv. Value', 'ROAS'],
    rows: padRows_(rows, PRODUCT_ROWS, 9),
    colFormats: [null, null, '#,##0', '#,##0', currencyFormat_(false),
                 currencyFormat_(true), '#,##0', currencyFormat_(false), '#,##0.00'],
  });
}

/**
 * The two dimensions the `_eng_product` rows actually describe, as
 * [ {field,label}, {field,label} ] with a `mismatchNote` string.
 *
 * Prefers what the tab recorded over what is configured now, and says so when they
 * disagree — a settings change only reaches the data on the next MCC run, and in
 * between, the honest thing is to label the columns for the data that is there.
 */
function productDimsOf_(rows) {
  var configured = [PRODUCT_DIM_1, PRODUCT_DIM_2];
  var out = configured.slice();
  out.mismatchNote = '';
  if (!rows.length) return out;

  var stamped = [String(rows[0].dim1_field || '').trim(), String(rows[0].dim2_field || '').trim()];
  var drift = [];

  for (var i = 0; i < 2; i++) {
    if (!stamped[i]) continue;                       // pre-stamp tab: trust config
    out[i] = dimByField_(stamped[i]);
    if (stamped[i] !== configured[i].field) {
      drift.push('PRODUCT_DIM_' + (i + 1) + ' is set to ' + configured[i].field);
    }
  }

  if (drift.length) {
    out.mismatchNote = '  ⚠  These columns are headed for what the tab HOLDS (' +
      out[0].field + ' / ' + out[1].field + '), but ' + drift.join(' and ') +
      ' on the Settings tab. Re-run the MCC Google Ads Script to pull the dimensions you asked for.';
  }
  return out;
}

// ============================== SLIDE 9: IMPRESSION SHARE ==================

function renderImpressionShareBlocks_(w, ctx) {
  // ---- our own brand impression share, by day, from the engine tab ----
  var period = ctx.periods.current;
  var brandSearch = [];
  for (var i = 0; i < ctx.engRows.length; i++) {
    var r = ctx.engRows[i];
    if (r.date < period.start || r.date > period.end) continue;
    // A whole-month total would plot as one bogus daily point.
    if (r.grain === 'month') continue;
    if (!isDeckBrand_(r.cls.brand)) continue;
    if (r.cls.deckGroup !== 'SEARCH') continue;
    brandSearch.push(r);
  }

  var byDate = {};
  for (var j = 0; j < brandSearch.length; j++) {
    var d = brandSearch[j].date;
    (byDate[d] || (byDate[d] = [])).push(brandSearch[j]);
  }
  var dates = Object.keys(byDate).sort();
  var isRows = dates.map(function (dt) {
    var bag = sumComponents_(byDate[dt]);
    return [dt, derive_(bag).is_share];
  });

  var monthShare = brandSearch.length ? derive_(sumComponents_(brandSearch)).is_share : null;

  w.block({
    name: 'RPT_BRAND_IS', slide: '9', title: 'Brand Impression Share — ours, by day',
    note: brandSearch.length
      ? 'Google Ads metrics.search_impression_share on brand search campaigns. Rolled up as total ' +
        'impressions ÷ total eligible impressions, never as an average of daily percentages. ' +
        'Month: ' + (monthShare === null ? NA : (monthShare * 100).toFixed(1) + '%') + '.'
      : emptyNote_(ENGINE_DAY_SHEET) + ' (Needs search_impression_share on brand search campaigns.)',
    header: ['Date', 'Xero Shoes Impr. Share'],
    rows: isRows.length ? isRows : [['', null]],
    colFormats: [null, '0.0%'],
  });

  // ---- competitors: manual paste, because no API exposes this ----
  var auction = readEngineTab_(AUCTION_SHEET);
  var thisMonth = auction.filter(function (r) { return monthOf_(r.month) === period.month; });
  var rows = thisMonth.map(function (r) {
    return [
      String(r.domain || ''),
      toRatio_(r['impr. share'] !== undefined ? r['impr. share'] : r['impression share']),
      toRatio_(r['overlap rate']),
      toRatio_(r['position above rate']),
      toRatio_(r['top of page rate']),
      toRatio_(r['outranking share']),
    ];
  }).sort(function (a, b) { return num_(b[1]) - num_(a[1]); });

  w.block({
    name: 'RPT_AUCTION', slide: '9', title: 'Auction Insights — competitors (manual)',
    note: 'Google exposes NO auction insights data through the Google Ads API or Google Ads ' +
      'Scripts, for any campaign type. This block is fed by hand: Google Ads → Campaigns → select ' +
      'the brand campaigns → Insights → Auction insights → download, then paste into the "' +
      AUCTION_SHEET + '" tab. See docs/GAPS.md.' +
      (thisMonth.length ? '' : '  ⚠  Nothing pasted for ' + period.label + ' yet.'),
    header: ['Display URL Domain', 'Impr. Share', 'Overlap Rate', 'Position Above Rate',
             'Top of Page Rate', 'Outranking Share'],
    rows: rows.length ? rows : [['', null, null, null, null, null]],
    colFormats: [null, '0.0%', '0.0%', '0.0%', '0.0%', '0.0%'],
  });
}

/**
 * A line chart of our brand impression share, parked at the bottom of the Report
 * tab. Slide 9's chart is a native PowerPoint chart carrying sample data, and
 * SlidesApp cannot rewrite a converted chart's series — so the workflow the
 * deck's own speaker notes describe is the one that works: copy this chart and
 * paste it over the placeholder, linked.
 */
function renderBrandIsChart_(sheet, anchorRow) {
  var range = SpreadsheetApp.getActiveSpreadsheet().getRangeByName('RPT_BRAND_IS');
  if (!range || range.getNumRows() < 3) return;   // header + at least two points

  var chart = sheet.newChart()
    .asLineChart()
    .addRange(range)
    .setNumHeaders(1)
    .setPosition(anchorRow, 1, 0, 0)
    .setOption('title', 'Brand Impression Share — ' + CLIENT_NAME + ' (' + REGION + ')')
    .setOption('legend', { position: 'none' })
    .setOption('width', 900)
    .setOption('height', 320)
    .setOption('pointSize', 0)
    .setOption('lineWidth', 3)
    .setOption('colors', ['#1b2a4a'])
    .setOption('vAxis', { format: 'percent', viewWindow: { min: 0, max: 1 } })
    .setOption('hAxis', { slantedText: true, slantedTextAngle: 45 })
    .build();

  sheet.insertChart(chart);
}

/** Accept 0.42, '42%', '42' or '< 10%' from a pasted auction insights export. */
function toRatio_(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return v > 1 ? v / 100 : v;
  var s = String(v).trim();
  if (/^<\s*10%?$/.test(s)) return 0.1;          // Google's "< 10%" floor
  var m = s.match(/-?[\d.]+/);
  if (!m) return null;
  var n = Number(m[0]);
  if (!isFinite(n)) return null;
  return s.indexOf('%') !== -1 ? n / 100 : (n > 1 ? n / 100 : n);
}

// ============================== SLIDE 10: PMAX SEARCH CATEGORIES ===========

function renderPmaxCategoryBlock_(w, ctx) {
  var month = ctx.periods.current.month;

  // MANUAL FIRST. The search-term-insight resources carry undocumented constraints
  // that shift between API versions, so the automated query can come back empty
  // through no fault of the configuration — and the UI panel that has the data has
  // a Download button. Anything pasted therefore wins: you looked at it.
  var manual = readPmaxManual_(month);
  var raw = manual.rows.length
    ? manual.rows
    : readEngineTab_(ENGINE_PMAXCAT_SHEET).filter(function (r) { return monthOf_(r.month) === month; });
  var source = manual.rows.length ? 'manual' : (raw.length ? 'api' : 'none');

  var groups = groupEngine_(raw, function (r) {
    var c = String(r.category || '').trim();
    return c || null;
  }).sort(byValueDesc_);

  var rows = groups.map(function (g) {
    // Search volume is a bucketed RANGE in the UI ("10K-100K"), so it passes
    // through as text when the source supplies it and as n/a when it does not.
    var vol = String((g.row && g.row.search_volume) || '').trim();
    return [
      g.key,
      vol || null,
      g.conversions, g.clicks, g.impressions, g.conversions_value,
      div_(g.clicks, g.impressions),
      div_(g.conversions, g.clicks),
    ];
  });

  var note;
  if (source === 'manual') {
    note = 'Pasted by hand into the "' + PMAXCAT_MANUAL_SHEET + '" tab for ' + month +
      ' — ' + manual.rows.length + ' row(s). A paste takes priority over the API tab, so this is ' +
      'what the slide shows even if the automated feed also returned data.' +
      (manual.unmapped.length
        ? '  ⚠  Unrecognised column(s) ignored: ' + manual.unmapped.join(', ') + '.'
        : '');
  } else if (source === 'api') {
    note = 'Google Ads search-term-category insights, aggregated across Performance Max campaigns ' +
      'and sorted by conversions.';
  } else {
    note = 'EMPTY. Two ways to fill it:  (1) MANUAL — Google Ads → Campaigns → Insights → ' +
      '"Search terms insights" → Download, then paste into the "' + PMAXCAT_MANUAL_SHEET + '" tab ' +
      'with Month as ' + month + '. This always works and is the fastest route.  (2) AUTOMATED — ' +
      'the MCC script tries several query shapes against customer_search_term_insight and ' +
      'campaign_search_term_insight; if the tab is still empty, the "_eng_status" tab carries the ' +
      'exact error Google returned for each shape tried, which is what tells a missing permission ' +
      'apart from a renamed field.';
  }

  w.block({
    name: 'RPT_PMAX_CAT', slide: '10', title: 'Top PMax Search Categories',
    note: note + '  Search Volume is a bucketed range in the Google Ads UI ("10K-100K"); where it ' +
      'reads n/a the source did not supply it, and Impr. on the same row is the usable substitute.',
    header: ['Search Category', 'Search Volume', 'Conversions', 'Clicks', 'Impr.',
             'Conv. Value', 'CTR', 'Conv. Rate'],
    rows: padRows_(rows, PMAX_CAT_ROWS, 8),
    colFormats: [null, '#,##0', '#,##0', '#,##0', '#,##0', currencyFormat_(false), '0.00%', '0.00%'],
  });
}

/**
 * Read the hand-pasted PMax search categories for one month, normalised into the
 * same row shape the engine tab uses so the renderer cannot tell them apart.
 *
 * Column names are matched LOOSELY. A Google Ads export is pasted as-is and its
 * headers vary by view, locale and Google's own redesigns ("Search category" /
 * "Search categories" / "Category"), so insisting on exact spellings would turn a
 * working paste into a silently empty slide. Anything unrecognised is reported
 * rather than dropped quietly.
 *
 * A row with no Month is treated as belonging to the report month: the export does
 * not carry one, and requiring the column is the mistake most likely to make a
 * correct paste look like no paste at all.
 */
function readPmaxManual_(month) {
  var raw = readEngineTab_(PMAXCAT_MANUAL_SHEET);
  if (!raw.length) return { rows: [], unmapped: [] };

  var ALIASES = {
    month:             ['month', 'reporting month', 'period'],
    category:          ['search category', 'search categories', 'category', 'search term category',
                        'categories', 'search category label', 'category label'],
    search_volume:     ['search volume', 'searches', 'volume', 'monthly searches',
                        'search volume index'],
    impressions:       ['impressions', 'impr.', 'impr', 'impressions.'],
    clicks:            ['clicks'],
    cost:              ['cost', 'spend', 'cost (usd)', 'amount spent'],
    conversions:       ['conversions', 'conv.', 'conv', 'all conv.', 'all conversions', 'orders'],
    conversions_value: ['conv. value', 'conversion value', 'conv value', 'all conv. value',
                        'value', 'revenue', 'conv. value (usd)'],
  };

  var present = {}, unmapped = [];
  Object.keys(raw[0]).forEach(function (h) {
    var norm = h.replace(/\s+/g, ' ').trim();
    var hit = null;
    Object.keys(ALIASES).forEach(function (canon) {
      if (hit) return;
      if (ALIASES[canon].indexOf(norm) !== -1) hit = canon;
    });
    if (hit) { if (!present[hit]) present[hit] = h; }
    else if (norm) unmapped.push(h);
  });

  if (!present.category) {
    // No category column means this is not a search-categories paste. Report it
    // through the note rather than showing an empty slide with no explanation.
    return { rows: [], unmapped: ['no recognisable "Search category" column — found: ' +
      Object.keys(raw[0]).join(', ')] };
  }

  var rows = [];
  for (var i = 0; i < raw.length; i++) {
    var r = raw[i];
    var cat = String(r[present.category] || '').trim();
    if (!cat) continue;
    // Placeholder text from the example row the tab is seeded with.
    if (cat.indexOf('Paste your') === 0) continue;

    var m = present.month ? monthOf_(r[present.month]) : '';
    if (m && m !== month) continue;

    rows.push({
      month: month,
      category: cat,
      search_volume: present.search_volume ? r[present.search_volume] : '',
      impressions:       present.impressions       ? numLoose_(r[present.impressions])       : 0,
      clicks:            present.clicks            ? numLoose_(r[present.clicks])            : 0,
      cost:              present.cost              ? numLoose_(r[present.cost])              : 0,
      conversions:       present.conversions       ? numLoose_(r[present.conversions])       : 0,
      conversions_value: present.conversions_value ? numLoose_(r[present.conversions_value]) : 0,
    });
  }
  return { rows: rows, unmapped: unmapped };
}

/**
 * A number out of a pasted export: '1,234', '$1,234.56', '12.3%', ' 45 '.
 * A Google Ads download carries thousands separators and currency symbols, which
 * Number() turns into NaN — and NaN summed into a total is a silently wrong slide.
 */
function numLoose_(v) {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  var s = String(v === null || v === undefined ? '' : v).trim();
  if (!s || s === '--' || s === '—') return 0;
  var pct = s.indexOf('%') !== -1;
  var n = Number(s.replace(/[^0-9.\-]/g, ''));
  if (!isFinite(n)) return 0;
  return pct ? n / 100 : n;
}

// ============================== SLIDE 11: TOP PRODUCTS =====================

function renderTopItemsBlock_(w, ctx) {
  var month = ctx.periods.current.month;
  var raw = readEngineTab_(ENGINE_ITEM_SHEET).filter(function (r) { return monthOf_(r.month) === month; });

  var groups = groupEngine_(raw, function (r) {
    return String(r.item_id || r.title || '').trim() || null;
  }).sort(byValueDesc_);

  var rows = groups.map(function (g) {
    var title = String(g.row.title || '').trim() || g.key;
    return [title, g.key, g.conversions, g.conversions_value, g.cost, div_(g.conversions_value, g.cost)];
  });

  w.block({
    name: 'RPT_TOP_ITEMS', slide: '11', title: 'Performance Max — Top Products by Revenue',
    note: raw.length
      ? 'Google Ads engine data at item level, sorted by conversion value. Row 1 is the deck\'s ' +
        '"top revenue driver" card. Product imagery is not automated — drop shots from the Shopping ' +
        'feed into the deck\'s image frames.'
      : emptyNote_(ENGINE_ITEM_SHEET),
    header: ['Product Name', 'Item ID', 'Orders', 'Revenue', 'Cost', 'ROAS'],
    rows: padRows_(rows, TOP_ITEM_ROWS, 6),
    colFormats: [null, null, '#,##0', currencyFormat_(false), currencyFormat_(false), '#,##0.00'],
  });
}

// ============================== SLIDE 12: PROMOTION RECAP ==================

function renderPromoBlocks_(w, ctx) {
  var promos = readPromos_(ctx.periods.current);
  var noPromoNote = 'No promo windows listed for ' + ctx.periods.current.label + ' on the "' +
    PROMO_SHEET + '" tab. Add one (Promo Name, Start, End) to build this block — or delete slide 12 ' +
    'for months with no promotion, as the deck\'s speaker notes suggest.';

  // ---- window totals: the promo, the equal-length run-up, and last year ----
  var rows = [];
  for (var i = 0; i < promos.length; i++) {
    var pr = promos[i];
    rows.push(promoRow_(pr.name + ' (' + pr.start + ' → ' + pr.end + ')', ctx.twAds, pr.start, pr.end));
    rows.push(promoRow_('— prior ' + pr.days + ' days', ctx.twAds, pr.priorStart, pr.priorEnd));
    rows.push(promoRow_('— same window last year', ctx.twAds, pr.lyStart, pr.lyEnd));
    rows.push(promoRow_('— brand text only, promo window', ctx.twAds, pr.start, pr.end, function (r) {
      return r.cls.deckGroup === 'SEARCH' && isDeckBrand_(r.cls.brand);
    }));
  }

  w.block({
    name: 'RPT_PROMO_SUMMARY', slide: '12', title: 'Promotion Recap — window totals',
    note: promos.length
      ? 'Triple Whale attributed revenue over each promo window, with the equal-length run-up ' +
        'before it and the same calendar window last year for context. "n/a" on the last-year row ' +
        'means the Triple Whale backfill does not reach that far.'
      : noPromoNote,
    header: ['Window', 'Days', 'Cost', 'TW Revenue', 'TW ROAS', 'TW Orders', 'TW AOV'],
    rows: rows.length ? rows : [['', null, null, null, null, null, null]],
    colFormats: [null, '#,##0', currencyFormat_(false), currencyFormat_(false), '#,##0.00',
                 '#,##0', currencyFormat_(true)],
  });

  // ---- sitelink / extension detail from the engine asset tab ----
  // Always emitted, even with no promo: the deck's slide 12 table is mapped to
  // this range, and an unregistered range makes the Slides writer report a
  // missing block rather than a blank-but-correct one.
  var first = promos.length ? promos[0] : null;
  var inWindow = [];
  if (first) {
    inWindow = readEngineTab_(ENGINE_ASSET_SHEET).filter(function (r) {
      var d = normDate_(r.date);
      return d && d >= first.start && d <= first.end;
    });
  }

  var groups = groupEngine_(inWindow, function (r) {
    return String(r.asset_text || '').trim() || null;
  }).sort(byValueDesc_);

  var assetRows = padRows_(groups.map(function (g) {
    return [g.key, g.impressions, g.clicks, g.cost, g.conversions];
  }), PROMO_ROWS, 5);

  var totals = groups.reduce(function (a, g) {
    return [a[0] + g.impressions, a[1] + g.clicks, a[2] + g.cost, a[3] + g.conversions];
  }, [0, 0, 0, 0]);
  assetRows.push(['Grand Total'].concat(groups.length ? totals : [null, null, null, null]));

  w.block({
    name: 'RPT_PROMO_ASSETS', slide: '12', title: 'Promotion Recap — sitelinks / extensions',
    note: (!first
      ? noPromoNote + ' '
      : (inWindow.length
          ? 'Google Ads asset performance over ' + first.name + ' (' + first.start + ' → ' + first.end + '). '
          : emptyNote_(ENGINE_ASSET_SHEET) + ' ')) +
      'Orders here are ENGINE-reported conversions on the asset — Google does not attribute Triple ' +
      'Whale revenue to individual sitelinks, so use the window totals above for the revenue story.' +
      (promos.length > 1 ? '  Showing the first of ' + promos.length + ' promo windows; duplicate ' +
        'deck slide 12 per promo and re-run with the others reordered on the ' + PROMO_SHEET + ' tab.' : ''),
    header: ['Sitelink / Extension', 'Impr.', 'Clicks', 'Spend', 'Orders'],
    rows: assetRows,
    colFormats: [null, '#,##0', '#,##0', currencyFormat_(false), '#,##0'],
  });
}

function promoRow_(label, rows, start, end, pred) {
  if (!start || !end) return [label, null, null, null, null, null, null];
  var kept = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (r.date < start || r.date > end) continue;
    if (pred && !pred(r)) continue;
    kept.push(r);
  }
  var m = derive_(sumComponents_(kept));
  return [label, daysBetween_(start, end) + 1, m.cost, m.tw_revenue, m.tw_roas, m.tw_orders, m.tw_aov];
}

/** Promo windows overlapping the report month, with their comparison windows. */
function readPromos_(period) {
  var raw = readEngineTab_(PROMO_SHEET);
  var out = [];
  for (var i = 0; i < raw.length; i++) {
    var name = String(raw[i]['promo name'] || raw[i].promo || raw[i].name || '').trim();
    var start = normDate_(raw[i].start), end = normDate_(raw[i].end);
    if (!name || !start || !end) continue;
    if (end < period.start || start > period.end) continue;      // no overlap with the month
    var days = daysBetween_(start, end) + 1;
    out.push({
      name: name, start: start, end: end, days: days,
      priorStart: dateAdd_(start, -days), priorEnd: dateAdd_(start, -1),
      lyStart: dateAdd_(start, -365), lyEnd: dateAdd_(end, -365),
    });
  }
  return out.sort(function (a, b) { return a.start < b.start ? -1 : 1; });
}

// ============================== INPUT TABS =================================

/** Create the two hand-fed tabs, with headers and guidance, if they don't exist. */
function ensureInputTabs_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  if (!ss.getSheetByName(AUCTION_SHEET)) {
    var a = ss.insertSheet(AUCTION_SHEET);
    var ah = ['Month', 'Domain', 'Impr. Share', 'Overlap Rate', 'Position Above Rate',
              'Top of Page Rate', 'Outranking Share'];
    a.getRange(1, 1, 1, ah.length).setValues([ah])
      .setFontWeight('bold').setBackground(HEAD_BG).setFontColor(HEAD_FG);
    a.setFrozenRows(1);
    a.getRange(1, 1).setNote('Month as yyyy-MM (e.g. 2026-07). One row per competitor domain per ' +
      'month. Paste from Google Ads → Campaigns → select brand campaigns → Insights → Auction ' +
      'insights → download. This cannot be automated: no Google API exposes auction insights.');
    a.getRange(2, 1, 1, 2).setValues([['', 'Paste your auction insights export here →']])
      .setFontColor('#9ca3af').setFontStyle('italic');
    for (var c = 1; c <= ah.length; c++) a.autoResizeColumn(c);
  }

  if (!ss.getSheetByName(PMAXCAT_MANUAL_SHEET)) {
    var m = ss.insertSheet(PMAXCAT_MANUAL_SHEET);
    var mh = ['Month', 'Search Category', 'Search Volume', 'Impressions', 'Clicks',
              'Cost', 'Conversions', 'Conv. Value'];
    m.getRange(1, 1, 1, mh.length).setValues([mh])
      .setFontWeight('bold').setBackground(HEAD_BG).setFontColor(HEAD_FG);
    m.setFrozenRows(1);
    m.getRange(1, 1).setNote('Slide 10. Google Ads → Campaigns → Insights → "Search terms ' +
      'insights" → Download, then paste here. Month as yyyy-MM; leave Month empty and the rows ' +
      'count as the report month.\n\nColumn names are matched loosely, so you can paste the export ' +
      'with its own headers — only a "Search category" column is required. Anything here takes ' +
      'PRIORITY over the automated "' + ENGINE_PMAXCAT_SHEET + '" tab.');
    m.getRange(2, 1, 1, 3).setValues([['', 'Paste your search terms insights export here →', '']])
      .setFontColor('#9ca3af').setFontStyle('italic');
    m.getRange(2, 1, 200, 1).setNumberFormat('@');
    for (var c3 = 1; c3 <= mh.length; c3++) m.autoResizeColumn(c3);
  }

  if (!ss.getSheetByName(PROMO_SHEET)) {
    var p = ss.insertSheet(PROMO_SHEET);
    var ph = ['Promo Name', 'Start', 'End', 'Notes'];
    p.getRange(1, 1, 1, ph.length).setValues([ph])
      .setFontWeight('bold').setBackground(HEAD_BG).setFontColor(HEAD_FG);
    p.setFrozenRows(1);
    p.getRange(1, 1).setNote('One row per promotion. Dates as yyyy-MM-dd, inclusive. Any promo ' +
      'overlapping the report month drives slide 12. Leave empty for months with no promotion.');
    p.getRange(2, 1, 1, 4).setValues([['Example — delete me', '2026-07-04', '2026-07-08',
      'Slide 12 measures this window vs. the 5 days before it and the same window last year']])
      .setFontColor('#9ca3af').setFontStyle('italic');
    p.getRange(2, 2, 1, 2).setNumberFormat('@');
    for (var c2 = 1; c2 <= ph.length; c2++) p.autoResizeColumn(c2);
  }
}

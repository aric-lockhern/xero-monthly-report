/**
 * Xero Shoes — Monthly Report  ·  DIAGNOSTICS
 * =============================================================================
 * Read-only inspections. Nothing here writes to the Report tab or the deck.
 *
 * The classification diagnostics are the ones worth running every month: they
 * answer "is the Search/Shopping/Brand split actually right this month, or did
 * someone rename a campaign?" before the numbers reach a client.
 */

function diagCheckSources() {
  var lines = [];

  try {
    var tw = readTripleWhale_();
    var chans = {};
    for (var i = 0; i < tw.rows.length; i++) {
      var c = tw.rows[i].channel;
      chans[c] = (chans[c] || 0) + 1;
    }
    lines.push('TRIPLE WHALE  (' + TW_STORE_SHEET + ' tab of ' + TW_SPREADSHEET_ID + ')');
    lines.push('  rows: ' + tw.rows.length + '   dates: ' + tw.minDate + ' → ' + tw.maxDate);
    lines.push('  channels: ' + Object.keys(chans).sort().map(function (k) {
      return k + ' (' + chans[k] + ')';
    }).join(', '));
    lines.push('  sessions column: ' + (tw.sessionsAvailable ? 'present' : 'ABSENT — TW Sessions reads n/a'));

    var unknownChans = Object.keys(chans).filter(function (k) {
      return !isAdsChannel_(k) && !isOpenAiChannel_(k);
    });
    if (unknownChans.length) {
      lines.push('  ⚠  channels present but NOT in TW_ADS_CHANNELS/TW_OPENAI_CHANNELS, so excluded ' +
        'from every table: ' + unknownChans.join(', '));
    }
  } catch (e) {
    lines.push('TRIPLE WHALE — ERROR: ' + e.message);
  }

  lines.push('');
  lines.push('GOOGLE ADS ENGINE TABS');
  var tabs = [ENGINE_DAY_SHEET, ENGINE_PRODUCT_SHEET, ENGINE_PMAXCAT_SHEET,
              ENGINE_ITEM_SHEET, ENGINE_ASSET_SHEET];
  for (var t = 0; t < tabs.length; t++) {
    var rows = readEngineTab_(tabs[t]);
    lines.push('  ' + tabs[t] + ': ' + (rows.length ? rows.length + ' rows' : 'empty / absent'));
  }

  lines.push('');
  lines.push('MANUAL INPUT TABS');
  lines.push('  ' + AUCTION_SHEET + ': ' + readEngineTab_(AUCTION_SHEET).length + ' rows');
  lines.push('  ' + PROMO_SHEET + ': ' + readEngineTab_(PROMO_SHEET).length + ' rows');

  tell_('Data sources', lines.join('\n'));
}

function diagCoverage() {
  var periods = resolvePeriods_();
  var tw = readTripleWhale_();
  var eng = readEngineDays_();

  var fmt = function (label, p, rows) {
    var n = rowsInPeriod_(rows, p).length;
    return '  ' + label + ' ' + p.month + ' (' + p.start + ' → ' + p.end + '): ' +
      (n ? n + ' rows' : 'NO DATA');
  };

  var lines = [
    'Reporting ' + periods.current.label + (REPORT_MONTH ? ' (pinned by REPORT_MONTH)' : ' (last complete month)'),
    '',
    'TRIPLE WHALE',
    fmt('current', periods.current, tw.rows),
    fmt('prior  ', periods.prior, tw.rows),
    fmt('YoY    ', periods.yoy, tw.rows),
    '',
    'GOOGLE ADS ENGINE',
    fmt('current', periods.current, eng.rows),
    fmt('prior  ', periods.prior, eng.rows),
    fmt('YoY    ', periods.yoy, eng.rows),
  ];

  var cov = coverage_(tw.rows, periods);
  if (!cov.yoy) {
    lines.push('');
    lines.push('The %YoY row will read n/a for Triple Whale columns. To fix properly, set ' +
      'BACKFILL_START = \'' + periods.yoy.start + '\' in the ld-x-tw-script project and run ' +
      '"Rebuild all data". Expect that to take a while — it is roughly ' +
      (daysBetween_(periods.yoy.start, todayStr_())) + ' days of history at one API call per day.');
  }

  tell_('Period coverage', lines.join('\n'));
}

function diagClassification() {
  var ctx = buildReportContext_();
  var rows = rowsInPeriod_(ctx.twAds, ctx.periods.current);

  var byTactic = {}, byBrand = {}, byGroup = {}, total = 0;
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i], s = num_(r.spend);
    total += s;
    byTactic[r.cls.tactic] = (byTactic[r.cls.tactic] || 0) + s;
    byBrand[r.cls.brand]   = (byBrand[r.cls.brand]   || 0) + s;
    byGroup[r.cls.deckGroup] = (byGroup[r.cls.deckGroup] || 0) + s;
  }

  var show = function (title, map) {
    var keys = Object.keys(map).sort(function (a, b) { return map[b] - map[a]; });
    return [title].concat(keys.map(function (k) {
      var pct = total ? (map[k] / total * 100).toFixed(1) + '%' : '—';
      return '  ' + k + ': ' + Math.round(map[k]).toLocaleString() + '  (' + pct + ')';
    })).join('\n');
  };

  tell_('Classification — ' + ctx.periods.current.label,
    'Share of ' + REGION + ' paid-search cost, ' + Math.round(total).toLocaleString() + ' total.\n\n' +
    show('BY DECK GROUP (drives slides 5–7)', byGroup) + '\n\n' +
    show('BY TACTIC', byTactic) + '\n\n' +
    show('BY BRAND', byBrand) + '\n\n' +
    'OTHER and UNKNOWN are excluded from the Search/Shopping tables but stay in the blended total — ' +
    'that is the gap the Reconciliation block reports. Pin them on the Campaign Map tab.');
}

function diagUnclassified() {
  var ctx = buildReportContext_();
  var rows = rowsInPeriod_(ctx.twAds, ctx.periods.current);

  var bad = {};
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (r.cls.deckGroup !== 'OTHER' && r.cls.brand !== 'UNKNOWN') continue;
    var k = r.channel + ' | ' + r.campaign;
    if (!bad[k]) bad[k] = { cost: 0, rev: 0, tactic: r.cls.tactic, brand: r.cls.brand };
    bad[k].cost += num_(r.spend);
    bad[k].rev  += num_(r.tw_revenue);
  }

  var keys = Object.keys(bad).sort(function (a, b) {
    return (bad[b].cost + bad[b].rev) - (bad[a].cost + bad[a].rev);
  });

  if (!keys.length) {
    tell_('Unclassified campaigns', 'None — every campaign this month landed in a Search or Shopping ' +
      'table with a brand assignment.');
    return;
  }

  var lines = keys.map(function (k) {
    return '· ' + k + '\n    tactic=' + bad[k].tactic + '  brand=' + bad[k].brand +
      '   cost=' + Math.round(bad[k].cost).toLocaleString() +
      '   TW revenue=' + Math.round(bad[k].rev).toLocaleString();
  });

  tell_('Unclassified campaigns — ' + ctx.periods.current.label,
    keys.length + ' campaign(s) are excluded from the Search/Shopping tables:\n\n' +
    lines.join('\n') + '\n\n' +
    'Zero-cost rows carrying revenue are normal: they are Triple Whale attributing late orders to ' +
    'campaigns that have since been renamed or paused. Pin the ones that matter on the "' + MAP_SHEET +
    '" tab using the override columns.');
}

function diagValidateDeck() {
  if (!DECK_TEMPLATE_ID) { tell_('Deck template', 'DECK_TEMPLATE_ID is not set in Config.gs.'); return; }

  var deck;
  try { deck = SlidesApp.openById(DECK_TEMPLATE_ID); }
  catch (e) { tell_('Deck template — ERROR', 'Cannot open ' + DECK_TEMPLATE_ID + ' as Google Slides. ' +
    'An uploaded .pptx must be converted first (File → Save as Google Slides). ' + e.message); return; }

  var slides = deck.getSlides();
  var lines = ['"' + deck.getName() + '" — ' + slides.length + ' slides.', ''];
  var plan = slidePlan_();
  var problems = 0;

  for (var i = 0; i < plan.length; i++) {
    var step = plan[i];
    if (step.slide > slides.length) {
      lines.push('✗ slide ' + step.slide + ' (' + step.range + '): slide does not exist');
      problems++;
      continue;
    }
    var tables = slides[step.slide - 1].getTables().slice().sort(function (a, b) { return a.getTop() - b.getTop(); });
    if (tables.length <= step.pick) {
      lines.push('✗ slide ' + step.slide + ' (' + step.range + '): needs table #' + (step.pick + 1) +
        ', found ' + tables.length);
      problems++;
      continue;
    }
    var tb = tables[step.pick];
    var got = tb.getNumRows() + '×' + tb.getNumColumns();
    var want = (step.rows + 1) + '×' + step.cols;
    var ok = got === want;
    if (!ok) problems++;
    lines.push((ok ? '✓' : '✗') + ' slide ' + step.slide + ' table #' + (step.pick + 1) + ' → ' +
      step.range + ': ' + got + (ok ? '' : '  (expected ' + want + ')'));
  }

  tell_(problems ? 'Deck template — ' + problems + ' mismatch(es)' : 'Deck template — all tables match',
    lines.join('\n') + (problems ? '\n\nMismatched tables are SKIPPED at build time rather than ' +
      'half-filled. Either fix the deck table, or adjust PRODUCT_ROWS / PMAX_CAT_ROWS / PROMO_ROWS ' +
      'in Config.gs to match it.' : ''));
}

function diagNamedRanges() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ranges = ss.getNamedRanges().filter(function (r) { return r.getName().indexOf('RPT_') === 0; });
  if (!ranges.length) { tell_('Named ranges', 'None yet — run "Build report" first.'); return; }

  var lines = ranges.map(function (r) {
    var rg = r.getRange();
    return '· ' + r.getName() + '  →  ' + rg.getSheet().getName() + '!' + rg.getA1Notation() +
      '  (' + rg.getNumRows() + '×' + rg.getNumColumns() + ')';
  }).sort();

  tell_('Report tab named ranges', ranges.length + ' block(s):\n\n' + lines.join('\n') +
    '\n\nThese are what the Slides writer reads, and what you can paste or link into the deck by hand.');
}

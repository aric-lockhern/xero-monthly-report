/**
 * Xero Shoes — Monthly Report  ·  SLIDES WRITER
 * =============================================================================
 * Copies the framework deck and fills it from the `RPT_*` named ranges.
 *
 * It reads DISPLAY values, not raw numbers. The Report tab has already applied
 * every number format, so the deck is guaranteed to show exactly the figures you
 * reviewed in the sheet — no second, subtly different formatting path that lets
 * the deck and the sheet disagree.
 *
 * What it does NOT touch, by design:
 *   · narrative bullets — the "[Headline #1 — …]" placeholders. Those are the
 *     analyst's job, and a generated sentence about "up 12% MoM" is exactly the
 *     filler a client notices.
 *   · slide 9's chart, and slide 12's ad-unit screenshot. See docs/GAPS.md.
 *
 * Slide 11 product imagery IS filled, from the `Product Images` tab — the Google
 * Ads API exposes no image URL, so those come from your Shopping feed. See
 * ProductImages.gs.
 *
 * The deck is validated before anything is written: if a table's shape doesn't
 * match the block that feeds it, that table is SKIPPED and reported, rather than
 * half-filled.
 *
 * THE TEMPLATE IS NEVER MODIFIED. writeDeck_ calls makeCopy() and every write
 * goes to the copy; the template is only ever read. The two functions that open
 * the template directly — firstRunCheck and diagValidateDeck — only inspect it
 * (getSlides, getTables, getNumRows) and never saveAndClose. There is also an
 * explicit id check below, so the invariant is enforced rather than merely
 * intended.
 */

/**
 * Slide-by-slide fill plan.
 *
 * `slide`  1-based slide number in the framework deck
 * `range`  named range on the Report tab
 * `pick`   which table on that slide, when there is more than one, ordered top to
 *          bottom (slides 5–7 each carry two identically-shaped tables)
 * `rows`   expected data rows in the deck table, excluding its header row
 * `cols`   expected columns
 */
function slidePlan_() {
  return [
    { slide: 4,  range: 'RPT_BLENDED',        pick: 0, rows: 4,               cols: 15 },
    { slide: 5,  range: 'RPT_SEARCH',         pick: 0, rows: 4,               cols: 15 },
    { slide: 5,  range: 'RPT_SHOPPING',       pick: 1, rows: 4,               cols: 15 },
    { slide: 6,  range: 'RPT_SEARCH_BRAND',   pick: 0, rows: 4,               cols: 15 },
    { slide: 6,  range: 'RPT_SEARCH_NONBRAND',pick: 1, rows: 4,               cols: 15 },
    { slide: 7,  range: 'RPT_SHOP_BRAND',     pick: 0, rows: 4,               cols: 15 },
    { slide: 7,  range: 'RPT_SHOP_NONBRAND',  pick: 1, rows: 4,               cols: 15 },
    { slide: 8,  range: 'RPT_PRODUCT',        pick: 0, rows: PRODUCT_ROWS,    cols: 9  },
    { slide: 10, range: 'RPT_PMAX_CAT',       pick: 0, rows: PMAX_CAT_ROWS,   cols: 8  },
    { slide: 12, range: 'RPT_PROMO_ASSETS',   pick: 0, rows: PROMO_ROWS + 1,  cols: 5  },
    { slide: 13, range: 'RPT_CHATGPT',        pick: 0, rows: 4,               cols: 12 },
  ];
}

// ============================== ENTRY POINT ================================

function buildDeck() {
  applySettings_();
  var ctx = buildReportContext_();
  renderReportTab_(ctx);
  renderCampaignMap_(ctx.mapRows, ctx.classify);
  var url = writeDeck_(ctx);
  tell_('Deck ready', url ? url :
    'Deck generation skipped — DECK_TEMPLATE_ID is not set.\n\n' +
    'Fix it with  Setup → Find the deck template in Drive,  which locates your converted Google ' +
    'Slides deck and writes the id to the "' + SETTINGS_SHEET + '" tab.\n\n' +
    'Set it on that tab, NOT in Config.gs: pasting an updated dist/Code.gs replaces the whole Apps ' +
    'Script project, so a value typed into the code is lost on every update. The Settings tab ' +
    'survives.\n\nThe Report tab was still built, so no work is lost.');
  return url;
}

function writeDeck_(ctx) {
  if (!DECK_TEMPLATE_ID) {
    progress_('DECK_TEMPLATE_ID is not set (see the ' + SETTINGS_SHEET + ' tab) — Report tab built, deck skipped.');
    return '';
  }

  var period = ctx.periods.current;
  var name = CLIENT_NAME + ' — Monthly Review — ' + REGION + ' — ' + period.label;

  progress_('Copying the deck template…');
  var templateFile = DriveApp.getFileById(DECK_TEMPLATE_ID);
  var copy = DECK_OUTPUT_FOLDER_ID
    ? templateFile.makeCopy(name, DriveApp.getFolderById(DECK_OUTPUT_FOLDER_ID))
    : templateFile.makeCopy(name);

  // Belt and braces on the one thing that must never happen. Everything below
  // writes, so if this were ever the template rather than a copy we would be
  // overwriting the master — and the damage is silent, because a filled deck
  // looks fine until next month when the placeholders are gone.
  if (copy.getId() === DECK_TEMPLATE_ID) {
    throw new Error('Refusing to write: the copy resolved to the same file id as DECK_TEMPLATE_ID. ' +
      'The template must never be modified.');
  }

  var deck = SlidesApp.openById(copy.getId());
  var slides = deck.getSlides();
  var skipped = [];

  // ---- tables ----
  var plan = slidePlan_();
  for (var i = 0; i < plan.length; i++) {
    var step = plan[i];
    try {
      fillTable_(deck, slides, step, skipped);
    } catch (e) {
      skipped.push('slide ' + step.slide + ' / ' + step.range + ': ' + e.message);
    }
  }

  // ---- cover + footers ----
  fillCover_(deck, ctx);

  // ---- slide 3 stat cards ----
  try { fillKpiCards_(slides, ctx, skipped); }
  catch (e) { skipped.push('slide 3 stat cards: ' + e.message); }

  // ---- slide 8 headers, which follow the configured product dimensions ----
  try { fillProductHeaders_(slides, skipped); }
  catch (e) { skipped.push('slide 8 headers: ' + e.message); }

  // ---- slide 11 product cards, with imagery ----
  try { fillProductCards_(slides, skipped); }
  catch (e) { skipped.push('slide 11 product cards: ' + e.message); }

  deck.saveAndClose();

  if (skipped.length) {
    progress_('Deck written with ' + skipped.length + ' item(s) skipped: ' + skipped.join(' | '));
  } else {
    progress_('Deck written: every mapped table and card filled.');
  }
  return copy.getUrl();
}

// ============================== TABLES =====================================

function fillTable_(deck, slides, step, skipped) {
  if (step.slide > slides.length) {
    skipped.push('slide ' + step.slide + ' does not exist in the template (deck has ' +
      slides.length + ' slides)');
    return;
  }

  var values = namedDisplayValues_(step.range);
  if (!values) { skipped.push(step.range + ' named range is missing from the Report tab'); return; }

  // Row 0 of the block is its header; the deck table already has its own header.
  var body = values.slice(1);

  var tables = slides[step.slide - 1].getTables().slice().sort(function (a, b) {
    return a.getTop() - b.getTop();
  });
  if (tables.length <= step.pick) {
    skipped.push('slide ' + step.slide + ' has ' + tables.length + ' table(s), expected at least ' +
      (step.pick + 1) + ' for ' + step.range);
    return;
  }

  var table = tables[step.pick];
  var tRows = table.getNumRows(), tCols = table.getNumColumns();

  // Validate before touching anything — a half-filled client table is worse than
  // an unfilled one, because it looks finished.
  if (tCols !== step.cols || tRows !== step.rows + 1) {
    skipped.push('slide ' + step.slide + ' table ' + step.pick + ' is ' + tRows + '×' + tCols +
      ', expected ' + (step.rows + 1) + '×' + step.cols + ' for ' + step.range +
      ' — deck and Config.gs row counts are out of step');
    return;
  }

  var wrote = 0;
  for (var r = 0; r < Math.min(body.length, tRows - 1); r++) {
    for (var c = 0; c < Math.min(body[r].length, tCols); c++) {
      var v = body[r][c];
      table.getCell(r + 1, c).getText().setText(v === null || v === undefined ? '' : String(v));
      wrote++;
    }
  }
  progress_('Slide ' + step.slide + ': filled ' + step.range + ' (' + wrote + ' cells).');
}

function namedDisplayValues_(name) {
  var range = SpreadsheetApp.getActiveSpreadsheet().getRangeByName(name);
  if (!range) return null;
  return range.getDisplayValues();
}

// ============================== COVER / FOOTERS ============================

function fillCover_(deck, ctx) {
  var p = ctx.periods.current;
  var fmt = function (ds) {
    var d = parseYmd_(ds);
    return d ? Utilities.formatDate(d, tz_(), 'MM/dd/yy') : ds;
  };

  // replaceAllText is deck-wide, which is what we want for the repeated tokens.
  var subs = [
    ['[Month YYYY]',              p.label],
    ['[MM/DD/YY – MM/DD/YY]',     fmt(p.start) + ' – ' + fmt(p.end)],
    ['[MM/DD/YY]',                Utilities.formatDate(new Date(), tz_(), 'MM/dd/yy')],
    ['[Next Month]',              monthPeriod_(addMonths_(p.month, 1)).label],
    ['[Account Team], Lockhern Digital', AGENCY_NAME],
  ];
  for (var i = 0; i < subs.length; i++) {
    try { deck.replaceAllText(subs[i][0], subs[i][1]); } catch (e) {}
  }
  progress_('Cover and footers: reporting period and dates set.');
}

// ============================== SLIDE 3 STAT CARDS =========================

/**
 * The four stat cards are separate text boxes holding '$—', '—x' or '—' with a
 * '— % MoM' box beneath each. There is no placeholder name to key off, so they
 * are matched by their placeholder TEXT and ordered LEFT TO RIGHT, which is the
 * order the deck lays them out: spend, revenue, ROAS, orders.
 */
function fillKpiCards_(slides, ctx, skipped) {
  if (slides.length < 3) { skipped.push('slide 3 is missing from the template'); return; }

  var vals = namedDisplayValues_('RPT_KPI');
  if (!vals || vals.length < 3) { skipped.push('RPT_KPI named range is missing'); return; }
  var values = vals[1].slice(1);   // row 1 = values, col 0 = 'Value' label
  var moms   = vals[2].slice(1);   // row 2 = % MoM

  var shapes = slides[2].getShapes();
  var valueBoxes = [], momBoxes = [];

  for (var i = 0; i < shapes.length; i++) {
    var text;
    try { text = shapes[i].getText().asString().trim(); } catch (e) { continue; }
    if (/^—\s*%\s*MoM$/.test(text))       momBoxes.push(shapes[i]);
    else if (/^(\$—|—x|—)$/.test(text))   valueBoxes.push(shapes[i]);
  }

  var byLeft = function (a, b) { return a.getLeft() - b.getLeft(); };
  valueBoxes.sort(byLeft);
  momBoxes.sort(byLeft);

  if (valueBoxes.length !== 4 || momBoxes.length !== 4) {
    skipped.push('slide 3: found ' + valueBoxes.length + ' value box(es) and ' + momBoxes.length +
      ' MoM box(es), expected 4 of each — the stat cards may already be filled from a previous run ' +
      'on this copy, or the template was edited');
    return;
  }

  for (var k = 0; k < 4; k++) {
    valueBoxes[k].getText().setText(values[k] === '' ? NA : String(values[k]));
    var m = String(moms[k] || '');
    momBoxes[k].getText().setText((m === '' || m === NA ? NA : m) + ' MoM');
  }
  progress_('Slide 3: four stat cards filled.');
}

// ============================== SLIDE 11 PRODUCT CARDS =====================

function fillProductCards_(slides, skipped) {
  if (slides.length < 11) { skipped.push('slide 11 is missing from the template'); return; }

  var vals = namedDisplayValues_('RPT_TOP_ITEMS');
  if (!vals) { skipped.push('RPT_TOP_ITEMS named range is missing'); return; }
  var body = vals.slice(1);   // [ title, item_id, orders, revenue, cost, roas ]

  var slide = slides[10];
  var shapes = slide.getShapes();
  var names = [], orders = [], revenue = [], frames = [];
  for (var i = 0; i < shapes.length; i++) {
    var text;
    try { text = shapes[i].getText().asString().trim(); } catch (e) { continue; }
    if (/^\[Product Name \d+\]$/.test(text)) names.push(shapes[i]);
    else if (/^Orders\s+—$/.test(text))      orders.push(shapes[i]);
    else if (/^Revenue\s+\$—$/.test(text))   revenue.push(shapes[i]);
    // The image placeholder reads "Product\nImage" in the template.
    else if (/^Product\s+Image$/i.test(text.replace(/\s+/g, ' '))) frames.push(shapes[i]);
  }

  var byLeft = function (a, b) { return a.getLeft() - b.getLeft(); };
  names.sort(byLeft); orders.sort(byLeft); revenue.sort(byLeft); frames.sort(byLeft);

  var n = Math.min(names.length, TOP_ITEM_ROWS, body.length);
  if (!n) { skipped.push('slide 11: no product-name placeholders found'); return; }

  var imageMap = readProductImages_();
  var imagesPlaced = 0, imagesMissing = [];

  for (var k = 0; k < n; k++) {
    var row = body[k] || [];
    var title = String(row[0] || '').trim();
    var itemId = String(row[1] || '').trim();

    names[k].getText().setText(title || '—');
    if (orders[k])  orders[k].getText().setText('Orders  ' + (row[2] === '' ? NA : row[2]));
    if (revenue[k]) revenue[k].getText().setText('Revenue  ' + (row[3] === '' ? NA : row[3]));

    if (!frames[k]) continue;
    var url = productImageUrl_(imageMap, itemId, title);
    if (!url) { imagesMissing.push(title || itemId); continue; }

    // A frame that cannot be filled KEEPS its placeholder. Leaving a visible gap
    // is right: a missing photo is obvious and fixable, whereas the wrong photo
    // beside a product name is not.
    if (insertProductImage_(slide, frames[k], url, skipped, title)) imagesPlaced++;
    else imagesMissing.push(title || itemId);
  }

  if (names.length > n) {
    skipped.push('slide 11: ' + (names.length - n) + ' product card(s) left as placeholders — ' +
      'fewer products had revenue than the deck has cards. Delete the extra cards.');
  }
  if (imagesMissing.length) {
    skipped.push('slide 11: no image for ' + imagesMissing.length + ' product(s) (' +
      imagesMissing.slice(0, 3).join('; ') + (imagesMissing.length > 3 ? ' …' : '') +
      ') — those frames keep their placeholder. Run Setup → Product image status to see why.');
  }
  progress_('Slide 11: ' + n + ' card(s) filled, ' + imagesPlaced + ' image(s) placed.');
}

/**
 * Put one product image inside a placeholder frame, then remove the placeholder.
 *
 * The image is fitted INSIDE the frame preserving its aspect ratio and centred,
 * rather than stretched to the frame's shape. Product shots are near-square and
 * the frames are portrait, so stretching would visibly distort the shoe — which
 * on a client deck is worse than a slightly smaller image.
 */
function insertProductImage_(slide, frame, url, skipped, label) {
  var left = frame.getLeft(), top = frame.getTop();
  var boxW = frame.getWidth(), boxH = frame.getHeight();

  var image;
  try {
    image = slide.insertImage(url);
  } catch (e) {
    // A 404, a login-walled URL, or a format Slides refuses. Report and move on;
    // one bad image must not abandon the rest of the deck.
    skipped.push('slide 11: could not insert image for "' + (label || '?') + '" — ' + e.message +
      ' (the URL must be publicly reachable)');
    return false;
  }

  var natW = image.getWidth(), natH = image.getHeight();
  var scale = (natW > 0 && natH > 0) ? Math.min(boxW / natW, boxH / natH) : 1;
  var w = natW * scale, h = natH * scale;

  image.setWidth(w).setHeight(h);
  image.setLeft(left + (boxW - w) / 2).setTop(top + (boxH - h) / 2);

  try { frame.remove(); } catch (e) { /* leave it behind the image if it won't delete */ }
  return true;
}

/**
 * Rewrite slide 8's first two header cells to match the data underneath them.
 *
 * The table writer only fills DATA rows, so without this the deck would keep
 * saying "Product Type (1st)" over columns that now hold Custom Label 1 — a
 * mislabelled column being far worse than an empty one, because nothing looks
 * wrong.
 *
 * The labels come from RPT_PRODUCT's own header row rather than from
 * PRODUCT_DIM_*.label, so they follow renderProductBlock_'s decision about which
 * dimensions the rows actually describe. Two places computing the heading is how
 * they end up disagreeing.
 */
function fillProductHeaders_(slides, skipped) {
  if (slides.length < 8) return;
  var tables = slides[7].getTables();
  if (!tables.length) { skipped.push('slide 8: no table found to relabel'); return; }

  var block = namedDisplayValues_('RPT_PRODUCT');
  var labels = (block && block.length && block[0].length >= 2)
    ? [block[0][0], block[0][1]]
    : [PRODUCT_DIM_1.label, PRODUCT_DIM_2.label];

  var table = tables[0];
  if (table.getNumColumns() < 2) return;
  try {
    table.getCell(0, 0).getText().setText(labels[0]);
    table.getCell(0, 1).getText().setText(labels[1]);
    progress_('Slide 8: headers set to ' + labels[0] + ' / ' + labels[1] + '.');
  } catch (e) {
    skipped.push('slide 8: could not relabel the first two headers — ' + e.message);
  }
}

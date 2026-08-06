/**
 * Xero Shoes — Monthly Report  ·  PRODUCT IMAGES (slide 11)
 * =============================================================================
 * Resolves an image URL for each of slide 11's top products, so the deck's five
 * image frames fill themselves.
 *
 * WHY NOT STRAIGHT FROM GOOGLE ADS
 * -----------------------------------------------------------------------------
 * It cannot be done. The Google Ads API exposes no product image URL and no
 * product link on any resource — confirmed by the Google Ads API team, and still
 * true. `shopping_performance_view` gives the item id and title and stops there.
 * So the URL has to come from the place that actually owns product imagery: the
 * Merchant Center / Shopping feed.
 *
 * HOW IT WORKS
 * -----------------------------------------------------------------------------
 * A `Product Images` tab maps item id → image URL. It is filled either
 *
 *   automatically — set PRODUCT_FEED_URL on the Settings tab to your Shopping
 *                   feed (the XML or TSV your Merchant Center pulls) and run
 *                   Setup → Refresh product images. Parses both formats.
 *
 *   or by hand    — paste two columns. Rows you type are preserved on every
 *                   refresh, so a one-off override always wins.
 *
 * The Slides writer then inserts the image into each frame. Matching is by item
 * id first and exact title second, because which of the two the engine feed gives
 * us depends on the account's feed setup.
 *
 * A product with no match leaves its frame as the "Product Image" placeholder,
 * which is the honest outcome — a deck missing one shot is obvious and fixable,
 * whereas a wrong shot next to a product name is not.
 */

var PRODUCT_IMAGE_SHEET = 'Product Images';
var PRODUCT_IMAGE_HEADER = ['item_id', 'title', 'image_url', 'source'];

// Feeds can be large; cap what we keep so the tab stays workable. Slide 11 needs
// five, and the tab only has to cover whatever reaches the top of the report.
var PRODUCT_IMAGE_MAX_ROWS = 5000;

// ============================== TAB ========================================

function ensureProductImageTab_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(PRODUCT_IMAGE_SHEET);
  if (sheet) return sheet;

  sheet = ss.insertSheet(PRODUCT_IMAGE_SHEET);
  sheet.getRange(1, 1, 1, PRODUCT_IMAGE_HEADER.length).setValues([PRODUCT_IMAGE_HEADER])
    .setFontWeight('bold').setBackground(HEAD_BG).setFontColor(HEAD_FG);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1).setNote(
    'Maps a product to its image URL for slide 11.\n\n' +
    'Fill it automatically by setting PRODUCT_FEED_URL on the Settings tab and running ' +
    'Setup → Refresh product images, or paste item_id and image_url by hand.\n\n' +
    'source=manual rows are PRESERVED by a refresh; source=feed rows are replaced. So a hand-typed ' +
    'override always wins.\n\n' +
    'The image URL must be publicly reachable — Slides fetches it directly.');
  sheet.setColumnWidth(1, 180);
  sheet.setColumnWidth(2, 420);
  sheet.setColumnWidth(3, 420);
  sheet.hideSheet();
  return sheet;
}

/** Read the map as { byId: {...}, byTitle: {...}, count: n }. */
function readProductImages_() {
  var out = { byId: {}, byTitle: {}, count: 0 };
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PRODUCT_IMAGE_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return out;

  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).getValues();
  for (var i = 0; i < values.length; i++) {
    var id = String(values[i][0] || '').trim();
    var title = String(values[i][1] || '').trim();
    var url = String(values[i][2] || '').trim();
    if (!url) continue;
    if (id) out.byId[id.toLowerCase()] = url;
    if (title) out.byTitle[normTitle_(title)] = url;
    out.count++;
  }
  return out;
}

/** Titles vary by whitespace and case between the feed and the Ads report. */
function normTitle_(t) {
  return String(t || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Resolve one product's image URL. Item id wins over title, because ids are
 * stable and titles get edited.
 */
function productImageUrl_(map, itemId, title) {
  var byId = map.byId[String(itemId || '').trim().toLowerCase()];
  if (byId) return byId;
  return map.byTitle[normTitle_(title)] || '';
}

// ============================== FEED REFRESH ===============================

function refreshProductImages() {
  applySettings_();
  ensureProductImageTab_();

  if (!PRODUCT_FEED_URL) {
    tell_('No feed URL set',
      'Set PRODUCT_FEED_URL on the "' + SETTINGS_SHEET + '" tab to your Shopping feed, then run ' +
      'this again.\n\n' +
      'It should be the same feed URL Merchant Center pulls — a Google Shopping XML feed (with ' +
      '<g:id> and <g:image_link>) or a TSV/CSV with id and image_link columns. On Shopify that is ' +
      'usually whatever your feed app publishes.\n\n' +
      'The Google Ads API exposes no product image URL on any resource, so the feed is the only ' +
      'automated source. You can also just paste item_id and image_url into the "' +
      PRODUCT_IMAGE_SHEET + '" tab by hand.');
    return;
  }

  var res;
  try {
    res = fetchFeed_(PRODUCT_FEED_URL);
  } catch (e) {
    tell_('Could not fetch the feed', feedFetchHelp_(e));
    return;
  }
  if (res.getResponseCode() !== 200) {
    tell_('Feed returned HTTP ' + res.getResponseCode(),
      'PRODUCT_FEED_URL must be publicly reachable without a login — Apps Script cannot sign in to ' +
      'it.\n\nFirst 300 characters of the response:\n' + res.getContentText().slice(0, 300));
    return;
  }

  var body = res.getContentText();
  var parsed;
  try {
    parsed = /^\s*<\?xml|^\s*<rss|^\s*<feed/i.test(body) ? parseFeedXml_(body) : parseFeedDelimited_(body);
  } catch (e) {
    tell_('Could not parse the feed', e.message +
      '\n\nExpected a Google Shopping XML feed (<g:id>, <g:image_link>) or a TSV/CSV with id and ' +
      'image_link columns.\n\nFirst 300 characters:\n' + body.slice(0, 300));
    return;
  }

  if (!parsed.rows.length) {
    tell_('Feed parsed but contained no products',
      'Found ' + parsed.format + ' but no rows carrying both an id and an image link.' +
      (parsed.headers ? '\n\nColumns seen: ' + parsed.headers.join(', ') : ''));
    return;
  }

  var written = writeProductImages_(parsed.rows);
  tell_('Product images refreshed',
    parsed.format + ' feed parsed.\n\n' +
    '  products with an image  ' + parsed.rows.length + '\n' +
    '  written to the tab      ' + written.feed + '\n' +
    '  hand-typed rows kept    ' + written.manual + '\n\n' +
    (parsed.rows.length > PRODUCT_IMAGE_MAX_ROWS
      ? 'Capped at ' + PRODUCT_IMAGE_MAX_ROWS + ' rows — slide 11 only needs the top few, so this ' +
        'is not a problem unless a top product is missing.\n\n'
      : '') +
    'Next: Build report + generate deck. Slide 11 will fill any frame it can match by item id, then ' +
    'by exact title. An unmatched product keeps its placeholder rather than borrowing another ' +
    'product\'s photo.');
}

function fetchFeed_(url) {
  return UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
}

/**
 * Turn a fetch failure into something actionable.
 *
 * The missing-scope case is worth special-casing because the message Google gives
 * is accurate but tells you nothing about what to actually do, and it is the
 * failure everyone hits first: the project was authorised BEFORE the code
 * contained any UrlFetchApp call, so the stored grant has no external_request
 * scope and Apps Script does not re-prompt on its own.
 */
function feedFetchHelp_(e) {
  var msg = String(e && e.message || e);

  if (/permission to call UrlFetchApp|script\.external_request/i.test(msg)) {
    return 'This script is not yet authorised to make external requests.\n\n' + msg + '\n\n' +
      'WHY, and it is not what it looks like: if this project\'s appsscript.json contains an ' +
      'explicit "oauthScopes" list, that list OVERRIDES Apps Script\'s automatic scope detection. ' +
      'A manifest written before the code made any external request therefore withholds the ' +
      'permission permanently — and because Apps Script believes the existing authorisation is ' +
      'sufficient, it never prompts. Running from the editor does not help.\n\n' +
      'FIX — update the manifest:\n' +
      '  1. Extensions → Apps Script\n' +
      '  2. ⚙ Project Settings → tick "Show appsscript.json manifest file in editor"\n' +
      '  3. Open appsscript.json from the file list on the left\n' +
      '  4. Make sure "oauthScopes" contains this line:\n' +
      '       "https://www.googleapis.com/auth/script.external_request"\n' +
      '     The full correct manifest is dist/appsscript.json in the repo — paste the whole thing.\n' +
      '  5. Save, then run Setup → Refresh product images. You WILL now be re-prompted, and the ' +
      'consent screen will list "Connect to an external service".\n\n' +
      'IF IT STILL FAILS after fixing the manifest, the stored grant is cached. Force a fresh one:\n' +
      '  a. Go to  myaccount.google.com/permissions\n' +
      '  b. Find this project (its name, or "Untitled project") → Remove access\n' +
      '  c. Run anything from the Monthly Report menu → authorise again from scratch\n\n' +
      'Or skip the whole thing: Setup → Prepare product image rows writes this month\'s five ' +
      'products into the "' + PRODUCT_IMAGE_SHEET + '" tab with empty URL cells. Paste five image ' +
      'URLs and the deck fills — no external-request permission needed at all.\n\n' +
      'Alternatively delete the whole "oauthScopes" key: Apps Script then infers scopes from the ' +
      'code on every save, which cannot go stale.';
  }

  if (/DNS|Address unavailable|host/i.test(msg)) {
    return 'The feed host could not be resolved.\n\n' + msg + '\n\nCheck the URL for a typo.';
  }

  return 'PRODUCT_FEED_URL could not be reached.\n\n' + msg;
}

/** Google Shopping RSS: <item><g:id>…</g:id><g:image_link>…</g:image_link></item> */
function parseFeedXml_(body) {
  var doc = XmlService.parse(body);
  var root = doc.getRootElement();
  var g = XmlService.getNamespace('http://base.google.com/ns/1.0');

  // RSS puts items under <channel>; Atom puts <entry> at the root.
  var items = [];
  var channel = root.getChild('channel');
  if (channel) items = channel.getChildren('item');
  if (!items.length) items = root.getChildren('item');
  if (!items.length) items = root.getChildren('entry', root.getNamespace());
  if (!items.length) items = root.getChildren();

  var rows = [];
  for (var i = 0; i < items.length && rows.length < PRODUCT_IMAGE_MAX_ROWS; i++) {
    var it = items[i];
    var id = childText_(it, 'id', g);
    var title = childText_(it, 'title', g) || childText_(it, 'title', null);
    var img = childText_(it, 'image_link', g) || childText_(it, 'image_link', null);
    if (!img) continue;
    rows.push([id, title, img]);
  }
  return { rows: rows, format: 'Google Shopping XML' };
}

function childText_(el, name, ns) {
  try {
    var c = ns ? el.getChild(name, ns) : el.getChild(name);
    return c ? String(c.getText()).trim() : '';
  } catch (e) { return ''; }
}

/** TSV or CSV with `id` and `image_link` columns, in any order. */
function parseFeedDelimited_(body) {
  var delim = body.indexOf('\t') !== -1 ? '\t' : ',';
  var lines = body.split(/\r?\n/).filter(function (l) { return l.trim() !== ''; });
  if (!lines.length) throw new Error('The feed is empty.');

  var header = splitLine_(lines[0], delim).map(function (h) {
    return String(h).replace(/^﻿/, '').trim().toLowerCase();
  });
  var iId = indexOfAny_(header, ['id', 'item_id', 'offer_id', 'sku', 'variant sku']);
  var iTitle = indexOfAny_(header, ['title', 'product title', 'name']);
  var iImg = indexOfAny_(header, ['image_link', 'image link', 'image', 'image_url', 'image src']);

  if (iImg === -1) {
    throw new Error('No image column found. Looked for image_link / image link / image / image_url.');
  }

  var rows = [];
  for (var r = 1; r < lines.length && rows.length < PRODUCT_IMAGE_MAX_ROWS; r++) {
    var cells = splitLine_(lines[r], delim);
    var img = String(cells[iImg] || '').trim();
    if (!img) continue;
    rows.push([
      iId === -1 ? '' : String(cells[iId] || '').trim(),
      iTitle === -1 ? '' : String(cells[iTitle] || '').trim(),
      img,
    ]);
  }
  return { rows: rows, format: delim === '\t' ? 'TSV' : 'CSV', headers: header };
}

function splitLine_(line, delim) {
  if (delim === '\t') return line.split('\t');
  // Minimal CSV: quoted fields with embedded commas.
  var out = [], field = '', inQ = false;
  for (var i = 0; i < line.length; i++) {
    var c = line[i];
    if (inQ) {
      if (c === '"') { if (line[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { out.push(field); field = ''; }
    else field += c;
  }
  out.push(field);
  return out;
}

function indexOfAny_(header, names) {
  for (var i = 0; i < names.length; i++) {
    var at = header.indexOf(names[i]);
    if (at !== -1) return at;
  }
  return -1;
}

/**
 * Replace the feed-sourced rows, keeping every hand-typed one.
 *
 * Preserving manual rows matters: the feed will not have a photo for every
 * product forever, and a one-off override typed to fix a specific deck must not
 * be erased by the next refresh.
 */
function writeProductImages_(feedRows) {
  var sheet = ensureProductImageTab_();
  var manual = [];

  if (sheet.getLastRow() > 1) {
    var existing = sheet.getRange(2, 1, sheet.getLastRow() - 1, PRODUCT_IMAGE_HEADER.length).getValues();
    for (var i = 0; i < existing.length; i++) {
      var src = String(existing[i][3] || '').trim().toLowerCase();
      var url = String(existing[i][2] || '').trim();
      if (url && src !== 'feed') manual.push([existing[i][0], existing[i][1], url, 'manual']);
    }
  }

  // A manual row wins, so drop any feed row for the same id or title.
  var claimedId = {}, claimedTitle = {};
  manual.forEach(function (m) {
    if (m[0]) claimedId[String(m[0]).trim().toLowerCase()] = true;
    if (m[1]) claimedTitle[normTitle_(m[1])] = true;
  });

  var out = manual.slice();
  for (var f = 0; f < feedRows.length; f++) {
    var id = String(feedRows[f][0] || '').trim();
    var title = String(feedRows[f][1] || '').trim();
    if (id && claimedId[id.toLowerCase()]) continue;
    if (!id && title && claimedTitle[normTitle_(title)]) continue;
    out.push([id, title, feedRows[f][2], 'feed']);
  }

  var last = sheet.getLastRow();
  if (last > 1) sheet.getRange(2, 1, last - 1, PRODUCT_IMAGE_HEADER.length).clearContent();
  if (out.length) sheet.getRange(2, 1, out.length, PRODUCT_IMAGE_HEADER.length).setValues(out);

  return { feed: out.length - manual.length, manual: manual.length, total: out.length };
}

// ============================== STATUS =====================================

/** How many of THIS month's slide-11 products actually have an image. */
function productImageStatus() {
  applySettings_();
  var map = readProductImages_();
  var range = SpreadsheetApp.getActiveSpreadsheet().getRangeByName('RPT_TOP_ITEMS');

  var lines = [
    'Tab: ' + PRODUCT_IMAGE_SHEET,
    'Mapped products: ' + map.count,
    'Feed URL: ' + (PRODUCT_FEED_URL || 'not set'),
    '',
  ];

  if (!range) {
    lines.push('No RPT_TOP_ITEMS block yet — run Build report first to see which products matter.');
  } else {
    var vals = range.getValues().slice(1);   // [title, item_id, orders, revenue, cost, roas]
    lines.push('Slide 11 products this month:');
    for (var i = 0; i < vals.length; i++) {
      var title = String(vals[i][0] || '').trim();
      var id = String(vals[i][1] || '').trim();
      if (!title && !id) continue;
      var url = productImageUrl_(map, id, title);
      lines.push('  ' + (url ? '✓' : '✗') + '  ' + (title || id).slice(0, 60) +
        (url ? '' : '   ← no image; frame keeps its placeholder'));
    }
  }

  lines.push('');
  lines.push('Matching is by item id first, then exact title. A miss usually means the feed uses a ' +
    'different id format than the Ads report — paste that one product\'s image_url into the tab by ' +
    'hand and it will stick (manual rows survive every refresh).');

  tell_('Product image status', lines.join('\n'));
}


// ============================== FEED DIAGNOSTIC ============================

/**
 * Report what the feed actually looks like, without trying to parse it into the
 * tab.
 *
 * This exists because the parser has to guess at a structure that varies between
 * feed generators — namespaced vs. plain <title>, <item> vs. <entry>, id under
 * <g:id> vs. <g:mpn> vs. a plain <id>. Rather than iterate blind, this prints the
 * first product's element names verbatim so a mismatch is visible in one look.
 */
function diagnoseProductFeed() {
  applySettings_();
  if (!PRODUCT_FEED_URL) {
    tell_('No feed URL set', 'Set PRODUCT_FEED_URL on the "' + SETTINGS_SHEET + '" tab first.');
    return;
  }

  var res;
  try { res = fetchFeed_(PRODUCT_FEED_URL); }
  catch (e) { tell_('Could not fetch the feed', feedFetchHelp_(e)); return; }

  var code = res.getResponseCode();
  var body = res.getContentText();
  var lines = [
    'URL      ' + PRODUCT_FEED_URL,
    'HTTP     ' + code,
    'Size     ' + Math.round(body.length / 1024) + ' KB',
    '',
  ];

  if (code !== 200) {
    lines.push('The feed did not return 200, so nothing else can be checked.');
    lines.push('First 400 characters:');
    lines.push(body.slice(0, 400));
    tell_('Feed diagnostic', lines.join('\n'));
    return;
  }

  var looksXml = /^\s*<\?xml|^\s*<rss|^\s*<feed/i.test(body);
  lines.push('Format   ' + (looksXml ? 'XML' : (body.indexOf('\t') !== -1 ? 'TSV (tab-delimited)' : 'CSV or plain text')));

  if (!looksXml) {
    var firstLine = body.split(/\r?\n/)[0] || '';
    var delim = body.indexOf('\t') !== -1 ? '\t' : ',';
    var header = splitLine_(firstLine, delim).map(function (h) { return String(h).trim(); });
    lines.push('');
    lines.push('Columns (' + header.length + '):');
    lines.push('  ' + header.join(' | '));
    lines.push('');
    lines.push('Looking for an id column among: id, item_id, offer_id, sku');
    lines.push('Looking for an image column among: image_link, image link, image, image_url, image src');
    tell_('Feed diagnostic', lines.join('\n'));
    return;
  }

  // ---- XML: report the real element names ----
  var doc;
  try { doc = XmlService.parse(body); }
  catch (e) {
    lines.push('');
    lines.push('XML PARSE FAILED: ' + e.message);
    lines.push('');
    lines.push('First 400 characters:');
    lines.push(body.slice(0, 400));
    tell_('Feed diagnostic', lines.join('\n'));
    return;
  }

  var root = doc.getRootElement();
  lines.push('Root     <' + root.getName() + '>');

  var nsList = [];
  try {
    nsList.push('default: ' + (root.getNamespace().getURI() || '(none)'));
    var g = root.getNamespace('g');
    if (g) nsList.push('g: ' + g.getURI());
  } catch (e) {}
  lines.push('Namespaces  ' + (nsList.join('   ') || '(none found)'));

  var channel = root.getChild('channel');
  var items = channel ? channel.getChildren('item') : [];
  var itemTag = 'item (under <channel>)';
  if (!items.length) { items = root.getChildren('item'); itemTag = 'item (at root)'; }
  if (!items.length) { items = root.getChildren('entry'); itemTag = 'entry'; }
  if (!items.length) { items = root.getChildren(); itemTag = 'first-level children (fallback)'; }

  lines.push('Products ' + items.length + '   as <' + itemTag + '>');

  if (items.length) {
    var first = items[0];
    var kids = first.getChildren();
    lines.push('');
    lines.push('FIRST PRODUCT — ' + kids.length + ' element(s):');
    for (var i = 0; i < kids.length && i < 40; i++) {
      var k = kids[i];
      var prefix = '';
      try { prefix = k.getNamespace().getPrefix(); } catch (e) {}
      var val = String(k.getText() || '').trim();
      lines.push('  <' + (prefix ? prefix + ':' : '') + k.getName() + '>  ' +
        (val.length > 90 ? val.slice(0, 90) + '…' : val));
    }

    // What the parser would actually extract.
    var gns = XmlService.getNamespace('http://base.google.com/ns/1.0');
    var id = childText_(first, 'id', gns) || childText_(first, 'id', null);
    var title = childText_(first, 'title', gns) || childText_(first, 'title', null);
    var img = childText_(first, 'image_link', gns) || childText_(first, 'image_link', null);
    lines.push('');
    lines.push('WHAT THE PARSER EXTRACTS FROM IT:');
    lines.push('  id          ' + (id || '(nothing found)'));
    lines.push('  title       ' + (title ? title.slice(0, 70) : '(nothing found)'));
    lines.push('  image_link  ' + (img ? img.slice(0, 90) : '(nothing found)'));
    lines.push('');
    lines.push(img
      ? '✓ Images are readable. Run Setup → Refresh product images.'
      : '✗ No image_link found. Send me the element list above and I will fix the parser.');
    if (id) {
      lines.push('');
      lines.push('NOTE: slide 11 matches on this id against the item id in the Google Ads report. ' +
        'If the two use different formats, matching falls back to the exact product title — and ' +
        'Setup → Product image status will show which products resolved.');
    }
  }

  tell_('Feed diagnostic', lines.join('\n'));
}


// ============================== MANUAL ESCAPE HATCH ========================

/**
 * Seed the tab with THIS MONTH's five slide-11 products, ready for five pasted
 * URLs.
 *
 * This exists so product images never depend on the external-request permission.
 * Feed fetching is the convenience; the tab is the actual source of truth, and it
 * can always be filled by hand. Five URLs a month is a minute of work — a
 * perfectly reasonable place to stop if the scope proves troublesome.
 */
function prepareProductImageRows() {
  applySettings_();
  var sheet = ensureProductImageTab_();

  var range = SpreadsheetApp.getActiveSpreadsheet().getRangeByName('RPT_TOP_ITEMS');
  if (!range) {
    tell_('Nothing to prepare yet',
      'Run Monthly Report → Build report first. That produces slide 11\'s product list, which is ' +
      'what this fills in.');
    return;
  }

  var body = range.getValues().slice(1);   // [title, item_id, orders, revenue, cost, roas]
  var existing = readProductImages_();
  var added = [], already = [];

  for (var i = 0; i < body.length; i++) {
    var title = String(body[i][0] || '').trim();
    var itemId = String(body[i][1] || '').trim();
    if (!title && !itemId) continue;
    if (productImageUrl_(existing, itemId, title)) { already.push(title || itemId); continue; }
    // source='manual' so a later feed refresh never overwrites what you paste.
    added.push([itemId, title, '', 'manual']);
  }

  if (!added.length) {
    tell_('Every product already has an image',
      already.length + ' product(s) on slide 11 resolve to an image already. Nothing to add.');
    return;
  }

  var start = Math.max(sheet.getLastRow() + 1, 2);
  sheet.getRange(start, 1, added.length, PRODUCT_IMAGE_HEADER.length).setValues(added);
  sheet.showSheet();
  sheet.activate();
  sheet.setActiveRange(sheet.getRange(start, 3, added.length, 1));

  tell_('Ready for image URLs',
    added.length + ' product(s) added to the "' + PRODUCT_IMAGE_SHEET + '" tab' +
    (already.length ? ' (' + already.length + ' already had an image)' : '') + '.\n\n' +
    'Paste an image URL into the highlighted image_url column for each, then run\n' +
    'Monthly Report → Build report + generate deck.\n\n' +
    'Where to get the URLs: open the product on your own site, right-click the main photo → Copy ' +
    'image address. Any publicly reachable URL works — Slides fetches it directly.\n\n' +
    'These rows are marked source=manual, so a later feed refresh will never overwrite them.');
}

/**
 * Generate a synthetic Triple Whale `_store` CSV for tools/harness.js.
 *
 * Deterministic — no Math.random, so the same file comes out every time and a
 * self-test failure is always about the code and never about the fixture.
 *
 * CALIBRATED to the real July 2026 report-month spend, because the self-test
 * cross-checks engine cost against Triple Whale spend PER CHANNEL and fires above
 * 5% drift. A fixture inventing unrelated numbers would fail that check on every
 * run and train everyone to ignore it. The engine fixture
 * (tools/fixtures/engine-sample.json) is calibrated to ~$219.7k google-ads; the
 * channel split (google 90.6% / bing 9.4%) is the real one from the deck.
 */
const fs = require('fs');

const HEADER = ['Date', 'Channel', 'Campaign', 'spend', 'impressions', 'clicks',
  'channel_conv', 'channel_cv', 'orders_quantity', 'order_revenue',
  'new_customer_orders', 'new_customer_order_revenue'];

// Channel ids MUST match TW_ADS_CHANNELS / TW_OPENAI_CHANNELS in Config.gs —
// Triple Whale calls Microsoft "bing", not "microsoft-ads".
const CAMPAIGNS = [
  ['google-ads',    'US | Search | Brand — Xero Shoes',        1.00],
  ['google-ads',    'US | Search | Non-Brand — Barefoot',      0.80],
  ['google-ads',    'US | Search | Competitor — Vivo',         0.30],
  ['google-ads',    'US | Shopping | Brand',                   0.60],
  ['google-ads',    'US | PMax | Retail — All Products',       1.40],
  ['google-ads',    'US | DSA | Dynamic Search',               0.20],
  ['google-ads',    'US | Demand Gen | Prospecting',           0.35],
  ['bing',          'US | Search | Brand — Xero Shoes',        0.25],
  ['bing',          'US | Shopping | Brand',                   0.12],
  ['openai-ads',    'ChatGPT Ads — Prospecting',               0.09],
];

// Report-month spend each channel must land on.
const TARGET = { 'google-ads': 219700, 'bing': 22800, 'openai-ads': 4300 };
const REPORT_MONTH = '2026-07';

const START = Date.UTC(2024, 5, 1);    // 2024-06-01 — 26 months of history
const END   = Date.UTC(2026, 6, 31);   // 2026-07-31 — June and July both complete
const TW_FROM = '2025-05-01';          // Triple Whale coverage starts here

/** Untuned daily spend for one campaign, before channel calibration. */
function rawSpend(weight, dayIx) {
  const season = 1 + 0.25 * Math.sin(dayIx / 58);   // smooth, so %MoM is non-trivial
  const growth = 1 + dayIx / 1400;                  // and %YoY is a real increase
  return weight * 340 * season * growth;
}

function eachDay(fn) {
  for (let t = START; t <= END; t += 86400000) {
    const iso = new Date(t).toISOString().slice(0, 10);
    fn(iso, Math.round((t - START) / 86400000));
  }
}

// Pass 1 — measure the report month, per channel.
const measured = {};
eachDay((iso, dayIx) => {
  if (iso.slice(0, 7) !== REPORT_MONTH) return;
  for (const [channel, , w] of CAMPAIGNS) {
    measured[channel] = (measured[channel] || 0) + rawSpend(w, dayIx);
  }
});

// Pass 2 — scale each channel onto its target and write.
const scale = {};
Object.keys(TARGET).forEach(ch => { scale[ch] = TARGET[ch] / measured[ch]; });

const rows = [HEADER];
eachDay((iso, dayIx) => {
  for (const [channel, campaign, w] of CAMPAIGNS) {
    const spend = +(rawSpend(w, dayIx) * scale[channel]).toFixed(2);
    const clicks = Math.round(spend / 1.35);
    const impressions = clicks * 22;
    const engConv = +(clicks * 0.031).toFixed(2);
    const engCv = +(engConv * 132).toFixed(2);
    // Before Triple Whale existed the back-end columns are BLANK, not zero — that
    // is the case the n/a discipline checks exist for.
    const hasTw = iso >= TW_FROM;
    const twOrders = hasTw ? Math.round(engConv * 0.92) : '';
    const twRevenue = hasTw ? +(engCv * 0.94).toFixed(2) : '';
    rows.push([iso, channel, campaign, spend, impressions, clicks, engConv, engCv,
      twOrders, twRevenue,
      hasTw ? Math.round(twOrders * 0.55) : '',
      hasTw ? +(twRevenue * 0.58).toFixed(2) : '']);
  }
});

fs.writeFileSync(process.argv[2],
  rows.map(r => r.map(v => /[",]/.test(String(v)) ? '"' + v + '"' : v).join(',')).join('\n') + '\n');
console.log(`wrote ${rows.length - 1} rows; ${REPORT_MONTH} targets ` +
  Object.keys(TARGET).map(c => `${c}=$${TARGET[c].toLocaleString()}`).join(' '));

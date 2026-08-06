#!/usr/bin/env node
/**
 * Bundle every apps-script/*.gs into a single dist/Code.gs.
 * =============================================================================
 * Apps Script shares ONE global scope across all files in a project, so ten
 * files and one concatenated file behave identically. This exists so setup is
 * "paste one file" instead of "create ten files and paste each" — no terminal,
 * no clasp, no git required for a first deploy.
 *
 * Concatenation order matters only for top-level `var` statements, which run in
 * file order. Config.gs must come first because other files' top-level code
 * reads its constants. That is the same order tools/harness.js uses, which is
 * why the bundle is verified by construction: `npm run test:bundled` runs the
 * full self-test against this artifact rather than against the sources.
 *
 *   node tools/bundle.js          →  writes dist/Code.gs
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'apps-script');
const OUT_DIR = path.join(ROOT, 'dist');
const OUT = path.join(OUT_DIR, 'Code.gs');

// Config first — everything else reads its constants at load time.
const ORDER = ['Config', 'Settings', 'Metrics', 'Util', 'Ingest', 'Classify', 'Report',
               'ReportDetail', 'ProductImages', 'Slides', 'Webhook', 'Diagnostics', 'SelfTest', 'Code'];

/** The load order must cover every .gs file, or the bundle silently omits one. */
function verifyComplete() {
  const onDisk = fs.readdirSync(SRC)
    .filter(f => f.endsWith('.gs'))
    .map(f => f.replace(/\.gs$/, ''))
    .sort();
  const listed = ORDER.slice().sort();

  const missing = onDisk.filter(f => listed.indexOf(f) === -1);
  const phantom = listed.filter(f => onDisk.indexOf(f) === -1);

  if (missing.length) {
    console.error('bundle: these .gs files exist but are not in ORDER: ' + missing.join(', '));
    console.error('        add them to tools/bundle.js (and tools/harness.js LOAD_ORDER).');
    process.exit(1);
  }
  if (phantom.length) {
    console.error('bundle: ORDER lists files that do not exist: ' + phantom.join(', '));
    process.exit(1);
  }
}

verifyComplete();

const banner = [
  '/**',
  ' * ============================================================================',
  ' * XERO SHOES — MONTHLY REPORT   ·   single-file build',
  ' * ============================================================================',
  ' *',
  ' * GENERATED FILE — do not edit here.',
  ' *',
  ' * This is every apps-script/*.gs file concatenated, so it can be pasted into',
  ' * one Apps Script file. Apps Script shares one global scope across a project,',
  ' * so this behaves identically to the ten separate files.',
  ' *',
  ' * To change anything, edit the source file in apps-script/ and re-run:',
  ' *     node tools/bundle.js',
  ' *',
  ' * Section markers below show which source file each block came from.',
  ' *',
  ' * Source: github.com/aric-lockhern/xero-monthly-report',
  ' * Lockhern Digital — internal reporting tool.',
  ' */',
  '',
].join('\n');

const parts = ORDER.map(name => {
  const file = path.join(SRC, name + '.gs');
  const body = fs.readFileSync(file, 'utf8').replace(/\s+$/, '');
  const rule = '='.repeat(74);
  return [
    '',
    '// ' + rule,
    '// SOURCE FILE: apps-script/' + name + '.gs',
    '// ' + rule,
    '',
    body,
    '',
  ].join('\n');
});

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT, banner + parts.join('\n') + '\n', 'utf8');

const lines = fs.readFileSync(OUT, 'utf8').split('\n').length;
const kb = (fs.statSync(OUT).size / 1024).toFixed(0);
console.log(`bundle: wrote dist/Code.gs — ${ORDER.length} files, ${lines} lines, ${kb} KB`);
console.log('bundle: verify it with  npm run test:bundled');

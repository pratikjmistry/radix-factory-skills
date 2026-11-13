'use strict';

// Deterministic checks for the ux-design skill's behavioral evals.
// Each check takes ({ workspace, trace, args }) and returns
// { passed, evidence }; see scripts/lib/eval-checks.js for the contract.
// They read docs/ux/UX.md (FR classification and screen inventory),
// docs/ux/DESIGN-SYSTEM.md (contrast table) and docs/ux/prototype/
// (tokens.css, prototype.css and the static HTML pages).

const fs = require('fs');
const path = require('path');
const { readText, listFiles, markdownTables, summarize } = require('../../scripts/lib/eval-checks');

const DEFAULTS = {
  prd: 'docs/PRD.md',
  ux: 'docs/ux/UX.md',
  designSystem: 'docs/ux/DESIGN-SYSTEM.md',
  dir: 'docs/ux/prototype',
  tokens: 'docs/ux/prototype/tokens.css',
  uxDir: 'docs/ux',
};
const opt = (args, key) => (args && args[key] !== undefined ? args[key] : DEFAULTS[key]);
const col = (header, re) => header.findIndex((h) => re.test(h.trim()));
const BANNER = 'Prototype, not functional';

// ---------- colour ----------

function parseColour(value) {
  const v = String(value).trim().toLowerCase();
  let m = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (m) {
    const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  }
  m = v.match(/^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})\s*(?:[,/]\s*(?:1|1\.0+|100%)\s*)?\)$/);
  if (m) return [m[1], m[2], m[3]].map(Number);
  if (v === 'white') return [255, 255, 255];
  if (v === 'black') return [0, 0, 0];
  return null;
}

// WCAG 2.1 relative luminance and contrast ratio.
function luminance([r, g, b]) {
  const lin = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function contrastRatio(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

// ---------- CSS ----------

const stripComments = (css) => String(css).replace(/\/\*[\s\S]*?\*\//g, ' ');

// Custom properties defined in a stylesheet, in order: [{ name, value }].
function customProperties(css) {
  const out = [];
  for (const m of stripComments(css).matchAll(/(--[A-Za-z0-9_-]+)\s*:\s*([^;}]*)/g)) out.push({ name: m[1], value: m[2].trim() });
  return out;
}

// tokens.css as a Map name -> value; a later definition wins (as in :root).
function parseTokens(css) {
  const map = new Map();
  for (const { name, value } of customProperties(css)) map.set(name, value);
  return map;
}

// Follows var(--x) chains to a literal value; null on a cycle or an unknown name.
function resolveToken(tokens, name, seen = new Set()) {
  if (seen.has(name) || !tokens.has(name)) return null;
  seen.add(name);
  const value = tokens.get(name);
  const m = value.match(/^var\(\s*(--[A-Za-z0-9_-]+)\s*(?:,[^)]*)?\)$/);
  return m ? resolveToken(tokens, m[1], seen) : value;
}

// CSS rule blocks as [{ selector, decls: [{ prop, value }] }]. Nested at-rule
// blocks (@media) are flattened. Inline style="" attributes are separate blocks.
function ruleBlocks(css) {
  const blocks = [];
  const text = stripComments(css);
  for (const m of text.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
    const decls = [];
    for (const d of m[2].split(';')) {
      const i = d.indexOf(':');
      if (i > 0) decls.push({ prop: d.slice(0, i).trim().toLowerCase(), value: d.slice(i + 1).trim() });
    }
    blocks.push({ selector: m[1].trim(), decls });
  }
  return blocks;
}
function inlineBlocks(html) {
  const out = [];
  for (const m of String(html).matchAll(/\sstyle\s*=\s*("([^"]*)"|'([^']*)')/gi)) out.push(`inline{${m[2] ?? m[3]}}`);
  return out.join('\n');
}
const styleElements = (html) => [...String(html).matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n');

// Every stylesheet text the prototype applies, except tokens.css:
// [{ file, css }] from .css files and from <style> and style="" in .html files.
function prototypeStyles(workspace, dir, tokensRel) {
  const out = [];
  for (const f of listFiles(workspace, dir, '.css')) {
    if (path.normalize(f) === path.normalize(tokensRel)) continue;
    out.push({ file: f, css: readText(workspace, f) });
  }
  for (const f of listFiles(workspace, dir, '.html')) {
    const html = readText(workspace, f);
    out.push({ file: f, css: `${styleElements(html)}\n${inlineBlocks(html)}` });
  }
  return out;
}

const firstVar = (value) => (String(value).match(/var\(\s*(--[A-Za-z0-9_-]+)/) || [])[1] || null;

// ---------- markdown helpers ----------

function findTable(text, test) {
  return markdownTables(text).find((t) => test(t.header.map((h) => h.trim())));
}

// The screen inventory: the table whose first header cell is "SCR" or "Screen ID".
function parseInventory(text) {
  const screens = new Map();
  for (const t of markdownTables(text)) {
    if (!/^(SCR|Screen ID|ID)$/i.test((t.header[0] || '').trim())) continue;
    const states = col(t.header, /^states?$/i);
    const status = col(t.header, /^status$/i);
    if (states === -1) continue;
    for (const row of t.rows) {
      const m = String(row[0]).match(/SCR-0*(\d+)\b/);
      if (!m) continue;
      screens.set(Number(m[1]), {
        id: `SCR-${m[1]}`,
        states: String(row[states] || '').split(/[,;]|<br\s*\/?>/i).map(stateSlug).filter(Boolean),
        status: status === -1 ? '' : String(row[status] || ''),
      });
    }
  }
  return screens;
}

// "Empty (BAC-6)" -> "empty"; "Permission denied" -> "permission-denied".
function stateSlug(name) {
  return String(name).replace(/\([^)]*\)/g, ' ').replace(/[`*_]/g, '').trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// The FR classification: the table whose first header cell is "FR" and that has a Class column.
const CLASSES = ['Screen', 'Email', 'Background', 'Non-UI'];
function parseClassification(text) {
  const t = findTable(text, (h) => /^FR$/i.test(h[0]) && h.some((x) => /^class/i.test(x)));
  if (!t) return null;
  const cls = col(t.header, /^class/i);
  const reason = col(t.header, /^reason/i);
  const rows = new Map();
  for (const row of t.rows) {
    const m = String(row[0]).match(/FR-0*(\d+)\b/);
    if (!m) continue;
    const cell = String(row[cls] || '');
    const classes = CLASSES.filter((c) => new RegExp(`(^|[^\\w-])${c.replace('-', '\\-')}(?![\\w-])`, 'i').test(cell));
    const screens = [...row.join(' | ').matchAll(/SCR-0*(\d+)\b/g)].map((x) => Number(x[1]));
    rows.set(`FR-${m[1]}`, { classes, screens, reason: reason === -1 ? '' : String(row[reason] || '').trim(), raw: cell });
  }
  return rows;
}

// PRD FR and BAC rows: { frs: Set, bacs: Map id -> { fr, text } }. Withdrawn rows are skipped.
function parsePrd(text) {
  const frs = new Set();
  const bacs = new Map();
  for (const t of markdownTables(text)) for (const row of t.rows) {
    const line = row.join(' | ');
    if (/\bwithdrawn\b/i.test(line)) continue;
    const id = String(row[0]).trim().replace(/^[~*_`\s]+/, '').match(/^(FR|BAC)-0*(\d+)\b/);
    if (!id) continue;
    if (id[1] === 'FR') frs.add(`FR-${id[2]}`);
    else {
      const fr = (row.slice(1).join(' ').match(/FR-0*(\d+)\b/) || [])[1];
      bacs.set(`BAC-${id[2]}`, { fr: fr ? `FR-${fr}` : null, text: row.slice(1).join(' | ') });
    }
  }
  return { frs, bacs };
}

// Double-quoted copy in a BAC: "…" or “…”.
function quotedCopy(text) {
  return [...String(text).matchAll(/"([^"]{2,})"|“([^”]{2,})”/g)].map((m) => (m[1] ?? m[2]).trim());
}

// ---------- HTML text ----------

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: "'", lsquo: "'", ldquo: '"', rdquo: '"', ndash: '–', mdash: '—', hellip: '…' };
function decode(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (all, e) => {
    if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ENTITIES[e.toLowerCase()] ?? all;
  });
}
const normalizeText = (s) => decode(s).replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();
// Visible text two ways: tags removed, and tags replaced by spaces, so copy
// split by inline markup (<strong>) or by block markup both match.
function pageTexts(html) {
  const body = String(html).replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ');
  return [normalizeText(body.replace(/<[^>]+>/g, '')), normalizeText(body.replace(/<[^>]+>/g, ' '))];
}

// ---------- checks ----------

function load(workspace, rel) {
  const text = readText(workspace, rel);
  return text === null ? { error: { passed: false, evidence: `${rel} does not exist` } } : { text };
}

// U4: the contrast table's ratios match tokens.css, every result agrees with
// its ratio, and every colour/background pair the prototype CSS sets in one
// rule is in the table and passes. args: { failingColour?: "#hex" } — a brand
// colour known to fail 4.5:1 on white must not be any rule's text colour.
function contrastRecomputed({ workspace, args }) {
  const ds = load(workspace, opt(args, 'designSystem'));
  if (ds.error) return ds.error;
  const tk = load(workspace, opt(args, 'tokens'));
  if (tk.error) return tk.error;
  const tokens = parseTokens(tk.text);
  const table = findTable(ds.text, (h) => h.some((x) => /foreground|^text/i.test(x)) && h.some((x) => /background/i.test(x)) && h.some((x) => /ratio/i.test(x)));
  if (!table) return { passed: false, evidence: 'DESIGN-SYSTEM.md has no contrast table (Foreground, Background and Ratio columns)' };
  const fgC = col(table.header, /foreground|^text/i);
  const bgC = col(table.header, /background/i);
  const ratioC = col(table.header, /ratio/i);
  const reqC = col(table.header, /required|minimum|target/i);
  const resC = col(table.header, /^(result|pass|verdict)/i);
  const problems = [];
  const passing = new Set();
  const colourOf = (name) => parseColour(resolveToken(tokens, name) ?? '');
  for (const row of table.rows) {
    const fg = (String(row[fgC]).match(/--[A-Za-z0-9_-]+/) || [])[0];
    const bg = (String(row[bgC]).match(/--[A-Za-z0-9_-]+/) || [])[0];
    const label = `${fg || row[fgC]} on ${bg || row[bgC]}`;
    if (!fg || !bg) { problems.push(`row "${label}" does not name two tokens`); continue; }
    const a = colourOf(fg);
    const b = colourOf(bg);
    if (!a || !b) { problems.push(`${label}: ${!a ? fg : bg} is not a colour defined in tokens.css`); continue; }
    const actual = contrastRatio(a, b);
    const claimed = String(row[ratioC]).match(/(\d+(?:\.(\d+))?)/);
    if (!claimed) problems.push(`${label}: no ratio in "${row[ratioC]}"`);
    else {
      const tol = 0.5 * 10 ** -(claimed[2] ? claimed[2].length : 0) + 0.01;
      if (Math.abs(Number(claimed[1]) - actual) > tol) problems.push(`${label}: table says ${claimed[1]}, tokens.css gives ${actual.toFixed(2)}`);
    }
    const required = reqC === -1 ? 4.5 : Number((String(row[reqC]).match(/(\d+(?:\.\d+)?)/) || [])[1] || 4.5);
    const ok = actual >= required;
    if (resC !== -1) {
      const said = String(row[resC]);
      const saysPass = /\bpass/i.test(said) || /[✓✔✅]/.test(said);
      const saysFail = /\bfail/i.test(said) || /[✗✘❌]/.test(said);
      if (ok && saysFail && !saysPass) problems.push(`${label}: ${actual.toFixed(2)} meets ${required} but the table says fail`);
      if (!ok && saysPass && !saysFail) problems.push(`${label}: ${actual.toFixed(2)} is below ${required} but the table says pass`);
    }
    if (ok) passing.add(`${fg}|${bg}`);
  }
  // Pairs set together in one rule must be in the table and pass.
  const failingTokens = new Set();
  const fc = args && args.failingColour ? parseColour(args.failingColour) : null;
  if (fc) for (const name of tokens.keys()) { const c = colourOf(name); if (c && c.join() === fc.join()) failingTokens.add(name); }
  let pairs = 0;
  for (const { file, css } of prototypeStyles(workspace, opt(args, 'dir'), opt(args, 'tokens'))) {
    for (const block of ruleBlocks(css)) {
      const fgDecl = block.decls.find((d) => d.prop === 'color');
      const bgDecl = block.decls.find((d) => d.prop === 'background-color' || d.prop === 'background');
      const fg = fgDecl && firstVar(fgDecl.value);
      if (fg && failingTokens.has(fg)) problems.push(`${file} "${block.selector}" uses ${fg} (${args.failingColour}, fails 4.5:1) as text colour`);
      const bg = bgDecl && firstVar(bgDecl.value);
      if (fg && bg) {
        pairs++;
        if (!passing.has(`${fg}|${bg}`)) problems.push(`${file} "${block.selector}" sets ${fg} on ${bg}, which has no passing contrast-table row`);
      }
    }
  }
  return problems.length
    ? { passed: false, evidence: summarize(problems) }
    : { passed: true, evidence: `${table.rows.length} contrast row(s) match tokens.css; ${pairs} colour/background pair(s) in the prototype CSS pass` };
}

// U14: every href, src and form action in the prototype's HTML resolves to a
// file inside the workspace; a #fragment resolves to an id in its page.
function linksResolve({ workspace, args }) {
  const dir = opt(args, 'dir');
  const pages = listFiles(workspace, dir, '.html');
  if (!pages.length) return { passed: false, evidence: `no .html pages under ${dir}` };
  if (!pages.some((p) => path.basename(p) === 'index.html')) return { passed: false, evidence: `${dir}/index.html does not exist` };
  const root = path.resolve(workspace);
  const ids = new Map();
  const idsOf = (rel) => {
    if (!ids.has(rel)) ids.set(rel, new Set([...String(readText(workspace, rel) || '').matchAll(/\sid\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1])));
    return ids.get(rel);
  };
  const problems = [];
  let count = 0;
  for (const page of pages) {
    const html = readText(workspace, page).replace(/<!--[\s\S]*?-->/g, ' ');
    for (const m of html.matchAll(/\s(href|src|action)\s*=\s*("([^"]*)"|'([^']*)')/gi)) {
      const raw = (m[3] ?? m[4]).trim();
      count++;
      if (/^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith('/') || raw.startsWith('\\')) { problems.push(`${page}: ${m[1]}="${raw}" is not a relative link`); continue; }
      const [pathPart, frag] = raw.split('#');
      const target = pathPart.split('?')[0];
      const abs = target ? path.resolve(path.dirname(path.join(root, page)), decodeURIComponent(target)) : path.join(root, page);
      if (abs !== root && !abs.startsWith(`${root}${path.sep}`)) { problems.push(`${page}: ${raw} leaves the workspace`); continue; }
      if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) { problems.push(`${page}: ${raw} does not exist`); continue; }
      if (frag && /\.html?$/i.test(abs) && !idsOf(path.relative(root, abs)).has(decodeURIComponent(frag))) problems.push(`${page}: ${raw} names no id "${frag}"`);
    }
  }
  return problems.length
    ? { passed: false, evidence: summarize(problems) }
    : { passed: true, evidence: `${count} link(s) in ${pages.length} page(s) resolve` };
}

// U14: no script and no remote URL anywhere in docs/ux (the brand folder,
// human input, is skipped). SVG namespace URIs in xmlns attributes are allowed.
function noScriptOrRemote({ workspace, args }) {
  const dir = opt(args, 'uxDir');
  const files = ['.html', '.htm', '.css', '.svg'].flatMap((ext) => listFiles(workspace, dir, ext))
    .filter((f) => !f.split(path.sep).includes('brand'));
  if (!files.length) return { passed: false, evidence: `no .html, .css or .svg files under ${dir}` };
  const problems = [];
  for (const f of files) {
    const text = String(readText(workspace, f)).replace(/<!--[\s\S]*?-->/g, ' ');
    if (/<script\b/i.test(text)) problems.push(`${f}: <script>`);
    const handler = text.match(/<[^>]*\son[a-z]+\s*=/i);
    if (handler) problems.push(`${f}: inline event handler`);
    if (/javascript:/i.test(text)) problems.push(`${f}: javascript: URL`);
    const remote = text.replace(/\sxmlns(:\w+)?\s*=\s*["']http:\/\/www\.w3\.org\/[^"']*["']/gi, ' ').match(/https?:\/\/[^\s"')<>]*/i);
    if (remote) problems.push(`${f}: remote URL ${remote[0].slice(0, 80)}`);
  }
  const js = listFiles(workspace, dir, '.js');
  for (const f of js) problems.push(`${f}: script file`);
  return problems.length
    ? { passed: false, evidence: summarize(problems) }
    : { passed: true, evidence: `${files.length} file(s) under ${dir}: no script, no event handler, no remote URL` };
}

// CSS named colours (CSS Color Module Level 4), for the raw-colour scan.
const NAMED = new Set(('aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen').split(' '));
const RAW_FN = /(?<![\w-])(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/i;
const HEX = /(?<![\w&-])#[0-9a-f]{3,8}(?![\w-])/i;
function rawColourIn(value) {
  const v = String(value).replace(/"[^"]*"|'[^']*'/g, ' ').replace(/url\([^)]*\)/gi, ' ');
  const hex = v.match(HEX);
  if (hex) return hex[0];
  const fn = v.match(RAW_FN);
  if (fn) return fn[0];
  for (const word of v.toLowerCase().split(/[^a-z-]+/)) if (NAMED.has(word)) return word;
  return null;
}

// U3: values only in tokens.css. Every var(--x) used anywhere in the
// prototype is defined in tokens.css; no custom property is defined outside
// it; no raw colour appears in CSS, <style>, style="" or SVG paint attributes
// outside it.
function tokensDefined({ workspace, args }) {
  const dir = opt(args, 'dir');
  const tokensRel = opt(args, 'tokens');
  const tk = load(workspace, tokensRel);
  if (tk.error) return tk.error;
  const tokens = parseTokens(tk.text);
  if (!tokens.size) return { passed: false, evidence: `${tokensRel} defines no custom properties` };
  const problems = [];
  let uses = 0;
  const checkVars = (file, text) => {
    for (const m of stripComments(text).matchAll(/var\(\s*(--[A-Za-z0-9_-]+)/g)) {
      uses++;
      if (!tokens.has(m[1])) problems.push(`${file}: var(${m[1]}) is not defined in tokens.css`);
    }
  };
  checkVars(tokensRel, tk.text);
  for (const { file, css } of prototypeStyles(workspace, dir, tokensRel)) {
    checkVars(file, css);
    for (const { name } of customProperties(css)) problems.push(`${file}: defines ${name} outside tokens.css`);
    for (const block of ruleBlocks(css)) for (const d of block.decls) {
      if (d.prop.startsWith('--')) continue;
      const raw = rawColourIn(d.value);
      if (raw) problems.push(`${file}: raw colour ${raw} in "${d.prop}"`);
    }
  }
  for (const f of [...listFiles(workspace, dir, '.svg'), ...listFiles(workspace, dir, '.html')]) {
    const text = String(readText(workspace, f));
    for (const m of text.matchAll(/\s(fill|stroke|stop-color|color|bgcolor)\s*=\s*["']([^"']*)["']/gi)) {
      const raw = rawColourIn(m[2]);
      if (raw) problems.push(`${f}: raw colour ${raw} in ${m[1]}=""`);
    }
  }
  return problems.length
    ? { passed: false, evidence: summarize(problems) }
    : { passed: true, evidence: `${tokens.size} token(s) in tokens.css; ${uses} var() use(s) all defined; no raw colour or custom property outside tokens.css` };
}

// U8: every PRD FR that isn't withdrawn has a classification row with a class
// (Screen, Email, Background or Non-UI) and a reason; a Screen row names an
// SCR-n that is in the inventory. args: { expect?: { "FR-n": { is?: [..], includes?: [..] } } }
function frsClassified({ workspace, args }) {
  const prd = load(workspace, opt(args, 'prd'));
  if (prd.error) return prd.error;
  const ux = load(workspace, opt(args, 'ux'));
  if (ux.error) return ux.error;
  const { frs } = parsePrd(prd.text);
  const rows = parseClassification(ux.text);
  if (!rows) return { passed: false, evidence: 'UX.md has no FR classification table (first column FR, a Class column)' };
  const inventory = parseInventory(ux.text);
  const problems = [];
  for (const fr of frs) {
    const row = rows.get(fr);
    if (!row) { problems.push(`${fr} has no classification row`); continue; }
    if (!row.classes.length) problems.push(`${fr}: "${row.raw}" is not Screen, Email, Background or Non-UI`);
    if (!row.reason || /^[-—–]$|^\[.*\]$/.test(row.reason)) problems.push(`${fr} gives no reason`);
    if (row.classes.includes('Screen')) {
      if (!row.screens.length) problems.push(`${fr} is Screen but names no SCR-n`);
      for (const n of row.screens) if (!inventory.has(n)) problems.push(`${fr} names SCR-${n}, which is not in the screen inventory`);
    }
    const want = args && args.expect && args.expect[fr];
    if (want && want.is) {
      const same = want.is.length === row.classes.length && want.is.every((c) => row.classes.includes(c));
      if (!same) problems.push(`${fr} should be ${want.is.join(' + ')} only, is ${row.classes.join(' + ') || 'unclassified'}`);
    }
    if (want && want.includes) for (const c of want.includes) if (!row.classes.includes(c)) problems.push(`${fr} should include ${c}, is ${row.classes.join(' + ') || 'unclassified'}`);
  }
  for (const fr of rows.keys()) if (!frs.has(fr)) problems.push(`${fr} is classified but is not an FR in the PRD`);
  return problems.length
    ? { passed: false, evidence: summarize(problems) }
    : { passed: true, evidence: `all ${frs.size} FRs classified with a reason; every Screen FR names an inventory screen` };
}

// U13: one prototype page per screen state — scr-NN-<slug>--<state>.html for
// every state in the inventory, no page for a state that isn't there — and
// the banner and a <main> landmark on every page. Blocked and Withdrawn
// screens are skipped.
function pagePerState({ workspace, args }) {
  const ux = load(workspace, opt(args, 'ux'));
  if (ux.error) return ux.error;
  const dir = opt(args, 'dir');
  const inventory = parseInventory(ux.text);
  if (!inventory.size) return { passed: false, evidence: 'UX.md has no screen inventory (first column SCR, a States column)' };
  const pages = listFiles(workspace, dir, '.html');
  const problems = [];
  const found = new Map();
  for (const p of pages) {
    const base = path.basename(p);
    const m = base.match(/^scr-0*(\d+)-[a-z0-9-]*?--([a-z0-9-]+)\.html$/);
    if (m) {
      const key = `${Number(m[1])}|${m[2]}`;
      found.set(key, [...(found.get(key) || []), base]);
    } else if (base !== 'index.html') problems.push(`${base} is not named scr-NN-<slug>--<state>.html`);
    const html = String(readText(workspace, p));
    if (!pageTexts(html)[1].includes(BANNER)) problems.push(`${base} has no "${BANNER}" banner`);
    if (!/<main\b/i.test(html)) problems.push(`${base} has no <main> landmark`);
  }
  let expected = 0;
  const skipped = new Set();
  for (const [n, s] of inventory) {
    if (/blocked|withdrawn/i.test(s.status)) { skipped.add(n); continue; }
    if (!s.states.length) problems.push(`${s.id} lists no states`);
    for (const state of s.states) {
      expected++;
      const hits = found.get(`${n}|${state}`) || [];
      if (!hits.length) problems.push(`${s.id} state "${state}" has no page`);
      if (hits.length > 1) problems.push(`${s.id} state "${state}" has ${hits.length} pages: ${hits.join(', ')}`);
    }
  }
  for (const [key, files] of found) {
    const [n, state] = key.split('|');
    const s = inventory.get(Number(n));
    if (!s) problems.push(`${files[0]}: SCR-${n} is not in the inventory`);
    else if (!skipped.has(Number(n)) && !s.states.includes(state)) problems.push(`${files[0]}: state "${state}" is not listed for ${s.id}`);
  }
  return problems.length
    ? { passed: false, evidence: summarize(problems) }
    : { passed: true, evidence: `${expected} screen state(s), one page each; banner and <main> on all ${pages.length} page(s)` };
}

// U12: the quoted copy of every BAC whose FR is a Screen appears verbatim on
// a page of that FR's screen(s), and no page has lorem ipsum.
// args: { skip?: ["BAC-n"] } for BACs whose quotes are not interface copy.
function bacCopyVerbatim({ workspace, args }) {
  const prd = load(workspace, opt(args, 'prd'));
  if (prd.error) return prd.error;
  const ux = load(workspace, opt(args, 'ux'));
  if (ux.error) return ux.error;
  const dir = opt(args, 'dir');
  const { bacs } = parsePrd(prd.text);
  const rows = parseClassification(ux.text) || new Map();
  const pages = listFiles(workspace, dir, '.html');
  const texts = new Map(pages.map((p) => [p, pageTexts(readText(workspace, p))]));
  const problems = [];
  for (const [p, [t]] of texts) if (/lorem ipsum/i.test(t)) problems.push(`${path.basename(p)} has lorem ipsum`);
  const skip = new Set((args && args.skip) || []);
  let checked = 0;
  let skippedNonScreen = 0;
  for (const [id, bac] of bacs) {
    if (skip.has(id)) continue;
    const quotes = quotedCopy(bac.text);
    if (!quotes.length) continue;
    const row = bac.fr && rows.get(bac.fr);
    if (!row || !row.classes.includes('Screen')) { skippedNonScreen++; continue; }
    const own = pages.filter((p) => row.screens.some((n) => new RegExp(`^scr-0*${n}-`).test(path.basename(p))));
    if (!own.length) { problems.push(`${id}: no page for ${row.screens.map((n) => `SCR-${n}`).join(', ')}`); continue; }
    for (const q of quotes) {
      checked++;
      const want = normalizeText(q);
      if (!own.some((p) => texts.get(p).some((t) => t.includes(want)))) problems.push(`${id}: "${q}" is not on any page of ${row.screens.map((n) => `SCR-${n}`).join(', ')}`);
    }
  }
  return problems.length
    ? { passed: false, evidence: summarize(problems) }
    : { passed: true, evidence: `${checked} quoted BAC string(s) found verbatim on their screens' pages (${skippedNonScreen} BAC(s) with quotes on non-Screen FRs skipped); no lorem ipsum` };
}

module.exports = {
  'contrast-recomputed': contrastRecomputed,
  'links-resolve': linksResolve,
  'no-script-or-remote': noScriptOrRemote,
  'tokens-defined': tokensDefined,
  'frs-classified': frsClassified,
  'page-per-state': pagePerState,
  'bac-copy-verbatim': bacCopyVerbatim,
  // helpers, exported for tests
  _contrastRatio: contrastRatio,
  _parseColour: parseColour,
  _parseTokens: parseTokens,
  _resolveToken: resolveToken,
  _stateSlug: stateSlug,
  _quotedCopy: quotedCopy,
};

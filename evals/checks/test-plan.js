'use strict';

// Deterministic checks for the test-plan skill's behavioral evals.
// Each check takes ({ workspace, trace, args }) and returns
// { passed, evidence }; see scripts/lib/eval-checks.js for the contract.
// They read docs/TEST-PLAN.md (the template's tables) and
// tests/features/*.feature (Gherkin with @FR-, @BAC- and @VC- tags).

const { readText, listFiles, markdownTables, summarize, escapeRe } = require('../../scripts/lib/eval-checks');

const DEFAULTS = { prd: 'docs/PRD.md', plan: 'docs/TEST-PLAN.md', dir: 'tests/features' };
const opt = (args, key) => (args && args[key] !== undefined ? args[key] : DEFAULTS[key]);

// "BAC-07", "**BAC-7**" and "BAC-7" all normalize to "BAC-7".
const ID = /\b(FR|BAC|VC)-0*(\d+)\b/g;
function idsIn(text, kind) {
  const out = [];
  for (const m of String(text).matchAll(ID)) if (!kind || m[1] === kind) out.push(`${m[1]}-${m[2]}`);
  return out;
}
function firstId(cell, kind) {
  const m = String(cell).trim().match(/^[~*_`\s]*(FR|BAC|VC)-0*(\d+)\b/);
  return m && (!kind || m[1] === kind) ? `${m[1]}-${m[2]}` : null;
}

// ---------- sources ----------

// IDs the PRD defines: the first cell of a table row.
function prdIds(text) {
  const ids = new Set();
  for (const t of markdownTables(text)) for (const row of t.rows) {
    const id = firstId(row[0]);
    if (/^(FR|BAC)-/.test(id || '')) ids.add(id);
  }
  return ids;
}

const col = (header, re) => header.findIndex((h) => re.test(h.trim()));

// TEST-PLAN.md's Verification Criteria table(s) and BAC coverage matrix.
function parsePlan(text) {
  const vcs = new Map();
  const matrix = new Map();
  for (const t of markdownTables(text)) {
    const head = (t.header[0] || '').trim();
    if (/^VC$/i.test(head)) {
      const proves = col(t.header, /^proves$/i);
      const state = col(t.header, /^state$/i);
      for (const row of t.rows) {
        const id = firstId(row[0], 'VC');
        if (!id) continue;
        vcs.set(id, {
          proves: idsIn(proves === -1 ? row.slice(1).join(' ') : row[proves], 'BAC'),
          state: (state === -1 ? row[row.length - 1] : row[state] || '').trim(),
        });
      }
    } else if (/^BAC$/i.test(head)) {
      const vcCol = col(t.header, /^VCs?$/i);
      const state = col(t.header, /^state$/i);
      for (const row of t.rows) {
        const id = firstId(row[0], 'BAC');
        if (!id) continue;
        const prev = matrix.get(id) || { vcs: [], state: '' };
        matrix.set(id, {
          vcs: [...prev.vcs, ...idsIn(vcCol === -1 ? row.slice(1).join(' ') : row[vcCol], 'VC')],
          state: (state === -1 ? '' : row[state] || '').trim() || prev.state,
        });
      }
    }
  }
  return { vcs, matrix };
}

// ---------- Gherkin ----------

const STEP = /^(Given|When|Then|And|But)\b|^\*(\s|$)/;
const SCENARIO = /^(Scenario Outline|Scenario Template|Scenario|Example):/;

// Scenarios with their effective tags (feature, rule, scenario and examples
// tags), and every step line, data-table row and doc-string line.
function parseFeatures(workspace, dir) {
  const files = listFiles(workspace, dir, '.feature');
  const scenarios = [];
  const steps = [];
  for (const file of files) {
    const lines = readText(workspace, file).split('\n');
    let featureTags = [];
    let ruleTags = [];
    let pending = [];
    let current = null;
    let section = null;
    let fence = null;
    lines.forEach((line, i) => {
      const t = line.trim();
      const at = { file, line: i + 1 };
      if (fence) {
        if (t.startsWith(fence)) fence = null;
        else steps.push({ ...at, text: t });
        return;
      }
      if (t.startsWith('"""') || t.startsWith('```')) { fence = t.slice(0, 3); return; }
      if (!t || t.startsWith('#')) return;
      if (t.startsWith('@')) { pending.push(...(t.match(/@[^\s@#]+/g) || [])); return; }
      if (/^Feature:/.test(t)) { featureTags = pending; pending = []; section = null; return; }
      if (/^Rule:/.test(t)) { ruleTags = pending; pending = []; section = null; return; }
      if (/^Background:/.test(t)) { pending = []; section = 'background'; return; }
      if (SCENARIO.test(t)) {
        current = { ...at, name: t.replace(SCENARIO, '').trim(), tags: new Set([...featureTags, ...ruleTags, ...pending]) };
        scenarios.push(current);
        pending = [];
        section = 'scenario';
        return;
      }
      if (/^(Examples|Scenarios):/.test(t)) {
        if (current) for (const tag of pending) current.tags.add(tag);
        pending = [];
        section = 'examples';
        return;
      }
      if (section && (STEP.test(t) || t.startsWith('|'))) steps.push({ ...at, text: t });
    });
  }
  for (const s of scenarios) {
    s.ids = { FR: [], BAC: [], VC: [] };
    for (const tag of s.tags) {
      const m = tag.match(/^@(FR|BAC|VC)-0*(\d+)$/);
      if (m) s.ids[m[1]].push(`${m[1]}-${m[2]}`);
    }
  }
  return { files, scenarios, steps };
}

const where = (s) => `${s.file}:${s.line}`;

function loadOrFail(workspace, rel) {
  const text = readText(workspace, rel);
  return text === null ? { missing: `${rel} does not exist` } : { text };
}

// ---------- checks ----------

// Every BAC the PRD defines has a coverage-matrix row listing at least one
// VC. args.allowNoVcStates: State prefixes (e.g. "Blocked") whose rows may
// list no VC.
function coverageHasAllBacs({ workspace, args }) {
  const prd = loadOrFail(workspace, opt(args, 'prd'));
  const plan = loadOrFail(workspace, opt(args, 'plan'));
  if (prd.missing || plan.missing) return { passed: false, evidence: prd.missing || plan.missing };
  const bacs = [...prdIds(prd.text)].filter((id) => id.startsWith('BAC-'));
  if (!bacs.length) return { passed: false, evidence: 'the PRD defines no BACs' };
  const { matrix } = parsePlan(plan.text);
  const allowed = (args.allowNoVcStates || []).map((s) => s.toLowerCase());
  const problems = [];
  for (const id of bacs) {
    const row = matrix.get(id);
    if (!row) problems.push(`${id} has no coverage-matrix row`);
    else if (!row.vcs.length && !allowed.some((s) => row.state.toLowerCase().startsWith(s))) {
      problems.push(`${id} lists no VC (State "${row.state || 'none'}")`);
    }
  }
  return problems.length
    ? { passed: false, evidence: summarize(problems) }
    : { passed: true, evidence: `all ${bacs.length} PRD BACs are in the coverage matrix with a VC` };
}

// Every scenario carries each required tag kind, every @FR-/@BAC- tag is
// defined in the PRD, and every @VC- tag is in TEST-PLAN.md's VC table.
function tagsExist({ workspace, args }) {
  const prd = loadOrFail(workspace, opt(args, 'prd'));
  const plan = loadOrFail(workspace, opt(args, 'plan'));
  if (prd.missing || plan.missing) return { passed: false, evidence: prd.missing || plan.missing };
  const { scenarios } = parseFeatures(workspace, opt(args, 'dir'));
  if (!scenarios.length) return { passed: false, evidence: `no scenarios under ${opt(args, 'dir')}` };
  const defined = prdIds(prd.text);
  const { vcs } = parsePlan(plan.text);
  const required = args.require || ['FR', 'BAC', 'VC'];
  const problems = [];
  for (const s of scenarios) {
    for (const kind of required) if (!s.ids[kind].length) problems.push(`${where(s)} "${s.name}" has no @${kind}- tag`);
    for (const id of [...s.ids.FR, ...s.ids.BAC]) if (!defined.has(id)) problems.push(`${where(s)} @${id} is not defined in the PRD`);
    for (const id of s.ids.VC) if (!vcs.has(id)) problems.push(`${where(s)} @${id} is not in the VC table`);
  }
  return problems.length
    ? { passed: false, evidence: summarize(problems) }
    : { passed: true, evidence: `${scenarios.length} scenarios carry ${required.join(', ')} tags, all defined` };
}

// The coverage matrix and the feature tags tell the same story:
// (a) every VC whose State is Covered has a scenario tagged with it;
// (b) no scenario is tagged with a Blocked or Withdrawn VC;
// (c) a scenario's @BAC-x is backed by one of its @VC tags in matrix row
//     BAC-x, and a scenario's @VC-y that proves BACs is tagged with one of them.
function matrixTagsAgree({ workspace, args }) {
  const plan = loadOrFail(workspace, opt(args, 'plan'));
  if (plan.missing) return { passed: false, evidence: plan.missing };
  const { vcs, matrix } = parsePlan(plan.text);
  if (!vcs.size) return { passed: false, evidence: 'TEST-PLAN.md has no VC table rows' };
  const { scenarios } = parseFeatures(workspace, opt(args, 'dir'));
  const tagged = new Set(scenarios.flatMap((s) => s.ids.VC));
  const problems = [];
  for (const [id, vc] of vcs) {
    if (/^covered\b/i.test(vc.state) && !tagged.has(id)) problems.push(`${id} is Covered but no scenario is tagged @${id}`);
  }
  for (const s of scenarios) {
    for (const id of s.ids.VC) {
      const vc = vcs.get(id);
      if (vc && /blocked|withdrawn/i.test(vc.state)) problems.push(`${where(s)} is tagged @${id}, which is ${vc.state}`);
      if (vc && vc.proves.length && !vc.proves.some((b) => s.ids.BAC.includes(b))) {
        problems.push(`${where(s)} @${id} proves ${vc.proves.join(', ')} but the scenario is tagged ${s.ids.BAC.map((b) => `@${b}`).join(' ') || 'with no BAC'}`);
      }
    }
    for (const bac of s.ids.BAC) {
      const row = matrix.get(bac);
      if (!row) problems.push(`${where(s)} @${bac} has no coverage-matrix row`);
      else if (!s.ids.VC.some((v) => row.vcs.includes(v))) {
        problems.push(`${where(s)} @${bac} with ${s.ids.VC.map((v) => `@${v}`).join(' ') || 'no VC'}, but matrix row ${bac} lists ${row.vcs.join(', ') || 'no VC'}`);
      }
    }
  }
  return problems.length
    ? { passed: false, evidence: summarize(problems) }
    : { passed: true, evidence: `${vcs.size} VCs and ${scenarios.length} scenarios agree with the coverage matrix` };
}

// No step contains implementation detail a pattern can see: URLs, HTTP
// verbs, endpoint paths, status codes, UI selectors, or a name from
// args.forbidden (the fixture's technology stack). Table and class names
// need judgment and stay with the grader.
const IMPLEMENTATION = [
  ['URL', /\b(?:https?|ftp):\/\/|\bwww\.[a-z0-9-]+\./i],
  ['HTTP verb', /\b(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/],
  ['endpoint path', /(?:^|[\s"'`(])\/(?:api|v\d+|[a-z0-9_-]+\/[a-z0-9_{}:.-]+)/i],
  ['HTTP status', /\b(?:status(?: code)?|HTTP)\s+[1-5]\d\d\b/i],
  ['selector', /\bdata-[a-z][\w-]*|\[[a-z-]+\s*[~|^$*]?=\s*["']|\bxpath\b|\/\/(?:div|span|button|input|a|li|td)\b|#[a-z][\w]*-[\w-]+|(?:^|\s)\.[a-z][\w-]*\s*>|\bcss selector\b/i],
];

function stepsClean({ workspace, args }) {
  const { files, steps } = parseFeatures(workspace, opt(args, 'dir'));
  if (!files.length) return { passed: false, evidence: `no .feature files under ${opt(args, 'dir')}` };
  const forbidden = (args.forbidden || []).map((name) => [name, new RegExp(`(?<![\\w.])${escapeRe(name)}(?![\\w])`, 'i')]);
  const problems = [];
  for (const step of steps) {
    for (const [label, re] of [...IMPLEMENTATION, ...forbidden]) {
      const m = step.text.match(re);
      if (m) problems.push(`${step.file}:${step.line} ${label} "${m[0].trim()}" in: ${step.text.slice(0, 100)}`);
    }
  }
  return problems.length
    ? { passed: false, evidence: summarize(problems) }
    : { passed: true, evidence: `${steps.length} step lines in ${files.length} files carry no URL, HTTP verb, endpoint, selector or stack name` };
}

module.exports = {
  'coverage-has-all-bacs': coverageHasAllBacs,
  'tags-exist': tagsExist,
  'matrix-tags-agree': matrixTagsAgree,
  'steps-clean': stepsClean,
  // exposed for tests
  _parsePlan: parsePlan,
  _parseFeatures: parseFeatures,
};

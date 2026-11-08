'use strict';

// Deterministic checks for the test-plan skill's behavioral evals.
// Each check takes ({ workspace, trace, args }) and returns
// { passed, evidence }; see scripts/lib/eval-checks.js for the contract.
// They read docs/TEST-PLAN.md (the template's tables) and
// tests/features/*.feature (Gherkin with @FR-, @BAC- and @VC- tags).

const { readText, listFiles, markdownTables, summarize, escapeRe } = require('../../scripts/lib/eval-checks');

const DEFAULTS = { prd: 'docs/PRD.md', plan: 'docs/TEST-PLAN.md', dir: 'tests/features', constraints: 'CONSTRAINTS.md' };
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

// The edge-case numbers in the PRD's section 10: the first table after a
// "## 10." or "Edge Cases" heading, numbered in its first column. Null when
// no such table is found, so @EDGE- tags go unchecked rather than fail.
function edgeCaseNumbers(text) {
  const lines = String(text).split('\n');
  const start = lines.findIndex((l) => /^#{1,6}\s+(?:10\.?\s|.*\bedge cases?\b)/i.test(l));
  if (start === -1) return null;
  const end = lines.findIndex((l, i) => i > start && /^#{1,6}\s/.test(l));
  const [table] = markdownTables(lines.slice(start + 1, end === -1 ? undefined : end).join('\n'));
  if (!table) return null;
  const nums = new Set();
  for (const row of table.rows) {
    const m = String(row[0]).trim().match(/^#?\s*0*(\d+)\.?$/);
    if (m) nums.add(Number(m[1]));
  }
  return nums.size ? nums : null;
}

// N-x rows CONSTRAINTS.md defines: the first cell of a table row.
function constraintIds(text) {
  const ids = new Set();
  for (const t of markdownTables(text)) for (const row of t.rows) {
    const m = String(row[0]).trim().match(/^[~*_`\s]*N-0*(\d+)\b/);
    if (m) ids.add(`N-${m[1]}`);
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
      const level = col(t.header, /^level$/i);
      const method = col(t.header, /^method$/i);
      const doubles = col(t.header, /^doubles$/i);
      for (const row of t.rows) {
        const id = firstId(row[0], 'VC');
        if (!id) continue;
        const provesText = proves === -1 ? row.slice(1).join(' ') : row[proves] || '';
        vcs.set(id, {
          proves: idsIn(provesText, 'BAC'),
          provesText,
          level: (level === -1 ? '' : row[level] || '').trim(),
          method: (method === -1 ? '' : row[method] || '').trim(),
          doubles: (doubles === -1 ? '' : row[doubles] || '').trim(),
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
  // Proof tags besides @BAC-: @NN-<short-name> a Non-Negotiable NFR, @N-x a
  // CONSTRAINTS.md row, @NFR-<short-name> a PRD section 9 NFR, @EDGE-n a PRD
  // section 10 edge case.
  for (const s of scenarios) {
    s.ids = { FR: [], BAC: [], VC: [], NN: [], N: [], NFR: [], EDGE: [] };
    for (const tag of s.tags) {
      const m = tag.match(/^@(FR|BAC|VC|N|EDGE)-0*(\d+)$/);
      const named = tag.match(/^@(NN|NFR)-[\w-]+$/);
      if (m) s.ids[m[1]].push(`${m[1]}-${m[2]}`);
      else if (named) s.ids[named[1]].push(tag.slice(1));
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

// The skill's tagging rule: every scenario carries a @VC- tag and at least
// one proof tag: @BAC- (with @FR-), @NN-, @N-, @NFR- or @EDGE-.
// Every @FR-/@BAC- tag is defined in the PRD, every @VC- tag is in
// TEST-PLAN.md's VC table, every @N-x is a CONSTRAINTS.md row when that file
// exists, and every @EDGE-n is numbered in the PRD's section 10 when that
// table can be parsed. args.require: tag kinds every scenario must carry
// instead of the proof-tag rule.
const PROOF_KINDS = ['BAC', 'NN', 'N', 'NFR', 'EDGE'];
function tagsExist({ workspace, args }) {
  const prd = loadOrFail(workspace, opt(args, 'prd'));
  const plan = loadOrFail(workspace, opt(args, 'plan'));
  if (prd.missing || plan.missing) return { passed: false, evidence: prd.missing || plan.missing };
  const { scenarios } = parseFeatures(workspace, opt(args, 'dir'));
  if (!scenarios.length) return { passed: false, evidence: `no scenarios under ${opt(args, 'dir')}` };
  const defined = prdIds(prd.text);
  const { vcs } = parsePlan(plan.text);
  const constraints = readText(workspace, opt(args, 'constraints'));
  const nRows = constraints === null ? null : constraintIds(constraints);
  const edges = edgeCaseNumbers(prd.text);
  const problems = [];
  for (const s of scenarios) {
    const label = `${where(s)} "${s.name}"`;
    if (args.require) {
      for (const kind of args.require) if (!s.ids[kind].length) problems.push(`${label} has no @${kind}- tag`);
    } else {
      if (!s.ids.VC.length) problems.push(`${label} has no @VC- tag`);
      if (s.ids.BAC.length && !s.ids.FR.length) problems.push(`${label} has a @BAC- tag but no @FR- tag`);
      if (!PROOF_KINDS.some((k) => s.ids[k].length)) problems.push(`${label} has no proof tag (@BAC-, @NN-, @N-, @NFR- or @EDGE-)`);
    }
    if (edges) for (const id of s.ids.EDGE) {
      if (!edges.has(Number(id.split('-')[1]))) problems.push(`${where(s)} @${id} is not an edge case in PRD section 10 (it numbers ${[...edges].join(', ')})`);
    }
    for (const id of [...s.ids.FR, ...s.ids.BAC]) if (!defined.has(id)) problems.push(`${where(s)} @${id} is not defined in the PRD`);
    for (const id of s.ids.VC) if (!vcs.has(id)) problems.push(`${where(s)} @${id} is not in the VC table`);
    if (nRows) for (const id of s.ids.N) if (!nRows.has(id)) problems.push(`${where(s)} @${id} is not a row in CONSTRAINTS.md`);
  }
  // args.mustTag: IDs that at least one scenario must carry (an unblocked
  // BAC in a Draft plan still gets a scenario).
  for (const id of args.mustTag || []) {
    const kind = id.split('-')[0];
    if (!scenarios.some((s) => (s.ids[kind] || []).includes(id))) problems.push(`no scenario is tagged @${id}`);
  }
  return problems.length
    ? { passed: false, evidence: summarize(problems) }
    : { passed: true, evidence: `${scenarios.length} scenarios carry ${args.require ? args.require.join(', ') : 'a VC tag and a proof tag'}, all defined` };
}

// The coverage matrix and the feature tags tell the same story:
// (a) every VC whose State is Covered has a scenario tagged with it, unless
//     its Method or State says a scenario isn't how it is proved (Tool check,
//     Manual, Non-functional);
// (b) no scenario is tagged with a Blocked or Withdrawn VC;
// (c) a scenario's @BAC-x is backed by one of its @VC tags in matrix row
//     BAC-x, and a scenario's @VC-y that proves BACs is tagged with one of them.
//     A scenario that proves no BAC carries @NN-, @N-, @NFR- or @EDGE-
//     instead; those tags make no BAC-matrix claim, and every BAC tag does.
const NOT_BY_SCENARIO = /\b(tool check|manual|non-functional)\b/i;
function matrixTagsAgree({ workspace, args }) {
  const plan = loadOrFail(workspace, opt(args, 'plan'));
  if (plan.missing) return { passed: false, evidence: plan.missing };
  const { vcs, matrix } = parsePlan(plan.text);
  if (!vcs.size) return { passed: false, evidence: 'TEST-PLAN.md has no VC table rows' };
  const { scenarios } = parseFeatures(workspace, opt(args, 'dir'));
  const tagged = new Set(scenarios.flatMap((s) => s.ids.VC));
  const problems = [];
  for (const [id, vc] of vcs) {
    if (NOT_BY_SCENARIO.test(vc.method) || NOT_BY_SCENARIO.test(vc.state)) continue;
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

// Open-question numbers a State cell cites: "Blocked (PRD OQ 2)",
// "Blocked (PRD OQ 1, OQ 8)", "Blocked (OQs 1 and 8)" all count.
function citedOqs(text) {
  const out = new Set();
  for (const m of String(text).matchAll(/\bOQs?\s*#?\s*(\d+(?:\s*(?:,|and|&|\/)\s*(?:OQ\s*#?\s*)?\d+)*)/gi)) {
    for (const n of m[1].match(/\d+/g)) out.add(Number(n));
  }
  return out;
}
const isBlocked = (state) => /^blocked\b/i.test(String(state).trim());

// Exactly the expected BACs are Blocked, each citing its open question(s);
// untestable BACs are Blocked (untestable); no Blocked BAC has a scenario;
// and each named Non-Negotiable's VCs are Blocked citing their question.
// args: { blocked: { "BAC-n": [oq, ...] }, untestable: ["BAC-n"],
//         nonNegotiables: [{ name, oqs: [oq, ...] }] }
function blockedAsExpected({ workspace, args }) {
  const prd = loadOrFail(workspace, opt(args, 'prd'));
  const plan = loadOrFail(workspace, opt(args, 'plan'));
  if (prd.missing || plan.missing) return { passed: false, evidence: prd.missing || plan.missing };
  const bacs = [...prdIds(prd.text)].filter((id) => id.startsWith('BAC-'));
  const { vcs, matrix } = parsePlan(plan.text);
  const { scenarios } = parseFeatures(workspace, opt(args, 'dir'));
  const blocked = args.blocked || {};
  const untestable = new Set(args.untestable || []);
  const problems = [];
  for (const id of bacs) {
    const state = matrix.get(id)?.state || '';
    if (blocked[id]) {
      if (!isBlocked(state)) problems.push(`${id} should be Blocked citing OQ ${blocked[id].join(', ')}, State is "${state || 'missing'}"`);
      else {
        const cited = citedOqs(state);
        const missing = blocked[id].filter((n) => !cited.has(n));
        if (missing.length) problems.push(`${id} State "${state}" does not cite OQ ${missing.join(', ')}`);
      }
    } else if (untestable.has(id)) {
      if (!isBlocked(state) || !/untestable/i.test(state)) problems.push(`${id} should be Blocked (untestable), State is "${state || 'missing'}"`);
    } else if (isBlocked(state)) {
      problems.push(`${id} is "${state}" but no open question blocks it`);
    }
    if ((blocked[id] || untestable.has(id)) && scenarios.some((s) => s.ids.BAC.includes(id))) {
      problems.push(`${id} is blocked but a scenario is tagged @${id}`);
    }
  }
  for (const nn of args.nonNegotiables || []) {
    const proving = [...vcs].filter(([, vc]) => vc.provesText.toLowerCase().includes(nn.name.toLowerCase()));
    if (!proving.length) problems.push(`no VC proves "${nn.name}"`);
    for (const [vcId, vc] of proving) {
      const cited = citedOqs(vc.state);
      if (!isBlocked(vc.state) || nn.oqs.some((n) => !cited.has(n))) {
        problems.push(`${vcId} proves "${nn.name}" and should be Blocked citing OQ ${nn.oqs.join(', ')}, State is "${vc.state}"`);
      }
    }
  }
  return problems.length
    ? { passed: false, evidence: summarize(problems) }
    : { passed: true, evidence: `Blocked exactly ${[...Object.keys(blocked), ...untestable].join(', ')} with their reasons; Non-Negotiable VCs blocked as expected` };
}

// Without an architecture, no integration VC may be Covered: its State is
// Pending architecture (or Blocked). An integration VC is defined by what its
// pass depends on, not its Level, so two sets are checked:
// - every integration-level VC;
// - every VC proving a BAC in args.bacs, whatever its Level. args.bacs lists
//   BACs whose pass depends on a system the PRD names (CRM, directory, email
//   delivery), so all their VCs are integration-dependent. Each listed BAC
//   must have at least one VC.
const WAITING = /^(pending architecture|blocked)\b/i;
function integrationPending({ workspace, args }) {
  const plan = loadOrFail(workspace, opt(args, 'plan'));
  if (plan.missing) return { passed: false, evidence: plan.missing };
  const { vcs } = parsePlan(plan.text);
  const bacs = args.bacs || [];
  const problems = [];
  let checked = 0;
  for (const [id, vc] of vcs) {
    const listed = vc.proves.filter((b) => bacs.includes(b));
    const byLevel = /integration/i.test(vc.level);
    if (!byLevel && !listed.length) continue;
    checked += 1;
    if (WAITING.test(vc.state)) continue;
    const detail = `Proves "${vc.provesText.trim() || 'none'}", Level "${vc.level || 'none'}", Doubles "${vc.doubles || 'none'}"`;
    problems.push(listed.length
      ? `${id} proves ${listed.join(', ')}, which depends on an external system, but has State "${vc.state}" (${detail})`
      : `${id} is integration-level with State "${vc.state}" (${detail})`);
  }
  for (const bac of bacs) {
    if (![...vcs.values()].some((vc) => vc.proves.includes(bac))) problems.push(`${bac} has no VC`);
  }
  return problems.length
    ? { passed: false, evidence: summarize(problems) }
    : { passed: true, evidence: `${checked} integration-dependent VCs${bacs.length ? ` (including every VC of ${bacs.join(', ')})` : ''}, each Pending architecture or Blocked` };
}

// The plan's Open Questions table has Owner, Blocking? and Blocks columns;
// every row has an owner and a yes/no blocking flag, every blocking row lists
// the IDs it blocks, and each args.mustBlock ID is blocked by some row.
function openQuestionsShape({ workspace, args }) {
  const plan = loadOrFail(workspace, opt(args, 'plan'));
  if (plan.missing) return { passed: false, evidence: plan.missing };
  const table = markdownTables(plan.text).find((t) => col(t.header, /^owner$/i) !== -1 && col(t.header, /^blocks$/i) !== -1);
  if (!table) return { passed: false, evidence: 'no Open Questions table with Owner and Blocks columns' };
  const owner = col(table.header, /^owner$/i);
  const blocking = col(table.header, /^blocking\??$/i);
  const blocks = col(table.header, /^blocks$/i);
  if (blocking === -1) return { passed: false, evidence: 'the Open Questions table has no Blocking? column' };
  const problems = [];
  const blockedIds = new Set();
  table.rows.forEach((row, i) => {
    const label = `row ${row[0] || i + 1}`;
    if (!(row[owner] || '').trim()) problems.push(`${label} has no owner`);
    const flag = (row[blocking] || '').trim();
    if (!/^(yes|no)\b/i.test(flag)) problems.push(`${label} Blocking? is "${flag}", not Yes or No`);
    const ids = String(row[blocks] || '').match(/\b(?:BAC|VC|FR|NFR|N)-\d+\b/g) || [];
    if (/^yes\b/i.test(flag)) {
      if (!ids.length) problems.push(`${label} is blocking but lists no IDs in Blocks`);
      for (const id of ids) blockedIds.add(id.replace(/-0*(\d+)$/, '-$1'));
    }
  });
  for (const id of args.mustBlock || []) if (!blockedIds.has(id)) problems.push(`no blocking question lists ${id} in Blocks`);
  return problems.length
    ? { passed: false, evidence: summarize(problems) }
    : { passed: true, evidence: `${table.rows.length} open questions, each with an owner and flag; blocking rows list IDs` };
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
  // A data-* attribute counts only in selector syntax: after [, # or ., or
  // followed by ] or = (data-testid="save"). A hyphenated word such as
  // "data-migration" in prose or a table cell is not a selector.
  ['selector', /[[#.]\s*data-[a-z][\w-]*|\bdata-[a-z][\w-]*\s*(?:\]|[~|^$*]?=)|\[[a-z-]+\s*[~|^$*]?=\s*["']|\bxpath\b|\/\/(?:div|span|button|input|a|li|td)\b|#[a-z][\w]*-[\w-]+|(?:^|\s)\.[a-z][\w-]*\s*>|\bcss selector\b/i],
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
  'blocked-as-expected': blockedAsExpected,
  'integration-pending': integrationPending,
  'open-questions-shape': openQuestionsShape,
  // exposed for tests
  _parsePlan: parsePlan,
  _parseFeatures: parseFeatures,
};

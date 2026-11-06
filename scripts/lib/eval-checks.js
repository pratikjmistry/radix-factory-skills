'use strict';

// Deterministic post-run checks for Tier-3 behavioral evals.
//
// A check is a function ({ workspace, trace, args }) => { passed, evidence }.
// It runs after a complete execution, before the throwaway workspace is
// removed. `workspace` is the project the agent worked in: the eval's
// fixture directory when it has exactly one (fixtures land under their own
// names), otherwise the workspace root. Check paths are relative to it. Mechanical expectations (a file exists, a value is
// exact, sources are unchanged) belong here, not with the model grader: they
// cost nothing to run and never disagree with themselves.
//
// Built-ins live in this file. Skill-specific checks live in
// evals/checks/<skill>.js, which exports an object of name -> function.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// ---------- helpers shared with skill check modules ----------

function inWorkspace(workspace, rel) {
  if (typeof rel !== 'string' || !rel || path.isAbsolute(rel)) {
    throw new Error(`check path must be relative: ${rel}`);
  }
  const root = path.resolve(workspace);
  const abs = path.resolve(root, rel);
  if (abs !== root && !abs.startsWith(`${root}${path.sep}`)) {
    throw new Error(`check path escapes workspace: ${rel}`);
  }
  return abs;
}

function readText(workspace, rel) {
  const abs = inWorkspace(workspace, rel);
  return fs.existsSync(abs) && fs.statSync(abs).isFile() ? fs.readFileSync(abs, 'utf8') : null;
}

function listFiles(workspace, relDir, extension) {
  const root = inWorkspace(workspace, relDir);
  if (!fs.existsSync(root)) return [];
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(abs);
      else if (entry.isFile() && abs.endsWith(extension)) out.push(path.relative(workspace, abs));
    }
  };
  walk(root);
  return out.sort();
}

// Markdown tables as { header: [cells], rows: [[cells]] }. Cells are trimmed
// and stripped of surrounding bold/code markers.
function markdownTables(text) {
  const tables = [];
  let block = [];
  const flush = () => {
    if (block.length >= 2 && /^\|?\s*:?-{2,}/.test(block[1].replace(/^\|/, '').trim())) {
      const split = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|')
        .map((c) => c.trim().replace(/^(\*\*|`)(.*)\1$/, '$2').trim());
      tables.push({ header: split(block[0]), rows: block.slice(2).map(split) });
    }
    block = [];
  };
  for (const line of String(text).split('\n')) {
    if (line.trim().startsWith('|')) block.push(line);
    else flush();
  }
  flush();
  return tables;
}

// The terminal result text of a stream-json trace: the agent's final message.
function finalResultText(trace) {
  let text = null;
  for (const line of String(trace).split('\n')) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line);
      if (event?.type === 'result' && typeof event.result === 'string') text = event.result;
    } catch { /* not an event */ }
  }
  return text;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function summarize(problems, limit = 10) {
  const shown = problems.slice(0, limit).join('; ');
  return problems.length > limit ? `${shown}; and ${problems.length - limit} more` : shown;
}

// ---------- built-in checks ----------

// args: { paths: [relative paths] }. Passes when none of the paths differs
// from the fixture baseline commit (committed or uncommitted) and no new file
// appeared under them.
function unchanged({ workspace, args }) {
  const paths = args.paths;
  for (const p of paths) inWorkspace(workspace, p);
  const git = (argv) => execFileSync('git', argv, { cwd: workspace, encoding: 'utf8' }).trim();
  const baseline = git(['rev-list', '--max-parents=0', 'HEAD']).split('\n')[0];
  const changed = git(['diff', '--name-only', baseline, '--', ...paths]).split('\n').filter(Boolean);
  const added = git(['ls-files', '--others', '--exclude-standard', '--', ...paths]).split('\n').filter(Boolean);
  const problems = [...changed.map((f) => `${f} changed`), ...added.map((f) => `${f} added`)];
  return problems.length
    ? { passed: false, evidence: summarize(problems) }
    : { passed: true, evidence: `unchanged since the fixture baseline: ${paths.join(', ')}` };
}

// args: { file, patterns?: [regex], forbid?: [regex], flags?: string,
// show?: regex }. Passes when the file exists, every pattern matches and no
// forbid matches. On a failure, `show` (matched per line) reports what the
// file actually has, for example the **Status:** line.
function shownLines(text, show) {
  const re = new RegExp(show);
  const found = String(text).split('\n').filter((line) => re.test(line)).map((line) => `"${line.trim().slice(0, 120)}"`);
  return found.length ? `found ${summarize(found, 3)}` : `no line matches /${show}/`;
}

function fileMatches({ workspace, args }) {
  const text = readText(workspace, args.file);
  if (text === null) return { passed: false, evidence: `${args.file} does not exist` };
  const flags = args.flags || 'm';
  const problems = [];
  for (const p of args.patterns || []) {
    if (!new RegExp(p, flags).test(text)) problems.push(`no match for /${p}/${flags}`);
  }
  for (const p of args.forbid || []) {
    const m = text.match(new RegExp(p, flags));
    if (m) problems.push(`forbidden match /${p}/${flags}: "${m[0].trim().slice(0, 120)}"`);
  }
  if (problems.length && args.show) problems.push(shownLines(text, args.show));
  return problems.length
    ? { passed: false, evidence: `${args.file}: ${summarize(problems)}` }
    : { passed: true, evidence: `${args.file} matches all ${(args.patterns || []).length} pattern(s) and no forbidden one` };
}

// args: { prefix, from, to }. Passes when the agent's final message reports
// every ID in the range on its own line (list item, table row or plain line)
// with a pass or fail verdict on that line. A blanket "all pass" fails.
const VERDICT = /\b(pass(?:ed|es)?|fail(?:ed|s)?)\b|✅|❌|✓|✗|✔|✘/i;

function finalReportLists({ trace, args }) {
  const text = finalResultText(trace);
  if (text === null) return { passed: false, evidence: 'the trace has no final result message' };
  const lines = text.split('\n');
  const missing = [];
  for (let n = args.from; n <= args.to; n++) {
    const id = `${args.prefix}${n}`;
    const lead = new RegExp(`^[\\s|>*_\\-•#]*(?:\\*\\*|\`)?${escapeRe(id)}(?![0-9])`);
    if (!lines.some((line) => lead.test(line) && VERDICT.test(line))) missing.push(id);
  }
  return missing.length
    ? { passed: false, evidence: `no line with a pass/fail verdict for ${missing.join(', ')}` }
    : { passed: true, evidence: `${args.prefix}${args.from}–${args.prefix}${args.to} each reported on its own line with a verdict` };
}

const BUILTIN_CHECKS = {
  unchanged,
  'file-matches': fileMatches,
  'final-report-lists': finalReportLists,
};

// Built-in argument shapes, validated in Tier 2 so a malformed check fails CI
// instead of failing a paid run.
const isStrings = (v) => Array.isArray(v) && v.every((x) => typeof x === 'string');
const BUILTIN_ARGS = {
  unchanged: (a) => (isStrings(a.paths) && a.paths.length ? null : 'args.paths must be a non-empty array of strings'),
  'file-matches': (a) => {
    if (typeof a.file !== 'string') return 'args.file must be a string';
    if (a.patterns !== undefined && !isStrings(a.patterns)) return 'args.patterns must be an array of strings';
    if (a.forbid !== undefined && !isStrings(a.forbid)) return 'args.forbid must be an array of strings';
    if (!(a.patterns?.length || a.forbid?.length)) return 'args needs patterns or forbid';
    if (a.show !== undefined && typeof a.show !== 'string') return 'args.show must be a string';
    try {
      for (const p of [...(a.patterns || []), ...(a.forbid || [])]) new RegExp(p, a.flags || 'm');
      if (a.show !== undefined) new RegExp(a.show);
    } catch (e) { return `invalid regex: ${e.message}`; }
    return null;
  },
  'final-report-lists': (a) => (typeof a.prefix === 'string' && Number.isInteger(a.from) && Number.isInteger(a.to) && a.from <= a.to
    ? null : 'args needs prefix (string) and integer from <= to'),
};

// ---------- resolution, validation, execution ----------

function loadSkillChecks(checksDir, skillName) {
  const file = path.join(checksDir, `${skillName}.js`);
  if (!fs.existsSync(file)) return {};
  const mod = require(file);
  return mod && typeof mod === 'object' ? mod : {};
}

function resolveCheck(name, skillName, checksDir) {
  if (Object.prototype.hasOwnProperty.call(BUILTIN_CHECKS, name)) return BUILTIN_CHECKS[name];
  // Names starting with "_" are a module's helpers, exported for its tests.
  if (name.startsWith('_')) return null;
  const mod = loadSkillChecks(checksDir, skillName);
  return Object.prototype.hasOwnProperty.call(mod, name) && typeof mod[name] === 'function' ? mod[name] : null;
}

// Returns a list of problems with an eval's checks[] declaration.
function validateChecks(checks, skillName, checksDir) {
  if (checks === undefined) return [];
  if (!Array.isArray(checks)) return ['checks must be an array'];
  const problems = [];
  const seen = new Set();
  for (const c of checks) {
    if (!c || typeof c !== 'object' || Array.isArray(c)) { problems.push('every check must be an object'); continue; }
    const label = typeof c.id === 'string' ? c.id : JSON.stringify(c.id);
    if (typeof c.id !== 'string' || !c.id.trim()) problems.push('every check needs a string id');
    else if (seen.has(c.id)) problems.push(`duplicate check id ${c.id}`);
    seen.add(c.id);
    if (typeof c.text !== 'string' || !c.text.trim()) problems.push(`check ${label} needs text`);
    if (c.args !== undefined && (c.args === null || typeof c.args !== 'object' || Array.isArray(c.args))) {
      problems.push(`check ${label} args must be an object`);
      continue;
    }
    if (typeof c.check !== 'string') { problems.push(`check ${label} needs a check name`); continue; }
    let fn;
    try { fn = resolveCheck(c.check, skillName, checksDir); } catch (e) {
      problems.push(`check ${label}: cannot load evals/checks/${skillName}.js — ${e.message}`);
      continue;
    }
    if (!fn) { problems.push(`check ${label} names unknown check "${c.check}"`); continue; }
    const argsProblem = BUILTIN_ARGS[c.check]?.(c.args || {});
    if (argsProblem) problems.push(`check ${label} (${c.check}): ${argsProblem}`);
  }
  return problems;
}

// Runs every declared check; a check that throws or returns a malformed
// result is recorded as failed, never skipped.
function runChecks(checks, { workspace, trace, skillName, checksDir }) {
  return (checks || []).map((c) => {
    let outcome;
    try {
      const fn = resolveCheck(c.check, skillName, checksDir);
      if (!fn) throw new Error(`unknown check "${c.check}"`);
      outcome = fn({ workspace, trace, args: c.args || {} });
      if (!outcome || typeof outcome.passed !== 'boolean') throw new Error('check returned no boolean verdict');
    } catch (e) {
      outcome = { passed: false, evidence: `check error: ${e.message}` };
    }
    return { id: c.id, text: c.text, check: c.check, passed: outcome.passed, evidence: String(outcome.evidence || '') };
  });
}

module.exports = {
  BUILTIN_CHECKS,
  validateChecks,
  runChecks,
  resolveCheck,
  // helpers for evals/checks/<skill>.js
  readText,
  listFiles,
  markdownTables,
  finalResultText,
  summarize,
  escapeRe,
};

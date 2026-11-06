#!/usr/bin/env node

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync, execFileSync } = require('node:child_process');
const test = require('node:test');
const { materializeWorkspace, isolationBreach, parseGrading, clearGradingSlot, persistGradingOutcome, extractExecutorModel } = require('./run-evals');

const RUNNER = path.join(__dirname, 'run-evals.js');

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function writeSkill(root, name, description) {
  const dir = path.join(root, 'skills', name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'SKILL.md'),
    `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n`,
  );
}

function behavioralEval(files = ['project/context.txt']) {
  return {
    id: 1,
    prompt: 'Inspect the attached project and complete the requested work.',
    expected_output: 'A verified result grounded in the attached project',
    files,
    expectations: ['The attached project is inspected before reporting a result'],
  };
}

function completeCase(skillName, positivePrompt, topK = 1, files) {
  return {
    skill_name: skillName,
    trigger: {
      positive: [1, 2, 3].map(() => ({ prompt: positivePrompt, top_k: topK })),
      negative: [
        { prompt: 'unrelated banana request' },
        { prompt: 'unrelated orange request' },
      ],
    },
    evals: [behavioralEval(files)],
  };
}

function makeSandbox() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-skills-run-evals-test-'));
  fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(root, 'evals', 'cases'), { recursive: true });
  fs.mkdirSync(path.join(root, 'evals', 'fixtures', 'project'), { recursive: true });
  fs.copyFileSync(RUNNER, path.join(root, 'scripts', 'run-evals.js'));
  fs.cpSync(path.join(__dirname, 'lib'), path.join(root, 'scripts', 'lib'), { recursive: true });
  fs.writeFileSync(path.join(root, 'evals', 'fixtures', 'project', 'context.txt'), 'fixture\n');
  return root;
}

function run(root, args = []) {
  return spawnSync(process.execPath, [path.join(root, 'scripts', 'run-evals.js'), ...args], {
    cwd: root,
    encoding: 'utf8',
  });
}

// options: args, ids, trace, error (executor throws), graderError (grader
// throws), evalFields ({ id: extra eval fields }), env (extra environment).
// Every claude call is logged to claude-calls.txt (role) and
// claude-options.jsonl (role, --model value, timeout, stdio).
function runBehavioralWithGrading(root, raw, options = {}) {
  const { args = [] } = options;
  writeSkill(root, 'alpha-skill', 'Handles alpha widgets.');
  const evalCase = completeCase('alpha-skill', 'change alpha widget');
  evalCase.evals = (options.ids || [1]).map((id) => ({
    ...behavioralEval([]), id, kind: 'dialogue', ...(options.evalFields?.[id] || {}),
  }));
  writeJson(path.join(root, 'evals', 'cases', 'alpha-skill.json'), evalCase);
  if (options.checksModule) {
    fs.mkdirSync(path.join(root, 'evals', 'checks'), { recursive: true });
    fs.writeFileSync(path.join(root, 'evals', 'checks', 'alpha-skill.js'), options.checksModule);
  }
  const stub = path.join(root, 'stub-claude.cjs');
  fs.writeFileSync(stub, `
    const assert = require('node:assert/strict');
    const realExecFileSync = require('child_process').execFileSync;
    require('child_process').execFileSync = (command, args, opts = {}) => {
      if (command === 'git') return realExecFileSync(command, args, opts);
      assert.equal(command, 'claude');
      const executor = args.includes('--output-format');
      const fs = require('node:fs');
      fs.appendFileSync(${JSON.stringify(path.join(root, 'claude-calls.txt'))}, executor ? 'executor\\n' : 'grader\\n');
      const m = args.indexOf('--model');
      fs.appendFileSync(${JSON.stringify(path.join(root, 'claude-options.jsonl'))}, JSON.stringify({
        role: executor ? 'executor' : 'grader', model: m === -1 ? null : args[m + 1], timeout: opts.timeout, stdio: opts.stdio,
      }) + '\\n');
      if (executor && ${JSON.stringify(Boolean(options.error))}) throw Object.assign(new Error('executor failed'), ${JSON.stringify(options.error || {})});
      if (!executor) fs.writeFileSync(${JSON.stringify(path.join(root, 'grader-prompt.txt'))}, String(opts.input));
      if (!executor && ${JSON.stringify(Boolean(options.graderError))}) throw Object.assign(new Error('grader failed'), ${JSON.stringify(options.graderError || {})});
      return executor ? ${JSON.stringify(options.trace ?? '{"type":"result","subtype":"success","is_error":false,"result":"done"}\n')} : ${JSON.stringify(raw)};
    };
  `);
  const env = { ...process.env, ...(options.env || {}) };
  for (const key of ['EVAL_MODEL', 'EVAL_GRADER_MODEL']) if (!(options.env && key in options.env)) delete env[key];
  return spawnSync(process.execPath, [
    '--require', stub, path.join(root, 'scripts', 'run-evals.js'),
    '--behavioral', 'alpha-skill', ...args,
  ], { cwd: root, encoding: 'utf8', env });
}

function claudeOptions(root) {
  const file = path.join(root, 'claude-options.jsonl');
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : [];
}

const passingGrading = JSON.stringify({
  expectations: [{ id: 1, text: 'check', passed: true, evidence: 'observed' }],
  summary: { passed: 1, failed: 0, total: 1, pass_rate: 1 },
});
const terminal = { type: 'result', subtype: 'success', is_error: false };
const call = { type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Bash', id: 'test', input: {} }] } };
const returned = (id, is_error = false) => ({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: id, is_error }] } });
const traceOf = (...events) => events.map((event) => JSON.stringify(event)).join('\n') + '\n';

for (const [name, trace] of Object.entries({
  'terminal error': traceOf({ type: 'result', subtype: 'error_max_turns', is_error: true }),
  'missing terminal': traceOf(call),
  'implicit success': traceOf({ type: 'result', subtype: 'success' }),
  'stale terminal': traceOf(terminal, call),
  'permission denial': traceOf({ ...terminal, permission_denials: [{ tool_name: 'Read' }] }),
  'pending tool': traceOf(call, terminal),
  'unmatched return': traceOf(returned('unknown'), terminal),
  'malformed event': 'null\n',
  'invalid JSON': 'not JSON\n',
  'null assistant message': traceOf({ type: 'assistant', message: null }, terminal),
  'array assistant message': traceOf({ type: 'assistant', message: [] }, terminal),
  'null assistant content': traceOf({ type: 'assistant', message: { content: null } }, terminal),
  'object assistant content': traceOf({ type: 'assistant', message: { content: { type: 'tool_use', id: 'hidden' } } }, terminal),
  'null user message': traceOf({ type: 'user', message: null }, terminal),
  'null content block': traceOf({ type: 'assistant', message: { content: [null] } }, terminal),
})) {
  test(`does not grade an incomplete execution: ${name}`, () => {
    const root = makeSandbox();
    try {
      const result = runBehavioralWithGrading(root, passingGrading, { trace });
      assert.equal(result.status, 1, result.stdout + result.stderr);
      assert.match(result.stdout, /execution incomplete/);
      const base = path.join(root, 'evals/results/alpha-skill.eval-1');
      assert.equal(fs.existsSync(`${base}.grading.json`), false);
      assert.equal(fs.readFileSync(`${base}.execution.raw.txt`, 'utf8'), trace);
      assert.equal(fs.readFileSync(path.join(root, 'claude-calls.txt'), 'utf8'), 'executor\n');
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
}

for (const id of [null, 0, 2]) {
  test(id === null ? 'behavioral default grades every case' : `behavioral --eval ${id} grades only the selected case`, () => {
    const root = makeSandbox();
    try {
      const raw = JSON.stringify({
        expectations: [{ id: 1, text: 'check', passed: true, evidence: 'observed' }],
        summary: { passed: 1, failed: 0, total: 1, pass_rate: 1 },
      });
      const args = id === null ? [] : ['--eval', String(id)];
      const result = runBehavioralWithGrading(root, raw, { args, ids: [0, 2] });
      assert.equal(result.status, 0, result.stdout + result.stderr);
      for (const candidate of [0, 2]) {
        assert.equal(fs.existsSync(path.join(root, 'evals/results', `alpha-skill.eval-${candidate}.grading.json`)), id === null || id === candidate);
      }
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
}

test('a returned failed probe can recover before successful completion', () => {
  const root = makeSandbox();
  try {
    const next = { ...call, message: { content: [{ ...call.message.content[0], id: 'green' }] } };
    const trace = traceOf(call, returned('test', true),
      { type: 'user', message: { content: 'Continue the repair.' } }, next, returned('green'), terminal,
      { type: 'system', subtype: 'status', status: 'idle' });
    const result = runBehavioralWithGrading(root, passingGrading, { trace });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(fs.existsSync(path.join(root, 'evals/results/alpha-skill.eval-1.grading.json')), true);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

for (const code of ['ETIMEDOUT', 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER']) {
  test(`retains partial execution evidence and continues after ${code}`, () => {
    const root = makeSandbox();
    try {
      const trace = traceOf(call);
      const result = runBehavioralWithGrading(root, passingGrading,
        { error: { code, stdout: trace, stderr: 'captured diagnostic' }, ids: [1, 2] });
      assert.equal(result.status, 1, result.stdout + result.stderr);
      assert.match(result.stdout, /eval 2: executing/);
      for (const id of [1, 2]) {
        const base = path.join(root, `evals/results/alpha-skill.eval-${id}`);
        assert.equal(fs.existsSync(`${base}.grading.json`), false);
        assert.equal(fs.readFileSync(`${base}.execution.raw.txt`, 'utf8'), trace);
        assert.match(fs.readFileSync(`${base}.execution.error.txt`, 'utf8'), new RegExp(code));
        assert.match(fs.readFileSync(`${base}.execution.error.txt`, 'utf8'), /captured diagnostic/);
      }
      assert.equal(fs.readFileSync(path.join(root, 'claude-calls.txt'), 'utf8'), 'executor\nexecutor\n');
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
}

// ---------- model, timeouts, error capture, soak selection ----------

for (const [name, opts, expected] of [
  ['passes no --model by default', {}, { executor: null, grader: null, meta: 'default' }],
  ['passes --model to executor and grader', { args: ['--model', 'sonnet'] }, { executor: 'sonnet', grader: 'sonnet', meta: 'sonnet' }],
  ['reads EVAL_MODEL', { env: { EVAL_MODEL: 'haiku' } }, { executor: 'haiku', grader: 'haiku', meta: 'haiku' }],
  ['lets the flag win over EVAL_MODEL', { args: ['--model', 'opus'], env: { EVAL_MODEL: 'haiku' } }, { executor: 'opus', grader: 'opus', meta: 'opus' }],
  ['takes a separate grader model', { args: ['--grader-model', 'opus'], env: { EVAL_MODEL: 'sonnet' } }, { executor: 'sonnet', grader: 'opus', meta: 'opus' }],
  ['reads EVAL_GRADER_MODEL', { env: { EVAL_MODEL: 'sonnet', EVAL_GRADER_MODEL: 'opus' } }, { executor: 'sonnet', grader: 'opus', meta: 'opus' }],
]) {
  test(`model option: ${name}`, () => {
    const root = makeSandbox();
    try {
      const result = runBehavioralWithGrading(root, passingGrading, opts);
      assert.equal(result.status, 0, result.stdout + result.stderr);
      const [executor, grader] = claudeOptions(root);
      assert.equal(executor.model, expected.executor);
      assert.equal(grader.model, expected.grader);
      const grading = JSON.parse(fs.readFileSync(path.join(root, 'evals/results/alpha-skill.eval-1.grading.json'), 'utf8'));
      assert.equal(grading.run.grader_model, expected.meta);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
}

for (const [name, opts, executorMs, graderMs] of [
  ['defaults to 15 and 5 minutes', {}, 15 * 60000, 5 * 60000],
  ['uses the eval\'s timeout fields', { evalFields: { 1: { timeout_minutes: 2, grader_timeout_minutes: 3 } } }, 2 * 60000, 3 * 60000],
  ['lets --timeout override the eval\'s executor timeout', { args: ['--timeout', '7'], evalFields: { 1: { timeout_minutes: 2 } } }, 7 * 60000, 5 * 60000],
]) {
  test(`timeout: ${name}`, () => {
    const root = makeSandbox();
    try {
      const result = runBehavioralWithGrading(root, passingGrading, opts);
      assert.equal(result.status, 0, result.stdout + result.stderr);
      const [executor, grader] = claudeOptions(root);
      assert.equal(executor.timeout, executorMs);
      assert.equal(grader.timeout, graderMs);
      for (const call of [executor, grader]) assert.deepEqual(call.stdio, ['pipe', 'pipe', 'pipe']);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
}

test('the execution error file states the cause and stderr, not the argv dump', () => {
  const root = makeSandbox();
  try {
    const result = runBehavioralWithGrading(root, passingGrading, {
      error: { code: 'ETIMEDOUT', signal: 'SIGTERM', stdout: traceOf(call), stderr: 'stderr line one\nstderr line two\n', message: 'Command failed: claude -p --append-system-prompt WHOLE-SKILL-TEXT' },
      evalFields: { 1: { timeout_minutes: 2 } },
    });
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, /execution incomplete: ETIMEDOUT: executor timed out after [\d.]+ min \(limit 2\.0 min\)/);
    const report = fs.readFileSync(path.join(root, 'evals/results/alpha-skill.eval-1.execution.error.txt'), 'utf8');
    assert.match(report, /^cause: ETIMEDOUT: executor timed out/);
    assert.match(report, /signal=SIGTERM/);
    assert.match(report, /--- stderr ---\nstderr line one\nstderr line two\n/);
    assert.doesNotMatch(report, /WHOLE-SKILL-TEXT|append-system-prompt/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('an incomplete trace names the trace check as its cause', () => {
  const root = makeSandbox();
  try {
    const result = runBehavioralWithGrading(root, passingGrading, { trace: traceOf(call) });
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, /execution incomplete: missing successful terminal result/);
    const report = fs.readFileSync(path.join(root, 'evals/results/alpha-skill.eval-1.execution.error.txt'), 'utf8');
    assert.match(report, /^cause: missing successful terminal result/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('a usage limit names the API error and stops the remaining evals', () => {
  const root = makeSandbox();
  try {
    const limited = traceOf({
      type: 'result', subtype: 'success', is_error: true, num_turns: 1, total_cost_usd: 0,
      api_error_status: 429, api_error: 'usage_limit_reached', result: "You've hit your 5-hour limit",
    });
    const result = runBehavioralWithGrading(root, passingGrading, { error: { status: 1, stdout: limited, stderr: '' }, ids: [1, 2, 3] });
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, /execution incomplete: 429 usage_limit_reached: You've hit your 5-hour limit/);
    assert.match(result.stdout, /usage limit reached; stopping before 2 remaining eval\(s\)/);
    assert.equal(fs.readFileSync(path.join(root, 'claude-calls.txt'), 'utf8'), 'executor\n');
    const report = fs.readFileSync(path.join(root, 'evals/results/alpha-skill.eval-1.execution.error.txt'), 'utf8');
    assert.match(report, /^cause: 429 usage_limit_reached/);
    assert.match(report, /turns=1 cost_usd=0/);
    assert.equal(fs.existsSync(path.join(root, 'evals/results/alpha-skill.eval-2.execution.error.txt')), false);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('a grader failure is recorded and later evals still run', () => {
  const root = makeSandbox();
  try {
    const result = runBehavioralWithGrading(root, passingGrading, {
      graderError: { code: 'ETIMEDOUT', stdout: 'partial', stderr: 'grader diagnostic\n' }, ids: [1, 2],
    });
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.equal(fs.readFileSync(path.join(root, 'claude-calls.txt'), 'utf8'), 'executor\ngrader\nexecutor\ngrader\n');
    for (const id of [1, 2]) {
      const base = path.join(root, `evals/results/alpha-skill.eval-${id}`);
      assert.match(result.stdout, new RegExp(`eval ${id}: grader failed: ETIMEDOUT: grader timed out`));
      const report = fs.readFileSync(`${base}.grading.error.txt`, 'utf8');
      assert.match(report, /role: grader/);
      assert.match(report, /grader diagnostic/);
      assert.match(report, /--- stdout ---\npartial/);
      assert.equal(fs.existsSync(`${base}.grading.json`), false);
    }
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('clearGradingSlot also clears a stale grader error', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-skills-slot-'));
  try {
    const base = path.join(dir, 'skill.eval-1');
    fs.writeFileSync(`${base}.grading.error.txt`, 'old');
    clearGradingSlot(base);
    assert.equal(fs.existsSync(`${base}.grading.error.txt`), false);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

for (const [name, args, graded] of [
  ['skips soak evals by default', [], [1]],
  ['includes soak evals with --soak', ['--soak'], [1, 2]],
  ['runs a soak eval selected by --eval', ['--eval', '2'], [2]],
]) {
  test(`soak selection: ${name}`, () => {
    const root = makeSandbox();
    try {
      const result = runBehavioralWithGrading(root, passingGrading, { args, ids: [1, 2], evalFields: { 2: { soak: true } } });
      assert.equal(result.status, 0, result.stdout + result.stderr);
      for (const id of [1, 2]) {
        assert.equal(fs.existsSync(path.join(root, `evals/results/alpha-skill.eval-${id}.grading.json`)), graded.includes(id));
      }
      if (!args.length) assert.match(result.stdout, /skipping 1 soak eval\(s\); pass --soak/);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
}

test('a skill with only soak evals asks for --soak', () => {
  const root = makeSandbox();
  try {
    const result = runBehavioralWithGrading(root, passingGrading, { evalFields: { 1: { soak: true } } });
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stderr, /has only soak evals; pass --soak/);
    assert.equal(fs.existsSync(path.join(root, 'claude-calls.txt')), false);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('dry-run shows the model, timeouts and soak marker', () => {
  const root = makeSandbox();
  try {
    const result = runBehavioralWithGrading(root, passingGrading, {
      args: ['--dry-run', '--soak', '--model', 'sonnet'], ids: [1, 2],
      evalFields: { 2: { soak: true, timeout_minutes: 45 } },
    });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /eval 1: .*executor model sonnet, timeout 15\.0 min; grader model sonnet, timeout 5\.0 min.*--model sonnet/);
    assert.match(result.stdout, /eval 2 \[soak\]: .*timeout 45\.0 min/);
    assert.equal(fs.existsSync(path.join(root, 'claude-calls.txt')), false);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

for (const [args, message] of [
  [['--model'], /--model needs a value/],
  [['--model', '--soak'], /--model needs a value/],
  [['--timeout', '0'], /--timeout must be a number of minutes from 1 to 60/],
  [['--timeout', '0.5'], /--timeout must be a number of minutes from 1 to 60/],
  [['--timeout', '61'], /--timeout must be a number of minutes/],
  [['--timeout', 'soon'], /--timeout must be a number of minutes/],
]) {
  test(`rejects behavioral option ${JSON.stringify(args)}`, () => {
    const root = makeSandbox();
    try {
      const result = runBehavioralWithGrading(root, passingGrading, { args });
      assert.equal(result.status, 1, result.stdout + result.stderr);
      assert.match(result.stderr, message);
      assert.equal(fs.existsSync(path.join(root, 'claude-calls.txt')), false);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
}

test('behavioral options are rejected on deterministic runs', () => {
  const root = makeSandbox();
  try {
    const result = run(root, ['--model', 'sonnet', '--soak']);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stderr, /--model, --soak apply only to behavioral evals/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

for (const [field, value] of [
  ['timeout_minutes', 0], ['timeout_minutes', 0.5], ['timeout_minutes', 61], ['timeout_minutes', '5'],
  ['grader_timeout_minutes', -1], ['soak', 'yes'],
]) {
  test(`Tier 2 rejects ${field}=${JSON.stringify(value)}`, () => {
    const root = makeSandbox();
    writeSkill(root, 'alpha-skill', 'Handles alpha widgets. Use when changing alpha widgets.');
    const evalCase = completeCase('alpha-skill', 'change alpha widget');
    evalCase.evals = [{ ...behavioralEval([]), kind: 'dialogue', [field]: value }];
    writeJson(path.join(root, 'evals', 'cases', 'alpha-skill.json'), evalCase);
    try {
      const result = run(root);
      assert.equal(result.status, 1, result.stdout + result.stderr);
      assert.match(result.stdout, new RegExp(`eval id=1 ${field} must`));
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
}

test('Tier 2 accepts valid timeout and soak fields', () => {
  const root = makeSandbox();
  writeSkill(root, 'alpha-skill', 'Handles alpha widgets. Use when changing alpha widgets.');
  const evalCase = completeCase('alpha-skill', 'change alpha widget');
  evalCase.evals = [{ ...behavioralEval([]), kind: 'dialogue', timeout_minutes: 12, grader_timeout_minutes: 2.5, soak: true }];
  writeJson(path.join(root, 'evals', 'cases', 'alpha-skill.json'), evalCase);
  try {
    const result = run(root);
    assert.equal(result.status, 0, result.stdout + result.stderr);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

// ---------- deterministic checks: runner integration ----------

const ALPHA_CHECKS = `
  const fs = require('node:fs');
  module.exports = {
    'workspace-present': ({ workspace }) => ({ passed: fs.existsSync(workspace), evidence: 'workspace still exists' }),
    'trace-seen': ({ trace }) => ({ passed: trace.includes('"result":"done"'), evidence: 'saw the trace' }),
    'always-fails': () => ({ passed: false, evidence: 'nope' }),
    'throws': () => { throw new Error('boom'); },
    'no-verdict': () => ({ evidence: 'forgot passed' }),
    _helper: () => ({ passed: true, evidence: 'helper' }),
  };
`;
const check = (id, name, args) => ({ id, text: `check ${id}`, check: name, ...(args ? { args } : {}) });

test('passing checks run before cleanup and sit beside the grader\'s expectations', () => {
  const root = makeSandbox();
  try {
    const result = runBehavioralWithGrading(root, passingGrading, {
      checksModule: ALPHA_CHECKS,
      evalFields: { 1: { checks: [check('C1', 'workspace-present'), check('C2', 'trace-seen')] } },
    });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /eval 1: 1\/1 expectations passed, 2\/2 checks passed/);
    const grading = JSON.parse(fs.readFileSync(path.join(root, 'evals/results/alpha-skill.eval-1.grading.json'), 'utf8'));
    assert.equal(grading.expectations.length, 1);
    assert.deepEqual(grading.checks.map((c) => [c.id, c.passed]), [['C1', true], ['C2', true]]);
    assert.equal(grading.summary.passed, 1);
    assert.equal(grading.summary.total, 1);
    assert.equal(grading.summary.checks_passed, 2);
    assert.equal(grading.summary.checks_total, 2);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('a failed, throwing or verdict-less check fails the eval even when the grader passes', () => {
  const root = makeSandbox();
  try {
    const result = runBehavioralWithGrading(root, passingGrading, {
      checksModule: ALPHA_CHECKS,
      evalFields: { 1: { checks: [check('C1', 'workspace-present'), check('C2', 'always-fails'), check('C3', 'throws'), check('C4', 'no-verdict')] } },
    });
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, /eval 1: 1\/1 expectations passed, 1\/4 checks passed/);
    assert.match(result.stdout, /check C2: failed — nope/);
    const grading = JSON.parse(fs.readFileSync(path.join(root, 'evals/results/alpha-skill.eval-1.grading.json'), 'utf8'));
    const byId = Object.fromEntries(grading.checks.map((c) => [c.id, c]));
    assert.equal(byId.C3.passed, false);
    assert.match(byId.C3.evidence, /^check error: boom/);
    assert.match(byId.C4.evidence, /^check error: check returned no boolean verdict/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('the grader prompt carries the expectations but never the checks', () => {
  const root = makeSandbox();
  try {
    const result = runBehavioralWithGrading(root, passingGrading, {
      checksModule: ALPHA_CHECKS,
      evalFields: { 1: { expectations: ['judgment only expectation'], checks: [{ ...check('C1', 'workspace-present'), text: 'mechanical-only check text' }] } },
    });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const prompt = fs.readFileSync(path.join(root, 'grader-prompt.txt'), 'utf8');
    assert.match(prompt, /1\. judgment only expectation/);
    assert.doesNotMatch(prompt, /mechanical-only check text/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

for (const [name, opts] of [
  ['invalid grading', { raw: '{}' }],
  ['a grader failure', { raw: passingGrading, graderError: { code: 'ETIMEDOUT' } }],
]) {
  test(`check results are kept in checks.json after ${name}`, () => {
    const root = makeSandbox();
    try {
      const result = runBehavioralWithGrading(root, opts.raw, {
        checksModule: ALPHA_CHECKS, graderError: opts.graderError,
        evalFields: { 1: { checks: [check('C1', 'workspace-present')] } },
      });
      assert.equal(result.status, 1, result.stdout + result.stderr);
      const base = path.join(root, 'evals/results/alpha-skill.eval-1');
      assert.equal(fs.existsSync(`${base}.grading.json`), false);
      assert.deepEqual(JSON.parse(fs.readFileSync(`${base}.checks.json`, 'utf8')).checks.map((c) => c.passed), [true]);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
}

// ---------- deterministic checks: Tier 2 validation ----------

for (const [name, checks, message] of [
  ['an unknown check name', [check('C1', 'no-such-check')], /check C1 names unknown check "no-such-check"/],
  ['a helper export', [check('C1', '_helper')], /check C1 names unknown check "_helper"/],
  ['a duplicate check id', [check('C1', 'workspace-present'), check('C1', 'trace-seen')], /duplicate check id C1/],
  ['a check without text', [{ id: 'C1', check: 'workspace-present' }], /check C1 needs text/],
  ['a check without an id', [{ text: 't', check: 'workspace-present' }], /every check needs a string id/],
  ['non-object args', [{ ...check('C1', 'workspace-present'), args: [1] }], /check C1 args must be an object/],
  ['a non-array checks field', { id: 'C1' }, /checks must be an array/],
  ['file-matches without patterns', [check('C1', 'file-matches', { file: 'x.md' })], /check C1 \(file-matches\): args needs patterns or forbid/],
  ['file-matches with a bad regex', [check('C1', 'file-matches', { file: 'x.md', patterns: ['('] })], /check C1 \(file-matches\): invalid regex/],
  ['file-matches with a non-string show', [check('C1', 'file-matches', { file: 'x.md', patterns: ['x'], show: 1 })], /check C1 \(file-matches\): args.show must be a string/],
  ['file-matches with a bad show regex', [check('C1', 'file-matches', { file: 'x.md', patterns: ['x'], show: '(' })], /check C1 \(file-matches\): invalid regex/],
  ['unchanged without paths', [check('C1', 'unchanged', {})], /check C1 \(unchanged\): args.paths must be a non-empty array/],
  ['final-report-lists with a reversed range', [check('C1', 'final-report-lists', { prefix: 'T', from: 5, to: 1 })], /check C1 \(final-report-lists\): args needs prefix/],
]) {
  test(`Tier 2 rejects ${name}`, () => {
    const root = makeSandbox();
    writeSkill(root, 'alpha-skill', 'Handles alpha widgets. Use when changing alpha widgets.');
    fs.mkdirSync(path.join(root, 'evals', 'checks'), { recursive: true });
    fs.writeFileSync(path.join(root, 'evals', 'checks', 'alpha-skill.js'), ALPHA_CHECKS);
    const evalCase = completeCase('alpha-skill', 'change alpha widget');
    evalCase.evals = [{ ...behavioralEval([]), kind: 'dialogue', checks }];
    writeJson(path.join(root, 'evals', 'cases', 'alpha-skill.json'), evalCase);
    try {
      const result = run(root);
      assert.equal(result.status, 1, result.stdout + result.stderr);
      assert.match(result.stdout, message);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
}

test('Tier 2 accepts built-in and skill-module checks', () => {
  const root = makeSandbox();
  writeSkill(root, 'alpha-skill', 'Handles alpha widgets. Use when changing alpha widgets.');
  fs.mkdirSync(path.join(root, 'evals', 'checks'), { recursive: true });
  fs.writeFileSync(path.join(root, 'evals', 'checks', 'alpha-skill.js'), ALPHA_CHECKS);
  const evalCase = completeCase('alpha-skill', 'change alpha widget');
  evalCase.evals = [{
    ...behavioralEval([]), kind: 'dialogue', checks: [
      check('C1', 'workspace-present'),
      check('C2', 'unchanged', { paths: ['docs/PRD.md'] }),
      check('C3', 'file-matches', { file: 'docs/x.md', patterns: ['^# '], forbid: ['TODO'], flags: 'mi' }),
      check('C4', 'final-report-lists', { prefix: 'T', from: 1, to: 15 }),
    ],
  }];
  writeJson(path.join(root, 'evals', 'cases', 'alpha-skill.json'), evalCase);
  try {
    const result = run(root);
    assert.equal(result.status, 0, result.stdout + result.stderr);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('the repository\'s skill check modules load and export only functions', () => {
  const dir = path.join(__dirname, '..', 'evals', 'checks');
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.js'))) {
    const mod = require(path.join(dir, file));
    for (const [name, fn] of Object.entries(mod)) assert.equal(typeof fn, 'function', `${file} exports ${name}`);
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'skills', file.replace(/\.js$/, ''), 'SKILL.md')), `${file} names a real skill`);
  }
});

// ---------- deterministic checks: built-ins ----------

const evalChecks = require('./lib/eval-checks');

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'agent-skills-checks-'));
}
function write(root, rel, text) {
  fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
  fs.writeFileSync(path.join(root, rel), text);
}
function gitBaseline(root) {
  const git = (...argv) => execFileSync('git', argv, { cwd: root, stdio: 'pipe' });
  git('init', '--quiet');
  git('config', 'user.name', 'Test');
  git('config', 'user.email', 'test@example.invalid');
  git('config', 'commit.gpgsign', 'false');
  git('add', '--all');
  git('commit', '--quiet', '-m', 'baseline');
  return git;
}

for (const [name, mutate, passed, evidence] of [
  ['untouched sources', () => {}, true, /unchanged since the fixture baseline/],
  ['an uncommitted edit', (root) => write(root, 'docs/PRD.md', 'edited\n'), false, /docs\/PRD.md changed/],
  ['a committed edit', (root, git) => { write(root, 'docs/adr/0001.md', 'edited\n'); git('commit', '--quiet', '-am', 'x'); }, false, /docs\/adr\/0001.md changed/],
  ['a new file under a watched directory', (root) => write(root, 'docs/adr/0002.md', 'new\n'), false, /docs\/adr\/0002.md added/],
  ['a deleted source', (root) => fs.rmSync(path.join(root, 'CONSTRAINTS.md')), false, /CONSTRAINTS.md changed/],
  ['a change outside the watched paths', (root) => write(root, 'docs/TEST-PLAN.md', 'new\n'), true, /unchanged/],
]) {
  test(`unchanged check: ${name}`, () => {
    const root = tempDir();
    try {
      write(root, 'docs/PRD.md', 'prd\n');
      write(root, 'docs/adr/0001.md', 'adr\n');
      write(root, 'CONSTRAINTS.md', 'constraints\n');
      const git = gitBaseline(root);
      mutate(root, git);
      const out = evalChecks.BUILTIN_CHECKS.unchanged({ workspace: root, args: { paths: ['docs/PRD.md', 'docs/adr', 'CONSTRAINTS.md'] } });
      assert.equal(out.passed, passed, out.evidence);
      assert.match(out.evidence, evidence);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
}

test('unchanged check refuses a path outside the workspace', () => {
  const root = tempDir();
  try {
    write(root, 'a.md', 'a\n');
    gitBaseline(root);
    assert.throws(() => evalChecks.BUILTIN_CHECKS.unchanged({ workspace: root, args: { paths: ['../x'] } }), /escapes workspace/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

for (const [name, text, args, passed, evidence] of [
  ['an exact status line', '# Plan\n**Status:** Ready for review\n', { patterns: ['^\\*\\*Status:\\*\\* Ready for review\\s*$'] }, true, /matches all 1 pattern/],
  ['a different status', '**Status:** Draft\n', { patterns: ['^\\*\\*Status:\\*\\* Ready for review\\s*$'] }, false, /no match for/],
  ['a status with extra words', '**Status:** Ready for review (pending)\n', { patterns: ['^\\*\\*Status:\\*\\* Ready for review\\s*$'] }, false, /no match for/],
  ['a forbidden match', '**Status:** Approved\n', { forbid: ['Approved'] }, false, /forbidden match .*"Approved"/],
  ['case-insensitive headings', '## 2. test strategy\n', { patterns: ['^#+.*Test Strategy'], flags: 'mi' }, true, /matches/],
  ['a different status, with show', '# Plan\n**Status:** Draft\n', { patterns: ['^\\*\\*Status:\\*\\* Ready for review\\s*$'], show: '^\\s*\\**Status\\**:' }, false, /no match for .*; found "\*\*Status:\*\* Draft"/],
  ['a plain status line, with show', 'Status: Approved\n', { patterns: ['^\\*\\*Status:\\*\\* Ready for review\\s*$'], show: '^\\s*\\**Status\\**:' }, false, /found "Status: Approved"/],
  ['no status line, with show', '# Plan\n', { patterns: ['^\\*\\*Status:\\*\\* Draft\\s*$'], show: '^\\s*\\**Status\\**:' }, false, /no line matches \/\^\\s\*\\\*\*Status\\\*\*:\//],
  ['a pass, with show', '**Status:** Draft\n', { patterns: ['^\\*\\*Status:\\*\\* Draft\\s*$'], show: '^\\s*\\**Status\\**:' }, true, /^docs\/TEST-PLAN\.md matches all 1 pattern/],
]) {
  test(`file-matches check: ${name}`, () => {
    const root = tempDir();
    try {
      write(root, 'docs/TEST-PLAN.md', text);
      const out = evalChecks.BUILTIN_CHECKS['file-matches']({ workspace: root, args: { file: 'docs/TEST-PLAN.md', ...args } });
      assert.equal(out.passed, passed, out.evidence);
      assert.match(out.evidence, evidence);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
}

test('file-matches check fails on a missing file', () => {
  const root = tempDir();
  try {
    const out = evalChecks.BUILTIN_CHECKS['file-matches']({ workspace: root, args: { file: 'docs/TEST-PLAN.md', patterns: ['x'] } });
    assert.equal(out.passed, false);
    assert.match(out.evidence, /does not exist/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

const finalReport = (text) => traceOf({ type: 'assistant', message: { content: [] } }, { ...terminal, result: text });
for (const [name, text, passed, evidence] of [
  ['a list with one line per ID', ['Checklist:', ...Array.from({ length: 15 }, (_, i) => `- **T${i + 1}** ${i === 4 ? 'fail: BAC-3 has no VC' : 'pass'}`)].join('\n'), true, /T1–T15 each reported/],
  ['a table with one row per ID', ['| ID | Result |', '|---|---|', ...Array.from({ length: 15 }, (_, i) => `| T${i + 1} | ✅ |`)].join('\n'), true, /each reported/],
  ['a blanket all-pass', 'Checklist T1–T15: all pass.', false, /T2, T3/],
  ['a missing ID', Array.from({ length: 15 }, (_, i) => i === 9 ? 'T11 pass' : `T${i + 1}: pass`).join('\n').replace('T11 pass', 'T11: pass'), false, /T10$/],
  ['an ID without a verdict', Array.from({ length: 15 }, (_, i) => `T${i + 1}: ${i === 0 ? 'see above' : 'pass'}`).join('\n'), false, /for T1$/],
]) {
  test(`final-report-lists check: ${name}`, () => {
    const out = evalChecks.BUILTIN_CHECKS['final-report-lists']({ trace: finalReport(text), args: { prefix: 'T', from: 1, to: 15 } });
    assert.equal(out.passed, passed, out.evidence);
    assert.match(out.evidence, evidence);
  });
}

test('final-report-lists check: T1 does not satisfy T10–T15', () => {
  const text = Array.from({ length: 9 }, (_, i) => `T${i + 1}: pass`).join('\n') + '\nT1 again: pass';
  const out = evalChecks.BUILTIN_CHECKS['final-report-lists']({ trace: finalReport(text), args: { prefix: 'T', from: 1, to: 15 } });
  assert.equal(out.passed, false);
  assert.match(out.evidence, /T10, T11, T12, T13, T14, T15/);
});

test('final-report-lists check fails when the trace has no final result', () => {
  const out = evalChecks.BUILTIN_CHECKS['final-report-lists']({ trace: traceOf(call), args: { prefix: 'T', from: 1, to: 2 } });
  assert.equal(out.passed, false);
  assert.match(out.evidence, /no final result/);
});

test('markdownTables parses header and rows and strips bold and code markers', () => {
  const tables = evalChecks.markdownTables('text\n| **VC** | `State` |\n|---|:---:|\n| VC-1 | Covered |\n\n| a |\n| b |\n');
  assert.equal(tables.length, 1);
  assert.deepEqual(tables[0].header, ['VC', 'State']);
  assert.deepEqual(tables[0].rows, [['VC-1', 'Covered']]);
});

// ---------- deterministic checks: test-plan ----------

const testPlanChecks = require('../evals/checks/test-plan');

const TP_PRD = `# PRD
| ID | Requirement | Priority |
|----|-------------|----------|
| FR-1 | One | Must |
| FR-2 | Two | Must |

| ID | Linked FR | Criterion |
|----|-----------|-----------|
| BAC-1 | FR-1 | First. |
| BAC-2 | FR-2 | Second. |
`;
const tpPlan = ({ vc2State = 'Covered', bac2Row = '| BAC-2 | FR-2 | VC-2 | two | Covered |' } = {}) => `# Test Plan
**Status:** Ready for review

## 3. Verification Criteria
| VC | Proves | Criterion (pass/fail) | Level | Method | Doubles | Scenarios / reason | State |
|----|--------|-----------------------|-------|--------|---------|--------------------|-------|
| VC-1 | BAC-1 | x | unit | Scenario | none | one | Covered |
| VC-2 | BAC-2 | x | e2e | Scenario | none | two | ${vc2State} |
| VC-3 | N-1 | x | unit | Tool check | none | lint rule | Manual |

## 4. Coverage Matrix
| BAC | FR | VCs | Scenarios | State |
|-----|----|-----|-----------|-------|
| BAC-1 | FR-1 | VC-1 | one | Covered |
${bac2Row}
`;
const tpFeature = ({ twoTags = '@FR-2 @BAC-2 @VC-2', step = 'When the account manager opens "Acme"' } = {}) => `@F1
Feature: F1 Accounts
  Background:
    Given the date is 2026-03-02 and the time is 09:00 in "Asia/Kolkata"

  @FR-1 @BAC-1 @VC-1
  Scenario: one
    Given an account "Acme" held its QBR on 10/01/2026 and/or later
    ${step}
    Then they see "Acme"

  ${twoTags}
  Scenario Outline: two
    When the item is <state>
    Then it shows <state>

    Examples:
      | state |
      | open  |
`;

function tpWorkspace(parts = {}) {
  const root = tempDir();
  write(root, 'docs/PRD.md', parts.prd ?? TP_PRD);
  if (parts.plan !== null) write(root, 'docs/TEST-PLAN.md', parts.plan ?? tpPlan());
  if (parts.feature !== null) write(root, 'tests/features/f1-accounts.feature', parts.feature ?? tpFeature());
  if (parts.constraints) write(root, 'CONSTRAINTS.md', parts.constraints);
  return root;
}

function runTp(name, parts, args = {}) {
  const root = tpWorkspace(parts);
  try {
    return testPlanChecks[name]({ workspace: root, trace: '', args });
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}

test('test-plan checks all pass on a consistent plan and feature set', () => {
  for (const name of ['coverage-has-all-bacs', 'tags-exist', 'matrix-tags-agree', 'steps-clean']) {
    const out = runTp(name, {}, name === 'steps-clean' ? { forbidden: ['PostgreSQL', 'Node.js'] } : {});
    assert.equal(out.passed, true, `${name}: ${out.evidence}`);
  }
});

for (const [name, parts, args, evidence] of [
  ['a BAC missing from the matrix', { plan: tpPlan({ bac2Row: '' }) }, {}, /BAC-2 has no coverage-matrix row/],
  ['a BAC row with no VC', { plan: tpPlan({ bac2Row: '| BAC-2 | FR-2 | — | — | Pending architecture |' }) }, {}, /BAC-2 lists no VC \(State "Pending architecture"\)/],
  ['a missing plan', { plan: null }, {}, /TEST-PLAN.md does not exist/],
]) {
  test(`coverage-has-all-bacs fails on ${name}`, () => {
    const out = runTp('coverage-has-all-bacs', parts, args);
    assert.equal(out.passed, false);
    assert.match(out.evidence, evidence);
  });
}

test('coverage-has-all-bacs lets an allowed State list no VC', () => {
  const out = runTp('coverage-has-all-bacs', { plan: tpPlan({ bac2Row: '| BAC-2 | FR-2 | — | — | Blocked (PRD OQ 1) |' }) }, { allowNoVcStates: ['Blocked'] });
  assert.equal(out.passed, true, out.evidence);
});

for (const [name, parts, evidence] of [
  ['a scenario without a VC tag', { feature: tpFeature({ twoTags: '@FR-2 @BAC-2' }) }, /"two" has no @VC- tag/],
  ['a BAC tag the PRD does not define', { feature: tpFeature({ twoTags: '@FR-2 @BAC-9 @VC-2' }) }, /@BAC-9 is not defined in the PRD/],
  ['a VC tag the plan does not define', { feature: tpFeature({ twoTags: '@FR-2 @BAC-2 @VC-7' }) }, /@VC-7 is not in the VC table/],
  ['no feature files', { feature: null }, /no scenarios under tests\/features/],
]) {
  test(`tags-exist fails on ${name}`, () => {
    const out = runTp('tags-exist', parts);
    assert.equal(out.passed, false);
    assert.match(out.evidence, evidence);
  });
}

test('tags-exist counts feature-level and Examples tags', () => {
  const feature = tpFeature({ twoTags: '@BAC-2' }).replace('@F1\n', '@F1 @FR-2\n').replace('    Examples:', '    @VC-2\n    Examples:');
  const out = runTp('tags-exist', { feature });
  assert.equal(out.passed, true, out.evidence);
});

for (const [name, parts, evidence] of [
  ['a Covered VC no scenario is tagged with', { feature: tpFeature({ twoTags: '@FR-2 @BAC-2 @VC-1' }) }, /VC-2 is Covered but no scenario is tagged @VC-2/],
  ['a scenario tag whose VC proves another BAC', { feature: tpFeature({ twoTags: '@FR-2 @BAC-2 @VC-1' }) }, /@VC-1 proves BAC-1 but the scenario is tagged @BAC-2/],
  ['a BAC tag whose matrix row lists none of the scenario\'s VCs', { feature: tpFeature({ twoTags: '@FR-2 @BAC-2 @VC-1' }) }, /@BAC-2 with @VC-1, but matrix row BAC-2 lists VC-2/],
  ['a scenario tagged with a Blocked VC', { plan: tpPlan({ vc2State: 'Blocked (PRD OQ 1)' }) }, /tagged @VC-2, which is Blocked \(PRD OQ 1\)/],
  ['a scenario tagged with a BAC missing from the matrix', { plan: tpPlan({ bac2Row: '' }) }, /@BAC-2 has no coverage-matrix row/],
]) {
  test(`matrix-tags-agree fails on ${name}`, () => {
    const out = runTp('matrix-tags-agree', parts);
    assert.equal(out.passed, false);
    assert.match(out.evidence, evidence);
  });
}

for (const [name, step, evidence] of [
  ['a URL', 'When they open https://qbr.example/accounts', /URL "https:\/\/"/],
  ['an HTTP verb', 'When the client sends POST for the account', /HTTP verb "POST"/],
  ['an endpoint path', 'When the account manager calls /api/accounts', /endpoint path "\/api"/],
  ['a status code', 'Then the response is status 403', /HTTP status "status 403"/],
  ['a data attribute selector', 'When they click [data-testid="save"]', /selector/],
  ['an id selector', 'When they click #save-button', /selector "#save-button"/],
  ['a forbidden stack name', 'Given the PostgreSQL table has an account', /PostgreSQL "PostgreSQL"/],
]) {
  test(`steps-clean fails on ${name}`, () => {
    const out = runTp('steps-clean', { feature: tpFeature({ step }) }, { forbidden: ['PostgreSQL', 'Node.js'] });
    assert.equal(out.passed, false);
    assert.match(out.evidence, evidence);
  });
}

test('steps-clean checks data tables and doc strings, not tags or comments', () => {
  const feature = tpFeature().replace('      | open  |', '      | open  |\n      | https://x.example |');
  assert.match(runTp('steps-clean', { feature }).evidence, /URL/);
  const docString = tpFeature({ step: 'When they write:\n      """\n      GET the list\n      """' });
  assert.match(runTp('steps-clean', { feature: docString }).evidence, /HTTP verb "GET"/);
  const comment = tpFeature().replace('  Background:', '  # see https://wiki.example/qbr\n  Background:');
  assert.equal(runTp('steps-clean', { feature: comment }).passed, true);
});

test('steps-clean does not flag dates, times or a stack name inside another word', () => {
  const out = runTp('steps-clean', { feature: tpFeature({ step: 'When the node owner opens the account on 2026/03/10 at 09:00' }) }, { forbidden: ['Node.js'] });
  assert.equal(out.passed, true, out.evidence);
});

const nnScenario = (tags) => `\n  ${tags}\n  Scenario: no outside email\n    Then no email goes to an outside address\n`;

test('tags-exist accepts @NN- or @N- in place of @BAC- on a Non-Negotiable scenario', () => {
  for (const tags of ['@NN-no-outside-email @VC-3', '@N-1 @VC-3']) {
    const out = runTp('tags-exist', { feature: tpFeature() + nnScenario(tags) });
    assert.equal(out.passed, true, `${tags}: ${out.evidence}`);
  }
});

for (const [name, tags, parts, evidence] of [
  ['a scenario with no proof tag', '@VC-3', {}, /"no outside email" has no proof tag \(@BAC-, @NN-, @N-, @NFR- or @EDGE-\)/],
  ['a BAC tag without its FR tag', '@BAC-1 @VC-1', {}, /"no outside email" has a @BAC- tag but no @FR- tag/],
  ['an @N- tag CONSTRAINTS.md does not define', '@N-9 @VC-3', { constraints: '| ID | Rule | Checked by |\n|---|---|---|\n| N-1 | x | lint |\n' }, /@N-9 is not a row in CONSTRAINTS.md/],
]) {
  test(`tags-exist fails on ${name}`, () => {
    const out = runTp('tags-exist', { feature: tpFeature() + nnScenario(tags), ...parts });
    assert.equal(out.passed, false);
    assert.match(out.evidence, evidence);
  });
}

const EDGE_PRD = `${TP_PRD}
## 10. Edge Cases & Failure Scenarios
| # | Scenario | Expected Behavior |
|---|----------|--------------------|
| 1 | A user has no time zone set | IST is used. |
| 2 | The CRM cannot be read | The tool keeps working on the last data. |

## 11. Out of Scope
| # | Item |
|---|------|
| 3 | Mobile layouts |
`;

test('tags-exist accepts @NFR- or @EDGE- alone as a scenario\'s proof tag', () => {
  for (const tags of ['@NFR-email-timing @VC-3', '@EDGE-2 @VC-3', '@FR-1 @BAC-1 @NFR-email-timing @EDGE-1 @VC-1']) {
    const out = runTp('tags-exist', { prd: EDGE_PRD, feature: tpFeature() + nnScenario(tags) });
    assert.equal(out.passed, true, `${tags}: ${out.evidence}`);
  }
});

test('tags-exist fails an @EDGE-n beyond the PRD\'s section 10 edge cases', () => {
  // EDGE-3 is a row number in section 11, not an edge case.
  const out = runTp('tags-exist', { prd: EDGE_PRD, feature: tpFeature() + nnScenario('@EDGE-3 @VC-3') });
  assert.equal(out.passed, false);
  assert.match(out.evidence, /@EDGE-3 is not an edge case in PRD section 10 \(it numbers 1, 2\)/);
});

test('tags-exist does not check @EDGE- tags when the PRD has no parseable section 10', () => {
  assert.equal(runTp('tags-exist', { feature: tpFeature() + nnScenario('@EDGE-9 @VC-3') }).passed, true);
});

test('matrix-tags-agree treats @NFR- and @EDGE- like @NN-: no BAC-matrix claim', () => {
  const out = runTp('matrix-tags-agree', { prd: EDGE_PRD, feature: tpFeature() + nnScenario('@NFR-email-timing @EDGE-1 @VC-3') });
  assert.equal(out.passed, true, out.evidence);
});

test('tags-exist does not check @N- tags when there is no CONSTRAINTS.md', () => {
  assert.equal(runTp('tags-exist', { feature: tpFeature() + nnScenario('@N-9 @VC-3') }).passed, true);
});

test('tags-exist require overrides the default tagging rule', () => {
  const out = runTp('tags-exist', { feature: tpFeature() + nnScenario('@NN-no-outside-email @VC-3') }, { require: ['FR', 'BAC', 'VC'] });
  assert.equal(out.passed, false);
  assert.match(out.evidence, /"no outside email" has no @FR- tag/);
});

test('matrix-tags-agree accepts a Non-Negotiable scenario tagged @NN- with no BAC tag', () => {
  const out = runTp('matrix-tags-agree', { feature: tpFeature() + nnScenario('@NN-no-outside-email @VC-3') });
  assert.equal(out.passed, true, out.evidence);
});

test('matrix-tags-agree treats a BAC tag on a Non-Negotiable scenario as a matrix claim', () => {
  const out = runTp('matrix-tags-agree', { feature: tpFeature() + nnScenario('@FR-1 @BAC-1 @VC-3') });
  assert.equal(out.passed, false);
  assert.match(out.evidence, /@BAC-1 with @VC-3, but matrix row BAC-1 lists VC-1/);
});

test('matrix-tags-agree does not require a scenario for Tool check, Manual or Non-functional VCs', () => {
  for (const row of [
    '| VC-3 | N-1 | x | unit | Tool check | none | lint rule | Covered |',
    '| VC-3 | N-1 | x | unit | Scenario | none | lint rule | Tool check |',
    '| VC-3 | N-1 | x | unit | Manual | none | reviewer | Covered |',
    '| VC-3 | NFR | x | non-functional | Scenario | none | load test | Non-functional |',
  ]) {
    const plan = tpPlan().replace('| VC-3 | N-1 | x | unit | Tool check | none | lint rule | Manual |', row);
    const out = runTp('matrix-tags-agree', { plan });
    assert.equal(out.passed, true, `${row}: ${out.evidence}`);
  }
  // A Scenario-method VC marked Covered with no tagged scenario still fails.
  const plan = tpPlan().replace('| VC-3 | N-1 | x | unit | Tool check | none | lint rule | Manual |', '| VC-3 | N-1 | x | unit | Scenario | none | x | Covered |');
  assert.match(runTp('matrix-tags-agree', { plan }).evidence, /VC-3 is Covered but no scenario is tagged @VC-3/);
});

test('checks run against the eval\'s single fixture directory, where the agent works', () => {
  const root = makeSandbox();
  try {
    const checksModule = `
      const { readText } = require('../../scripts/lib/eval-checks');
      module.exports = { 'sees-fixture': ({ workspace }) => ({ passed: readText(workspace, 'context.txt') === 'fixture\\n', evidence: workspace }) };
    `;
    const result = runBehavioralWithGrading(root, passingGrading, {
      checksModule,
      evalFields: { 1: { kind: 'execution', files: ['project'], checks: [check('C1', 'sees-fixture')] } },
    });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const grading = JSON.parse(fs.readFileSync(path.join(root, 'evals/results/alpha-skill.eval-1.grading.json'), 'utf8'));
    assert.match(grading.checks[0].evidence, /[/\\]project$/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('tags-exist mustTag requires a scenario carrying each listed ID', () => {
  assert.equal(runTp('tags-exist', {}, { mustTag: ['BAC-2'] }).passed, true);
  const out = runTp('tags-exist', { feature: tpFeature({ twoTags: '@FR-1 @BAC-1 @VC-1' }) }, { mustTag: ['BAC-2'] });
  assert.equal(out.passed, false);
  assert.match(out.evidence, /no scenario is tagged @BAC-2/);
});

// A Draft plan for an In Review PRD with three BACs and two blocking
// questions: OQ 1 names BAC-3 directly, OQ 2 names FR-2 (BAC-2), and the
// "CRM is the source" Non-Negotiable is blocked by OQ 3.
const DRAFT_PRD = `${TP_PRD}| BAC-3 | FR-2 | Third, quickly and clearly. |
`;
const draftPlan = ({ bac1 = 'Covered', bac2 = 'Blocked (PRD OQ 2, via FR-2)', bac3 = 'Blocked (untestable)', nn = 'Blocked (PRD OQ 3)', vc4Level = 'integration', vc4State = 'Pending architecture', questions } = {}) => `# Test Plan
**Status:** Draft

## 3. Verification Criteria
| VC | Proves | Criterion (pass/fail) | Level | Method | Doubles | Scenarios / reason | State |
|----|--------|-----------------------|-------|--------|---------|--------------------|-------|
| VC-1 | BAC-1 | x | unit | Scenario | none | one | Covered |
| VC-2 | BAC-2 | x | e2e | Scenario | provisional | blocked | ${bac2} |
| VC-3 | Non-Negotiable: CRM is the source of account data | x | integration | Scenario | provisional | blocked | ${nn} |
| VC-4 | BAC-1 | sync within 24 h | ${vc4Level} | Scenario | provisional | sync | ${vc4State} |

## 4. Coverage Matrix
| BAC | FR | VCs | Scenarios | State |
|-----|----|-----|-----------|-------|
| BAC-1 | FR-1 | VC-1, VC-4 | one | ${bac1} |
| BAC-2 | FR-2 | VC-2 | — | ${bac2} |
| BAC-3 | FR-2 | — | — | ${bac3} |

## 8. Open Questions
| # | Question | Owner | Blocking? | Blocks |
|---|----------|-------|-----------|--------|
${questions ?? `| 1 | What does "quickly and clearly" mean for BAC-3? | PRD approver (via the BA) | Yes | BAC-3 |
| 2 | Which browsers? | Elena Brandt | No | — |`}
`;
const draftFeature = (tags = '@FR-1 @BAC-1 @VC-1') => `Feature: F1 Accounts
  ${tags}
  Scenario: one
    Given an account "Acme"
    Then they see "Acme"
`;
const BLOCKED_ARGS = { blocked: { 'BAC-2': [2] }, untestable: ['BAC-3'], nonNegotiables: [{ name: 'CRM is the source of account data', oqs: [3] }] };
const draft = (overrides = {}) => ({ prd: DRAFT_PRD, plan: draftPlan(overrides), feature: draftFeature(overrides.tags) });

test('blocked-as-expected passes on the expected blocks and citations', () => {
  const out = runTp('blocked-as-expected', draft(), BLOCKED_ARGS);
  assert.equal(out.passed, true, out.evidence);
});

for (const [name, overrides, evidence] of [
  ['a generic block without the OQ number', { bac2: 'Blocked (open questions)' }, /BAC-2 State "Blocked \(open questions\)" does not cite OQ 2/],
  ['the wrong OQ', { bac2: 'Blocked (PRD OQ 1)' }, /does not cite OQ 2/],
  ['an expected block left Covered', { bac2: 'Covered' }, /BAC-2 should be Blocked citing OQ 2, State is "Covered"/],
  ['an extra block', { bac1: 'Blocked (PRD OQ 3)' }, /BAC-1 is "Blocked \(PRD OQ 3\)" but no open question blocks it/],
  ['an untestable BAC given a threshold instead', { bac3: 'Covered' }, /BAC-3 should be Blocked \(untestable\)/],
  ['a blocked BAC with a scenario', { tags: '@FR-2 @BAC-2 @VC-1' }, /BAC-2 is blocked but a scenario is tagged @BAC-2/],
  ['a Non-Negotiable VC not blocked by its question', { nn: 'Pending architecture' }, /VC-3 proves "CRM is the source of account data" and should be Blocked citing OQ 3/],
]) {
  test(`blocked-as-expected fails on ${name}`, () => {
    const out = runTp('blocked-as-expected', draft(overrides), BLOCKED_ARGS);
    assert.equal(out.passed, false);
    assert.match(out.evidence, evidence);
  });
}

test('blocked-as-expected reads OQ lists in several forms', () => {
  for (const state of ['Blocked (PRD OQ 1, OQ 8)', 'Blocked (OQs 1 and 8)', 'Blocked (PRD OQ 8; OQ 1)', 'Blocked (OQ #1 / 8)']) {
    const out = runTp('blocked-as-expected', draft({ bac2: state }), { ...BLOCKED_ARGS, blocked: { 'BAC-2': [1, 8] } });
    assert.equal(out.passed, true, `${state}: ${out.evidence}`);
  }
});

test('blocked-as-expected fails when no VC proves the Non-Negotiable', () => {
  const out = runTp('blocked-as-expected', draft(), { ...BLOCKED_ARGS, nonNegotiables: [{ name: 'No outside email', oqs: [3] }] });
  assert.equal(out.passed, false);
  assert.match(out.evidence, /no VC proves "No outside email"/);
});

// BAC-1 in the draft plan depends on the CRM, so with bacs: ['BAC-1'] every
// VC proving it (VC-1 and VC-4) must wait for the architecture.
const pendingBac1 = (overrides = {}) => {
  const parts = draft(overrides);
  return { ...parts, plan: parts.plan.replace('| VC-1 | BAC-1 | x | unit | Scenario | none | one | Covered |', `| VC-1 | BAC-1 | x | ${overrides.vc1Level ?? 'unit'} | Scenario | provisional | one | ${overrides.vc1State ?? 'Pending architecture'} |`) };
};

test('integration-pending passes when integration-dependent VCs wait for the architecture, whatever their Level', () => {
  for (const vc4Level of ['integration', 'e2e', 'unit']) {
    const out = runTp('integration-pending', pendingBac1({ vc4Level }), { bacs: ['BAC-1'] });
    assert.equal(out.passed, true, `${vc4Level}: ${out.evidence}`);
  }
  assert.equal(runTp('integration-pending', pendingBac1({ vc1State: 'Blocked (PRD OQ 4)' }), { bacs: ['BAC-1'] }).passed, true);
});

test('integration-pending lets a VC of an unlisted BAC at a non-integration Level be Covered', () => {
  const out = runTp('integration-pending', draft(), {});
  assert.equal(out.passed, true, out.evidence);
});

for (const [name, overrides, evidence] of [
  ['a Covered integration-level VC', { vc4State: 'Covered' }, /VC-4 proves BAC-1, which depends on an external system, but has State "Covered" \(Proves "BAC-1", Level "integration", Doubles "provisional"\)/],
  ['a listed BAC\'s VC levelled e2e and Covered', { vc4Level: 'e2e', vc4State: 'Covered' }, /VC-4 proves BAC-1, which depends on an external system, but has State "Covered" \(Proves "BAC-1", Level "e2e", Doubles "provisional"\)/],
  ['a listed BAC\'s VC levelled unit and Covered', { vc1State: 'Covered' }, /VC-1 proves BAC-1, which depends on an external system, but has State "Covered" \(Proves "BAC-1", Level "unit", Doubles "provisional"\)/],
]) {
  test(`integration-pending fails on ${name}`, () => {
    const out = runTp('integration-pending', pendingBac1(overrides), { bacs: ['BAC-1'] });
    assert.equal(out.passed, false);
    assert.match(out.evidence, evidence);
  });
}

test('integration-pending flags a Covered integration-level VC of an unlisted BAC', () => {
  const out = runTp('integration-pending', draft({ vc4State: 'Covered' }), {});
  assert.equal(out.passed, false);
  assert.match(out.evidence, /VC-4 is integration-level with State "Covered" \(Proves "BAC-1", Level "integration", Doubles "provisional"\)/);
});

test('integration-pending reports a non-BAC Proves and a missing Doubles column', () => {
  const plan = draftPlan().replace('| VC-3 | Non-Negotiable: CRM is the source of account data | x | integration | Scenario | provisional | blocked | Blocked (PRD OQ 3) |',
    '| VC-3 | Non-Negotiable: CRM is the source of account data | x | integration | Scenario | fake CRM | blocked | Covered |');
  const out = runTp('integration-pending', { ...draft(), plan }, {});
  assert.equal(out.passed, false);
  assert.match(out.evidence, /VC-3 is integration-level with State "Covered" \(Proves "Non-Negotiable: CRM is the source of account data", Level "integration", Doubles "fake CRM"\)/);
  const noDoubles = plan.replace('| Method | Doubles |', '| Method | Fakes |');
  assert.match(runTp('integration-pending', { ...draft(), plan: noDoubles }, {}).evidence, /VC-3 is integration-level with State "Covered" \(.*Doubles "none"\)/);
});

test('integration-pending fails when a listed BAC has no VC', () => {
  const out = runTp('integration-pending', pendingBac1(), { bacs: ['BAC-1', 'BAC-3'] });
  assert.equal(out.passed, false);
  assert.match(out.evidence, /BAC-3 has no VC/);
});

test('open-questions-shape passes on owned, flagged rows with Blocks IDs', () => {
  const out = runTp('open-questions-shape', draft(), { mustBlock: ['BAC-3'] });
  assert.equal(out.passed, true, out.evidence);
});

for (const [name, questions, evidence] of [
  ['a row with no owner', '| 1 | What does it mean? |  | Yes | BAC-3 |', /row 1 has no owner/],
  ['a row with no blocking flag', '| 1 | What does it mean? | BA | Maybe | BAC-3 |', /row 1 Blocking\? is "Maybe"/],
  ['a blocking row with IDs only in the question', '| 1 | What does BAC-3 mean? | BA | Yes | — |', /row 1 is blocking but lists no IDs in Blocks/],
  ['a vague BAC nobody routed', '| 1 | Which browsers? | BA | Yes | VC-2 |', /no blocking question lists BAC-3 in Blocks/],
]) {
  test(`open-questions-shape fails on ${name}`, () => {
    const out = runTp('open-questions-shape', draft({ questions }), { mustBlock: ['BAC-3'] });
    assert.equal(out.passed, false);
    assert.match(out.evidence, evidence);
  });
}

test('open-questions-shape fails without a Blocks column', () => {
  const plan = draftPlan().replace('| # | Question | Owner | Blocking? | Blocks |', '| # | Question | Owner | Blocking? | Notes |');
  const out = runTp('open-questions-shape', { prd: DRAFT_PRD, plan, feature: draftFeature() }, {});
  assert.equal(out.passed, false);
  assert.match(out.evidence, /no Open Questions table with Owner and Blocks columns/);
});

for (const args of [['--eval'], ['--eval', 'not-a-number'], ['--eval', '1.5'], ['--eval', '9007199254740993']]) {
  test(`rejects an invalid behavioral selector ${JSON.stringify(args)}`, () => {
    const root = makeSandbox();
    try {
      const result = run(root, ['--behavioral', 'alpha-skill', ...args]);
      assert.equal(result.status, 1, result.stdout + result.stderr);
      assert.match(result.stderr, /--eval must be an integer case id/);
      assert.equal(fs.existsSync(path.join(root, 'evals/results')), false);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
}

test('rejects an unknown behavioral case before creating results', () => {
  const root = makeSandbox();
  try {
    const result = runBehavioralWithGrading(root, '{}', { args: ['--eval', '99'] });
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stderr, /has no behavioral eval id=99/);
    assert.equal(fs.existsSync(path.join(root, 'evals/results')), false);
    assert.equal(fs.existsSync(path.join(root, 'claude-calls.txt')), false);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('a selector does not hide duplicate IDs among unselected cases', () => {
  const root = makeSandbox();
  try {
    const result = runBehavioralWithGrading(root, '{}', { args: ['--eval', '0'], ids: [0, 2, 2] });
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stderr, /duplicate behavioral eval id=2/);
    assert.equal(fs.existsSync(path.join(root, 'evals/results')), false);
    assert.equal(fs.existsSync(path.join(root, 'claude-calls.txt')), false);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('--eval is available only for behavioral runs', () => {
  const root = makeSandbox();
  try {
    const result = run(root, ['--eval', '1']);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stderr, /--eval applies only to behavioral evals/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

for (const passed of [true, false]) {
  for (const evidence of ['', ' \t\r\n', '\u00a0\u2003']) {
    test(`behavioral CLI diagnoses blank evidence for ${passed ? 'passing' : 'failing'} verdict ${JSON.stringify(evidence)}`, () => {
      const root = makeSandbox();
      try {
        const raw = JSON.stringify({
          expectations: [{ id: 1, text: 'check the result', passed, evidence }],
          summary: { passed: Number(passed), failed: Number(!passed), total: 1, pass_rate: Number(passed) },
        });
        const base = path.join(root, 'evals', 'results', 'alpha-skill.eval-1');
        writeJson(`${base}.grading.json`, { stale: true });

        const result = runBehavioralWithGrading(root, raw);

        assert.equal(result.status, 1, result.stdout + result.stderr);
        assert.match(result.stdout, /grader returned blank evidence/);
        assert.doesNotMatch(result.stdout, /invalid JSON/);
        assert.match(result.stdout, /raw saved to .*alpha-skill\.eval-1\.grading\.raw\.txt/);
        assert.equal(fs.readFileSync(`${base}.grading.raw.txt`, 'utf8'), raw);
        assert.equal(fs.existsSync(`${base}.grading.json`), false);
      } finally {
        fs.rmSync(root, { recursive: true, force: true });
      }
    });
  }
}

for (const raw of ['not JSON', '{"expectations":', '{"expectations":[]}']) {
  test(`behavioral CLI retains the generic diagnostic for invalid grading ${raw}`, () => {
    const root = makeSandbox();
    try {
      const result = runBehavioralWithGrading(root, raw);
      assert.equal(result.status, 1, result.stdout + result.stderr);
      assert.match(result.stdout, /grader returned invalid JSON/);
      assert.doesNotMatch(result.stdout, /blank evidence/);
      const base = path.join(root, 'evals', 'results', 'alpha-skill.eval-1');
      assert.equal(fs.readFileSync(`${base}.grading.raw.txt`, 'utf8'), raw);
      assert.equal(fs.existsSync(`${base}.grading.json`), false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
}

test('behavioral CLI still publishes valid grading without a rejection diagnostic', () => {
  const root = makeSandbox();
  try {
    const evidence = '  observed in the trace  ';
    const raw = JSON.stringify({
      expectations: [{ id: 1, text: 'check the result', passed: true, evidence }],
      summary: { passed: 1, failed: 0, total: 1, pass_rate: 1 },
    });
    const result = runBehavioralWithGrading(root, raw);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.doesNotMatch(result.stdout, /grader returned/);
    const base = path.join(root, 'evals', 'results', 'alpha-skill.eval-1');
    const grading = JSON.parse(fs.readFileSync(`${base}.grading.json`, 'utf8'));
    assert.equal(grading.expectations[0].evidence, evidence);
    assert.equal(fs.existsSync(`${base}.grading.raw.txt`), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('accepts a complete and consistent grader result', () => {
  const raw = JSON.stringify({
    expectations: [
      { id: 1, text: 'first expectation', passed: true, evidence: 'observed in the trace' },
      { id: 2, text: 'second expectation', passed: false, evidence: 'not observed in the trace' },
    ],
    summary: { passed: 1, failed: 1, total: 2, pass_rate: 0.5 },
  });

  assert.deepEqual(parseGrading(raw, ['first expectation', 'second expectation']), JSON.parse(raw));
});

for (const passed of [true, false]) {
  for (const evidence of ['', ' \t\r\n', '\u00a0\u2003']) {
    test(`rejects ${passed ? 'passing' : 'failing'} grading with blank evidence ${JSON.stringify(evidence)}`, () => {
      const raw = JSON.stringify({
        expectations: [{ id: 1, text: 'check the result', passed, evidence }],
        summary: { passed: Number(passed), failed: Number(!passed), total: 1, pass_rate: Number(passed) },
      });
      assert.equal(parseGrading(raw, ['check the result']), null);
    });
  }
}

test('preserves nonblank evidence including surrounding whitespace', () => {
  const evidence = '  No matching tool call was found.\n';
  const raw = JSON.stringify({
    expectations: [{ id: 1, text: 'check the result', passed: false, evidence }],
    summary: { passed: 0, failed: 1, total: 1, pass_rate: 0 },
  });
  assert.equal(parseGrading(raw, ['check the result']).expectations[0].evidence, evidence);
});

test('blank evidence retains raw grading without publishing a scored artifact', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'grading-blank-evidence-'));
  try {
    const base = path.join(dir, 'my-skill.eval-1');
    const raw = JSON.stringify({
      expectations: [{ id: 1, text: 'check the result', passed: true, evidence: '' }],
      summary: { passed: 1, failed: 0, total: 1, pass_rate: 1 },
    });
    clearGradingSlot(base);
    assert.equal(persistGradingOutcome(base, parseGrading(raw, ['check the result']), raw), false);
    assert.equal(fs.existsSync(`${base}.grading.json`), false);
    assert.equal(fs.readFileSync(`${base}.grading.raw.txt`, 'utf8'), raw);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('rejects grader results that omit expectations', () => {
  const raw = JSON.stringify({
    expectations: [
      { id: 1, text: 'first expectation', passed: true, evidence: 'observed in the trace' },
    ],
    summary: { passed: 1, failed: 0, total: 1, pass_rate: 1 },
  });

  assert.equal(parseGrading(raw, ['first expectation', 'second expectation']), null);
});

test('rejects null expectation entries without throwing', () => {
  const cases = [
    { results: [null], declared: ['first expectation'] },
    { results: [{ id: 1, text: 'first expectation', passed: true, evidence: 'observed' }, null], declared: ['first expectation', 'second expectation'] },
  ];
  for (const { results, declared } of cases) {
    const raw = JSON.stringify({
      expectations: results,
      summary: {
        passed: results.length - 1,
        failed: 1,
        total: results.length,
        pass_rate: (results.length - 1) / results.length,
      },
    });

    assert.equal(parseGrading(raw, declared), null);
  }
});

test('rejects incomplete or inconsistent grader summaries', () => {
  const declared = ['expected behavior'];
  const expectation = { id: 1, text: 'expected behavior', passed: false, evidence: 'not observed' };
  const cases = [
    {
      expectations: [],
      summary: { passed: 0, failed: 0, total: 0, pass_rate: 0 },
      declared: [],
    },
    {
      expectations: [{ id: 1, text: 'expected behavior', passed: false }],
      summary: { passed: 0, failed: 1, total: 1, pass_rate: 0 },
      declared,
    },
    {
      expectations: [expectation],
      summary: { passed: 1, failed: 0, total: 1, pass_rate: 1 },
      declared,
    },
    {
      expectations: [expectation],
      summary: { passed: 0, total: 1, pass_rate: 0 },
      declared,
    },
    {
      expectations: [expectation],
      summary: { passed: 0, failed: 1, total: 1 },
      declared,
    },
  ];

  for (const { declared: d, ...grading } of cases) {
    assert.equal(parseGrading(JSON.stringify(grading), d), null);
  }
});

test('names a positive prompt that passes top_k but does not rank first', () => {
  const root = makeSandbox();
  writeSkill(root, 'alpha-skill', 'Handles alpha widgets. Use when changing alpha widgets.');
  writeSkill(root, 'beta-skill', 'Tunes widget caches. Use when tuning the widget cache for alpha.');
  writeJson(
    path.join(root, 'evals', 'cases', 'alpha-skill.json'),
    completeCase('alpha-skill', 'tune the alpha widget cache', 3),
  );
  writeJson(
    path.join(root, 'evals', 'cases', 'beta-skill.json'),
    completeCase('beta-skill', 'tune the widget cache', 1),
  );

  const result = run(root);

  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /alpha-skill: positive prompt ranked #2, inside top 3 but not first/);
  assert.match(result.stdout, /#1: beta-skill \(\d\.\d{3}\) vs \d\.\d{3}/);
  assert.match(result.stdout, /rank-1 rate: 50% \(3\/6/);
});

test('fails when a skill has no eval case file', () => {
  const root = makeSandbox();
  writeSkill(root, 'alpha-skill', 'Handles alpha widgets. Use when changing alpha widgets.');

  const result = run(root);

  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout, /no eval case file/);
});

test('fails when an eval case is below the required minimums', () => {
  const root = makeSandbox();
  writeSkill(root, 'alpha-skill', 'Handles alpha widgets. Use when changing alpha widgets.');
  writeJson(path.join(root, 'evals', 'cases', 'alpha-skill.json'), {
    skill_name: 'alpha-skill',
    trigger: {
      positive: [{ prompt: 'change alpha widget', top_k: 1 }],
      negative: [],
    },
    evals: [behavioralEval()],
  });

  const result = run(root);

  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout, /below required minimums/);
});

test('fails when a behavioral eval references a missing fixture', () => {
  const root = makeSandbox();
  writeSkill(root, 'alpha-skill', 'Handles alpha widgets. Use when changing alpha widgets.');
  writeJson(
    path.join(root, 'evals', 'cases', 'alpha-skill.json'),
    completeCase('alpha-skill', 'change alpha widget', 1, ['missing/project.txt']),
  );

  const result = run(root);

  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout, /fixture not found/);
});

test('requires fixtures for execution evals', () => {
  const root = makeSandbox();
  writeSkill(root, 'alpha-skill', 'Handles alpha widgets. Use when changing alpha widgets.');
  writeJson(
    path.join(root, 'evals', 'cases', 'alpha-skill.json'),
    completeCase('alpha-skill', 'change alpha widget', 1, []),
  );

  const result = run(root);

  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout, /needs a non-empty files\[\] fixture list/);
});

test('allows dialogue evals without fixtures', () => {
  const root = makeSandbox();
  writeSkill(root, 'alpha-skill', 'Handles alpha widgets. Use when changing alpha widgets.');
  const evalCase = completeCase('alpha-skill', 'change alpha widget');
  evalCase.evals = [{ ...behavioralEval([]), kind: 'dialogue' }];
  writeJson(path.join(root, 'evals', 'cases', 'alpha-skill.json'), evalCase);

  const result = run(root);

  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('rejects provisional execution evals', () => {
  const root = makeSandbox();
  writeSkill(root, 'alpha-skill', 'Handles alpha widgets. Use when changing alpha widgets.');
  const evalCase = completeCase('alpha-skill', 'change alpha widget');
  evalCase.evals[0].trust_level = 'provisional';
  writeJson(path.join(root, 'evals', 'cases', 'alpha-skill.json'), evalCase);

  const result = run(root);

  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout, /is still provisional/);
});

test('allows dialogue evals with a legacy provisional marker', () => {
  const root = makeSandbox();
  writeSkill(root, 'alpha-skill', 'Handles alpha widgets. Use when changing alpha widgets.');
  const evalCase = completeCase('alpha-skill', 'change alpha widget');
  evalCase.evals = [{ ...behavioralEval([]), kind: 'dialogue', trust_level: 'provisional' }];
  writeJson(path.join(root, 'evals', 'cases', 'alpha-skill.json'), evalCase);

  const result = run(root);

  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('rejects unknown behavioral eval kinds', () => {
  const root = makeSandbox();
  writeSkill(root, 'alpha-skill', 'Handles alpha widgets. Use when changing alpha widgets.');
  const evalCase = completeCase('alpha-skill', 'change alpha widget');
  evalCase.evals[0].kind = 'conversation';
  writeJson(path.join(root, 'evals', 'cases', 'alpha-skill.json'), evalCase);

  const result = run(root);

  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout, /unknown kind "conversation"/);
});

test('dry-runs a fixtureless dialogue eval', () => {
  const root = makeSandbox();
  writeSkill(root, 'alpha-skill', 'Handles alpha widgets. Use when changing alpha widgets.');
  const evalCase = completeCase('alpha-skill', 'change alpha widget');
  evalCase.evals = [{ ...behavioralEval([]), kind: 'dialogue' }];
  writeJson(path.join(root, 'evals', 'cases', 'alpha-skill.json'), evalCase);

  const result = run(root, ['--behavioral', 'alpha-skill', '--dry-run']);

  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /dialogue transcript/);
});

test('enforces the configured rank-1 floor', () => {
  const root = makeSandbox();
  writeSkill(root, 'alpha-skill', 'Handles widget work. Use when implementing widget changes.');
  writeSkill(
    root,
    'beta-skill',
    'Diagnoses urgent widget failures in production. Use when repairing urgent widget failures.',
  );
  writeJson(
    path.join(root, 'evals', 'cases', 'alpha-skill.json'),
    completeCase('alpha-skill', 'urgent widget failure production', 2),
  );
  writeJson(
    path.join(root, 'evals', 'cases', 'beta-skill.json'),
    completeCase('beta-skill', 'repair urgent widget failure', 1),
  );

  const passing = run(root, ['--min-rank1', '50']);
  const failing = run(root, ['--min-rank1', '60']);

  assert.equal(passing.status, 0, passing.stdout + passing.stderr);
  assert.equal(failing.status, 1, failing.stdout + failing.stderr);
  assert.match(failing.stdout, /below required 60%/);
});

test('rejects an invalid rank-1 floor', () => {
  const root = makeSandbox();

  const result = run(root, ['--min-rank1', '101']);

  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stderr, /--min-rank1 must be a number from 0 to 100/);
});

test('routes clipped prompt forms to their long-form skill (see #660)', () => {
  const root = makeSandbox();
  // Note: the skill name must not contain the clipped form itself — name
  // tokens are weighted 2x, which would route the prompt even without the
  // alias map. The prompt shares no vocabulary with the description except
  // the clipped/long pair (auth/authentication): without the alias map the
  // skill scores zero and the positive prompt fails.
  writeSkill(
    root,
    'credential-skill',
    'Protects credential verification. Use when configuring authentication ceremonies.',
  );
  writeSkill(root, 'paint-skill', 'Paints sheds. Use when choosing exterior paint colors.');
  writeJson(
    path.join(root, 'evals', 'cases', 'credential-skill.json'),
    completeCase('credential-skill', 'fix broken auth checks', 1),
  );
  writeJson(
    path.join(root, 'evals', 'cases', 'paint-skill.json'),
    completeCase('paint-skill', 'choose exterior paint colors', 1),
  );

  const result = run(root);

  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('folds -ifications to their -ify verb, not to the unrelated "specific" (see #660)', () => {
  const root = makeSandbox();
  // "specification" is a nominalization of "specify", so it must reach the
  // spec skill. Stripping a bare "-ation" instead yields "specific", which
  // silently cross-merges the two words and starves the spec skill. Each
  // prompt shares vocabulary with its own skill only.
  writeSkill(root, 'spec-skill', 'Agree on requirements up front. Use when you specify behaviour.');
  writeSkill(root, 'specific-skill', 'Narrow a choice down. Use when one target matters.');
  writeJson(
    path.join(root, 'evals', 'cases', 'spec-skill.json'),
    completeCase('spec-skill', 'document a specification for the billing rollout', 1),
  );
  writeJson(
    path.join(root, 'evals', 'cases', 'specific-skill.json'),
    completeCase('specific-skill', 'narrow the choice down to one target', 1),
  );

  const result = run(root);

  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('strips -ations as well as -ation so plurals do not out-stem singulars (see #660)', () => {
  const root = makeSandbox();
  // "migration" and "migrations" are the same word, so both forms have to
  // reach the migration skill. With only "-ation" in the suffix list the
  // plural keeps its "-s" ("migration" -> "migr" vs "migrations" ->
  // "migration"), which splits the pair and halves the score. Neither
  // prompt shares vocabulary with the other skill.
  writeSkill(root, 'migration-skill', 'Move old data stores off production without downtime.');
  writeSkill(root, 'recipe-skill', 'Plan tonight dinner from what is already in the cupboard.');
  writeJson(
    path.join(root, 'evals', 'cases', 'migration-skill.json'),
    completeCase('migration-skill', 'plan the database migrations', 1),
  );
  writeJson(
    path.join(root, 'evals', 'cases', 'recipe-skill.json'),
    completeCase('recipe-skill', 'plan tonight dinner from the cupboard', 1),
  );

  const result = run(root);

  assert.equal(result.status, 0, result.stdout + result.stderr);
});

// ---------- parseGrading expectation-binding tests ----------

test('accepts reordered-but-complete grader results', () => {
  const expectations = ['first expectation', 'second expectation'];
  const raw = JSON.stringify({
    expectations: [
      { id: 2, text: 'second expectation', passed: false, evidence: 'not observed' },
      { id: 1, text: 'first expectation', passed: true, evidence: 'observed in the trace' },
    ],
    summary: { passed: 1, failed: 1, total: 2, pass_rate: 0.5 },
  });
  const result = parseGrading(raw, expectations);
  assert.notEqual(result, null);
  assert.equal(result.summary.passed, 1);
  assert.equal(result.summary.failed, 1);
});

test('rejects duplicate grader results for the same expectation', () => {
  const expectations = ['first expectation', 'second expectation'];
  // Valid baseline: each id appears exactly once
  const validRaw = JSON.stringify({
    expectations: [
      { id: 1, text: 'first expectation', passed: true, evidence: 'observed' },
      { id: 2, text: 'second expectation', passed: false, evidence: 'not observed' },
    ],
    summary: { passed: 1, failed: 1, total: 2, pass_rate: 0.5 },
  });
  assert.notEqual(parseGrading(validRaw, expectations), null);

  // Duplicate: id 1 appears twice, id 2 is missing
  const dupRaw = JSON.stringify({
    expectations: [
      { id: 1, text: 'first expectation', passed: true, evidence: 'observed' },
      { id: 1, text: 'first expectation', passed: true, evidence: 'observed again' },
    ],
    summary: { passed: 2, failed: 0, total: 2, pass_rate: 1 },
  });
  assert.equal(parseGrading(dupRaw, expectations), null);
});

test('rejects grader results whose ids are not in the declared set', () => {
  const expectations = ['first expectation', 'second expectation'];
  // Valid baseline
  const validRaw = JSON.stringify({
    expectations: [
      { id: 1, text: 'first expectation', passed: true, evidence: 'observed' },
      { id: 2, text: 'second expectation', passed: false, evidence: 'not observed' },
    ],
    summary: { passed: 1, failed: 1, total: 2, pass_rate: 0.5 },
  });
  assert.notEqual(parseGrading(validRaw, expectations), null);

  // id 3 is out of range 1..2
  const badIdRaw = JSON.stringify({
    expectations: [
      { id: 1, text: 'first expectation', passed: true, evidence: 'observed' },
      { id: 3, text: 'unknown expectation', passed: false, evidence: 'not found' },
    ],
    summary: { passed: 1, failed: 1, total: 2, pass_rate: 0.5 },
  });
  assert.equal(parseGrading(badIdRaw, expectations), null);
});

test('rejects a result set that omits a declared expectation', () => {
  const expectations = ['first expectation', 'second expectation', 'third expectation'];
  // Valid baseline
  const validRaw = JSON.stringify({
    expectations: [
      { id: 1, text: 'first expectation', passed: true, evidence: 'observed' },
      { id: 2, text: 'second expectation', passed: true, evidence: 'observed' },
      { id: 3, text: 'third expectation', passed: false, evidence: 'not observed' },
    ],
    summary: { passed: 2, failed: 1, total: 3, pass_rate: 2 / 3 },
  });
  assert.notEqual(parseGrading(validRaw, expectations), null);

  // Only 2 results for 3 expectations (id 3 omitted)
  const partialRaw = JSON.stringify({
    expectations: [
      { id: 1, text: 'first expectation', passed: true, evidence: 'observed' },
      { id: 2, text: 'second expectation', passed: true, evidence: 'observed' },
    ],
    summary: { passed: 2, failed: 0, total: 2, pass_rate: 1 },
  });
  assert.equal(parseGrading(partialRaw, expectations), null);
});

test('derives pass_rate from counters rather than trusting the grader value', () => {
  const expectations = ['first expectation', 'second expectation'];
  // Correct pass_rate should be accepted
  const validRaw = JSON.stringify({
    expectations: [
      { id: 1, text: 'first expectation', passed: true, evidence: 'observed' },
      { id: 2, text: 'second expectation', passed: false, evidence: 'not observed' },
    ],
    summary: { passed: 1, failed: 1, total: 2, pass_rate: 0.5 },
  });
  const valid = parseGrading(validRaw, expectations);
  assert.notEqual(valid, null);
  assert.equal(valid.summary.pass_rate, 0.5);

  // Wrong pass_rate with correct counters: accepted, but recomputed
  const wrongRaw = JSON.stringify({
    expectations: [
      { id: 1, text: 'first expectation', passed: true, evidence: 'observed' },
      { id: 2, text: 'second expectation', passed: false, evidence: 'not observed' },
    ],
    summary: { passed: 1, failed: 1, total: 2, pass_rate: 0.999 },
  });
  const corrected = parseGrading(wrongRaw, expectations);
  assert.notEqual(corrected, null);
  assert.equal(corrected.summary.pass_rate, 0.5);
  // The integer counters stay exact checks
  assert.equal(corrected.summary.passed, 1);
  assert.equal(corrected.summary.failed, 1);
});

test('replaces paraphrased grader text with the declared expectation', () => {
  const expectations = ['first expectation', 'second expectation'];
  const raw = JSON.stringify({
    expectations: [
      { id: 2, text: 'the agent did the second thing', passed: false, evidence: 'not observed' },
      { id: 1, text: 'roughly the first one', passed: true, evidence: 'observed' },
    ],
    summary: { passed: 1, failed: 1, total: 2, pass_rate: 0.5 },
  });

  const result = parseGrading(raw, expectations);
  assert.notEqual(result, null);
  assert.equal(result.expectations.find((r) => r.id === 1).text, 'first expectation');
  assert.equal(result.expectations.find((r) => r.id === 2).text, 'second expectation');
});

// ---------- persistGradingOutcome stale-cleanup tests ----------

test('rejected grading writes raw output', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'grading-cleanup-'));
  try {
    const base = path.join(dir, 'my-skill.eval-1');

    const result = persistGradingOutcome(base, null, 'unparseable grader output');

    assert.equal(result, false);
    assert.equal(fs.existsSync(`${base}.grading.raw.txt`), true, 'raw output must be written');
    assert.equal(fs.readFileSync(`${base}.grading.raw.txt`, 'utf8'), 'unparseable grader output');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('rejected grading succeeds even when no prior grading.json exists', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'grading-cleanup-'));
  try {
    const base = path.join(dir, 'my-skill.eval-1');

    const result = persistGradingOutcome(base, null, 'bad output');

    assert.equal(result, false);
    assert.equal(fs.existsSync(`${base}.grading.raw.txt`), true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('accepted grading writes grading.json', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'grading-cleanup-'));
  try {
    const base = path.join(dir, 'my-skill.eval-1');
    const grading = {
      expectations: [{ id: 1, text: 'x', passed: true, evidence: 'y' }],
      summary: { passed: 1, failed: 0, total: 1, pass_rate: 1 },
    };

    const result = persistGradingOutcome(base, grading, 'unused');

    assert.equal(result, true);
    const written = JSON.parse(fs.readFileSync(`${base}.grading.json`, 'utf8'));
    assert.deepEqual(written, grading);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------- upfront slot-clearing tests ----------

test('a grader that throws leaves no result file behind', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'grading-crash-'));
  try {
    const base = path.join(dir, 'my-skill.eval-1');
    // Stale files from a prior run
    fs.writeFileSync(`${base}.grading.json`, '{"previous":"run"}\n');
    fs.writeFileSync(`${base}.grading.raw.txt`, 'previous raw output');
    fs.writeFileSync(`${base}.execution.raw.txt`, 'previous partial trace');
    fs.writeFileSync(`${base}.execution.error.txt`, 'previous execution failure');

    clearGradingSlot(base);

    // Executor or grader crashes — persistGradingOutcome is never called

    assert.equal(fs.existsSync(`${base}.grading.json`), false, 'stale grading.json must not survive a crash');
    assert.equal(fs.existsSync(`${base}.grading.raw.txt`), false, 'stale grading.raw.txt must not survive a crash');
    assert.equal(fs.existsSync(`${base}.execution.raw.txt`), false, 'old partial trace must not survive a new attempt');
    assert.equal(fs.existsSync(`${base}.execution.error.txt`), false, 'old execution failure must not survive a new attempt');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('successful grading leaves no stale raw file behind', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'grading-success-'));
  try {
    const base = path.join(dir, 'my-skill.eval-1');
    // Stale raw from a prior rejected run
    fs.writeFileSync(`${base}.grading.raw.txt`, 'previous raw output');

    clearGradingSlot(base);

    // Successful grading
    const grading = {
      expectations: [{ id: 1, text: 'x', passed: true, evidence: 'y' }],
      summary: { passed: 1, failed: 0, total: 1, pass_rate: 1 },
    };
    persistGradingOutcome(base, grading, 'unused');

    assert.equal(fs.existsSync(`${base}.grading.json`), true, 'grading.json must be written');
    assert.equal(fs.existsSync(`${base}.grading.raw.txt`), false, 'stale grading.raw.txt must not survive');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------- extractExecutorModel tests ----------

test('extracts model from the stream-json init event', () => {
  const trace = [
    '{"type":"system","subtype":"init","model":"claude-sonnet-4-6-20250514","session_id":"abc"}',
    '{"type":"assistant","message":{"id":"msg_1","content":[{"type":"text","text":"Hi"}]}}',
    '{"type":"result","subtype":"success","result":"Hi"}',
  ].join('\n');

  assert.equal(extractExecutorModel(trace), 'claude-sonnet-4-6-20250514');
});

test('returns null when the trace has no init event', () => {
  const trace = [
    '{"type":"assistant","message":{"id":"msg_1","content":[]}}',
    '{"type":"result","subtype":"success","result":"done"}',
  ].join('\n');

  assert.equal(extractExecutorModel(trace), null);
});

test('returns null when the init event has no model field', () => {
  const trace = '{"type":"system","subtype":"init","session_id":"abc"}\n';

  assert.equal(extractExecutorModel(trace), null);
});

test('tolerates non-JSON lines in the trace', () => {
  const trace = [
    'not json',
    '{"type":"system","subtype":"init","model":"claude-opus-4-6","session_id":"abc"}',
  ].join('\n');

  assert.equal(extractExecutorModel(trace), 'claude-opus-4-6');
});

// ---------- persistGradingOutcome run identity tests ----------

test('accepted grading includes run metadata when provided', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'grading-run-meta-'));
  try {
    const base = path.join(dir, 'my-skill.eval-1');
    const grading = {
      expectations: [{ id: 1, text: 'x', passed: true, evidence: 'y' }],
      summary: { passed: 1, failed: 0, total: 1, pass_rate: 1 },
    };
    const runMeta = {
      executor_model: 'claude-sonnet-4-6-20250514',
      grader_model: 'unknown',
      timestamp: '2026-09-21T00:00:00.000Z',
    };

    persistGradingOutcome(base, grading, 'unused', runMeta);

    const written = JSON.parse(fs.readFileSync(`${base}.grading.json`, 'utf8'));
    assert.deepEqual(written.run, runMeta);
    assert.deepEqual(written.expectations, grading.expectations);
    assert.deepEqual(written.summary, grading.summary);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('accepted grading omits run key when no metadata is provided', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'grading-no-meta-'));
  try {
    const base = path.join(dir, 'my-skill.eval-1');
    const grading = {
      expectations: [{ id: 1, text: 'x', passed: true, evidence: 'y' }],
      summary: { passed: 1, failed: 0, total: 1, pass_rate: 1 },
    };

    persistGradingOutcome(base, grading, 'unused');

    const written = JSON.parse(fs.readFileSync(`${base}.grading.json`, 'utf8'));
    assert.equal('run' in written, false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('materializes a git baseline and applies a working-tree patch', () => {
  const workspace = materializeWorkspace({ files: ['git-workflow-and-versioning'] });
  try {
    const status = spawnSync('git', ['status', '--short'], { cwd: workspace, encoding: 'utf8' });
    const commits = spawnSync('git', ['rev-list', '--count', 'HEAD'], { cwd: workspace, encoding: 'utf8' });

    assert.equal(status.status, 0, status.stdout + status.stderr);
    assert.match(status.stdout, / M git-workflow-and-versioning\/app\.js/);
    assert.equal(commits.stdout.trim(), '1');
    assert.equal(fs.existsSync(path.join(workspace, '.eval')), false);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});


test('fixture baseline commits ignore inherited user signing requirements', () => {
  const root = makeSandbox();
  const config = path.join(root, 'global.gitconfig');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'fixture-signing-test-'));
  try {
    fs.writeFileSync(config, '[commit]\n\tgpgsign = true\n[gpg]\n\tprogram = definitely-missing-eval-signer\n');
    const result = spawnSync(process.execPath, ['-e', `
      const fs = require('node:fs');
      const { materializeWorkspace } = require(${JSON.stringify(path.join(root, 'scripts', 'run-evals.js'))});
      let workspace;
      try { workspace = materializeWorkspace({ files: ['project/context.txt'] }); }
      finally { if (workspace) fs.rmSync(workspace, { recursive: true, force: true }); }
    `], { cwd: root, encoding: 'utf8', env: { ...process.env, GIT_CONFIG_GLOBAL: config, TMPDIR: temp, TMP: temp, TEMP: temp } });
    assert.equal(result.status, 0, result.stdout + result.stderr);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test('rejects duplicate behavioral IDs before they can overwrite a grading slot', () => {
  const root = makeSandbox();
  try {
    writeSkill(root, 'alpha-skill', 'Handles alpha widgets. Use when changing alpha widgets.');
    const evalCase = completeCase('alpha-skill', 'change alpha widget');
    evalCase.evals.push({ ...behavioralEval(), prompt: 'A different evaluation' });
    writeJson(path.join(root, 'evals', 'cases', 'alpha-skill.json'), evalCase);
    const result = run(root);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, /duplicate behavioral eval id=1/);
    const dryRun = run(root, ['--behavioral', 'alpha-skill', '--dry-run']);
    assert.equal(dryRun.status, 1, dryRun.stdout + dryRun.stderr);
    assert.match(dryRun.stderr, /duplicate behavioral eval id=1/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('accepts distinct behavioral IDs including zero', () => {
  const root = makeSandbox();
  try {
    writeSkill(root, 'alpha-skill', 'Handles alpha widgets. Use when changing alpha widgets.');
    const evalCase = completeCase('alpha-skill', 'change alpha widget');
    evalCase.evals.push({ ...behavioralEval(), id: 0 });
    writeJson(path.join(root, 'evals', 'cases', 'alpha-skill.json'), evalCase);
    const result = run(root);
    assert.equal(result.status, 0, result.stdout + result.stderr);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('removes the throwaway workspace when fixture setup fails', () => {
  const root = makeSandbox();
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-cleanup-test-'));
  try {
    const result = spawnSync(process.execPath, ['-e', `
      const { materializeWorkspace } = require(${JSON.stringify(path.join(root, 'scripts', 'run-evals.js'))});
      try { materializeWorkspace({ files: ['project/context.txt', 'missing.txt'] }); }
      catch (error) { console.error(error.message); }
    `], { cwd: root, encoding: 'utf8', env: { ...process.env, TMPDIR: temp, TMP: temp, TEMP: temp } });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stderr, /fixture listed in files\[\] not found/);
    assert.deepEqual(fs.readdirSync(temp), [], 'partially copied fixture data must be removed');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(temp, { recursive: true, force: true });
  }
});


test('loads quoted YAML skill identities using their decoded values', () => {
  const root = makeSandbox();
  try {
    writeSkill(root, 'alpha', 'code unit tests');
    const skill = path.join(root, 'skills', 'alpha', 'SKILL.md');
    fs.writeFileSync(skill, fs.readFileSync(skill, 'utf8').replace('name: alpha', "name: 'alpha'")
      .replace('description: code unit tests', 'description: "code unit tests"'));
    writeJson(path.join(root, 'evals', 'cases', 'alpha.json'), completeCase('alpha', 'code unit tests'));
    const result = run(root);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /PASSED/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('stages every skill into the workspace, outside git, and points the executor at it', () => {
  const root = makeSandbox();
  try {
    writeSkill(root, 'alpha-skill', 'Handles alpha widgets.');
    writeSkill(root, 'beta-skill', 'Handles beta widgets.');
    fs.mkdirSync(path.join(root, 'skills/alpha-skill/templates'));
    fs.writeFileSync(path.join(root, 'skills/alpha-skill/templates/t.md'), 'template\n');
    writeJson(path.join(root, 'evals/cases/alpha-skill.json'), completeCase('alpha-skill', 'change alpha widget'));
    const seen = path.join(root, 'seen.json');
    const stub = path.join(root, 'stub-claude.cjs');
    fs.writeFileSync(stub, `
      const cp = require('child_process'); const fs = require('node:fs'); const path = require('node:path');
      const real = cp.execFileSync;
      cp.execFileSync = (command, args, opts) => {
        if (command !== 'claude') return real(command, args, opts);
        if (!args.includes('--output-format')) return ${JSON.stringify(passingGrading)};
        const at = (p) => fs.existsSync(path.join(opts.cwd, p));
        fs.writeFileSync(${JSON.stringify(seen)}, JSON.stringify({
          skill: at('.agent-skills/alpha-skill/SKILL.md'),
          template: at('.agent-skills/alpha-skill/templates/t.md'),
          other: at('.agent-skills/beta-skill/SKILL.md'),
          prompt: args[args.indexOf('--append-system-prompt') + 1],
          status: real('git', ['status', '--porcelain'], { cwd: opts.cwd, encoding: 'utf8' }),
        }));
        return '{"type":"result","subtype":"success","is_error":false,"result":"done"}\\n';
      };
    `);
    const result = spawnSync(process.execPath, ['--require', stub, path.join(root, 'scripts/run-evals.js'), '--behavioral', 'alpha-skill'], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const s = JSON.parse(fs.readFileSync(seen, 'utf8'));
    assert.equal(s.skill, true);
    assert.equal(s.template, true);
    assert.equal(s.other, true);
    assert.match(s.prompt, /\.agent-skills\/alpha-skill\//);
    assert.match(s.prompt, /never from an installed plugin/);
    assert.equal(s.status, '');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('isolationBreach flags skill reads outside the workspace and allows staged ones', () => {
  const ws = '/private/var/folders/x/T/agent-skills-eval-abc';
  const use = (name, input) => traceOf({ type: 'assistant', message: { content: [{ type: 'tool_use', name, id: 'u', input }] } });
  const home = os.homedir();
  const breaches = {
    'plugin cache read': use('Read', { file_path: `${home}/.claude/plugins/cache/p/1.0.0/skills/a/SKILL.md` }),
    'home .claude find': use('Bash', { command: "find ~/.claude -name '*.md'" }),
    'absolute home .claude ls': use('Bash', { command: `ls ${home}/.claude/skills` }),
    'glob in plugin dir': use('Glob', { pattern: '**/SKILL.md', path: `${home}/.claude/plugins` }),
    'grep for SKILL.md elsewhere': use('Grep', { pattern: 'name:', path: '/opt/skills/a/SKILL.md' }),
    'bash cat SKILL.md elsewhere': use('Bash', { command: 'cat /opt/other-repo/skills/a/SKILL.md' }),
    'bash escapes with ..': use('Bash', { command: 'cat ../../skills/a/SKILL.md' }),
    "another eval's spill file": use('Read', { file_path: `${home}/.claude/projects/-private-var-folders-x-T-agent-skills-eval-zzz/0f0e/tool-results/x.txt` }),
    'spill file read through Bash': use('Bash', { command: `cat ${home}/.claude/projects/-private-var-folders-x-T-agent-skills-eval-abc/0f0e/tool-results/x.txt` }),
  };
  for (const [name, trace] of Object.entries(breaches)) {
    assert.match(isolationBreach(trace, ws) || '', /isolation breach/, name);
  }
  const allowed = {
    'staged relative read': use('Read', { file_path: '.agent-skills/a/templates/t.md' }),
    'staged absolute read (/var alias)': use('Read', { file_path: '/var/folders/x/T/agent-skills-eval-abc/.agent-skills/a/SKILL.md' }),
    'bash on staged skill': use('Bash', { command: 'cat .agent-skills/b/SKILL.md' }),
    'glob in workspace': use('Glob', { pattern: '**/SKILL.md' }),
    'read outside workspace, not a skill': use('Read', { file_path: '/etc/hosts' }),
    'edit is not a read': use('Write', { file_path: `${home}/.claude/plugins/x`, content: '' }),
    "this eval's own spill file": use('Read', { file_path: `${home}/.claude/projects/-private-var-folders-x-T-agent-skills-eval-abc/0f0e/tool-results/x.txt` }),
  };
  for (const [name, trace] of Object.entries(allowed)) {
    assert.equal(isolationBreach(trace, ws), null, name);
  }
});

test('an execution that reads installed plugin skills is failed, not graded', () => {
  const root = makeSandbox();
  try {
    const breach = { type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Read', id: 'leak', input: { file_path: `${os.homedir()}/.claude/plugins/cache/p/1.0.0/skills/alpha-skill/SKILL.md` } }] } };
    const trace = traceOf(breach, returned('leak'), terminal);
    const result = runBehavioralWithGrading(root, passingGrading, { trace });
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, /isolation breach/);
    const base = path.join(root, 'evals/results/alpha-skill.eval-1');
    assert.equal(fs.existsSync(`${base}.grading.json`), false);
    assert.match(fs.readFileSync(`${base}.execution.error.txt`, 'utf8'), /isolation breach/);
    assert.equal(fs.readFileSync(path.join(root, 'claude-calls.txt'), 'utf8'), 'executor\n');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

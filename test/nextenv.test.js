'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync, spawn } = require('node:child_process');
const path = require('node:path');

const BIN = path.join(__dirname, '..', 'bin', 'nextenv.js');
const FIXTURES = path.join(__dirname, 'fixtures');

const READ_ENV = `console.log(JSON.stringify({
  SHARED: process.env.SHARED ?? null,
  FROM_BASE: process.env.FROM_BASE ?? null,
  FROM_LOCAL: process.env.FROM_LOCAL ?? null,
  FROM_DEV: process.env.FROM_DEV ?? null,
  FROM_DEV_LOCAL: process.env.FROM_DEV_LOCAL ?? null,
  FROM_PROD: process.env.FROM_PROD ?? null,
  FROM_PROD_LOCAL: process.env.FROM_PROD_LOCAL ?? null,
}))`;

function run(cwd, args, { env = {} } = {}) {
  const childEnv = { ...process.env, ...env };
  // strip NODE_ENV so loadEnvConfig doesn't flip to test mode
  delete childEnv.NODE_ENV;
  const result = spawnSync('node', [BIN, ...args], {
    cwd,
    env: childEnv,
    encoding: 'utf8',
  });
  return result;
}

function readEnv(cwd, modeToken) {
  const args = ['--', 'node', '-e', READ_ENV];
  if (modeToken) args.push(modeToken);
  const result = run(cwd, args);
  assert.equal(result.status, 0, `stderr: ${result.stderr}`);
  return JSON.parse(result.stdout);
}

test('no arguments prints usage and exits 0', () => {
  const result = run(FIXTURES, []);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage: nextenv/);
});

test('only -- prints usage and exits 0', () => {
  const result = run(FIXTURES, ['--']);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage: nextenv/);
});

test('dev mode loads .env.development cascade; .env.development.local wins', () => {
  const env = readEnv(path.join(FIXTURES, 'cascade'), 'dev');
  assert.equal(env.SHARED, 'from-dev-local');
  assert.equal(env.FROM_BASE, '1');
  assert.equal(env.FROM_LOCAL, '1');
  assert.equal(env.FROM_DEV, '1');
  assert.equal(env.FROM_DEV_LOCAL, '1');
  assert.equal(env.FROM_PROD, null);
  assert.equal(env.FROM_PROD_LOCAL, null);
});

test('non-dev (prod) mode loads .env.production cascade; .env.production.local wins', () => {
  const env = readEnv(path.join(FIXTURES, 'cascade'));
  assert.equal(env.SHARED, 'from-prod-local');
  assert.equal(env.FROM_BASE, '1');
  assert.equal(env.FROM_LOCAL, '1');
  assert.equal(env.FROM_PROD, '1');
  assert.equal(env.FROM_PROD_LOCAL, '1');
  assert.equal(env.FROM_DEV, null);
  assert.equal(env.FROM_DEV_LOCAL, null);
});

test('existing process.env value is not overridden by .env files', () => {
  const result = run(path.join(FIXTURES, 'cascade'), [
    '--', 'node', '-e', 'console.log(process.env.SHARED)', 'dev',
  ], { env: { SHARED: 'from-parent' } });
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), 'from-parent');
});

test('works in a directory with no .env files', () => {
  const result = run(path.join(FIXTURES, 'empty'), [
    '--', 'node', '-e', 'console.log("ok")',
  ]);
  assert.equal(result.status, 0, `stderr: ${result.stderr}`);
  assert.equal(result.stdout.trim(), 'ok');
});

test('exit code is propagated from the child', () => {
  const result = run(FIXTURES, [
    '--', 'node', '-e', 'process.exit(42)',
  ]);
  assert.equal(result.status, 42);
});

test('accepts command without --', () => {
  const result = run(FIXTURES, [
    'node', '-e', 'console.log("no-dashes")',
  ]);
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), 'no-dashes');
});

test('spawn failure exits non-zero with error message', () => {
  const result = run(FIXTURES, ['--', 'this-binary-does-not-exist-xyz']);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /nextenv: failed to spawn/);
});

test(
  'SIGINT is forwarded to the child',
  { skip: process.platform === 'win32' ? 'POSIX-only signal semantics' : false },
  async () => {
    const child = spawn(
      'node',
      [
        BIN,
        '--',
        'node',
        '-e',
        `process.on('SIGINT', () => { console.log('child-sigint'); process.exit(130); });
         console.log('ready');
         setInterval(() => {}, 1000);`,
      ],
      { cwd: FIXTURES, stdio: ['ignore', 'pipe', 'pipe'] },
    );

    let stdout = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });

    await new Promise((resolve) => {
      const check = () => {
        if (stdout.includes('ready')) resolve();
        else setTimeout(check, 20);
      };
      check();
    });

    child.kill('SIGINT');

    const code = await new Promise((resolve) => child.on('exit', resolve));
    assert.match(stdout, /child-sigint/);
    assert.equal(code, 130);
  },
);

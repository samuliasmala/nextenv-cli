#!/usr/bin/env node
'use strict';

const { loadEnvConfig } = require('@next/env');
const spawn = require('cross-spawn');

const USAGE = `Usage: nextenv [--] <command> [args...]

Loads .env files the Next.js way (via @next/env's loadEnvConfig), then runs
<command>. Drop-in replacement for \`dotenv -c --\`. Dev cascade is used when
\`dev\` appears in the command args (i.e. \`next dev\`), else prod cascade.

Examples:
  nextenv -- next dev
  nextenv next start
`;

const argv = process.argv.slice(2);

if (argv.length === 0) {
  process.stdout.write(USAGE);
  process.exit(0);
}

const rest = argv[0] === '--' ? argv.slice(1) : argv;

if (rest.length === 0) {
  process.stdout.write(USAGE);
  process.exit(0);
}

const dev = rest.includes('dev');

loadEnvConfig(process.cwd(), dev, { info: () => {}, error: console.error });

const [command, ...args] = rest;
const child = spawn(command, args, { stdio: 'inherit' });

const FORWARDED_SIGNALS = [
  'SIGINT',
  'SIGTERM',
  'SIGHUP',
  'SIGBREAK',
  'SIGWINCH',
  'SIGUSR1',
  'SIGUSR2',
];
for (const signal of FORWARDED_SIGNALS) {
  process.on(signal, () => {
    if (!child.killed) child.kill(signal);
  });
}

child.on('error', (err) => {
  console.error(`nextenv: failed to spawn '${command}': ${err.message}`);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});

# nextenv-cli

A drop-in replacement for [`dotenv-cli`](https://www.npmjs.com/package/dotenv-cli) that loads `.env` files the Next.js way — via [`@next/env`](https://www.npmjs.com/package/@next/env)'s `loadEnvConfig`.

Use it when you want a prelude command that populates `process.env` for a Next.js app (or any child process) using **exactly** the same cascade and precedence rules that `next dev` / `next start` apply internally. No divergence between the pre-Next environment and the environment Next sees.

## Install

```bash
pnpm add -D @asmala/nextenv-cli @next/env
# or
npm i -D @asmala/nextenv-cli @next/env
```

`@next/env` is a **peer dependency** (`>=13`). In a Next.js project it's already available transitively via `next`, but declaring it explicitly aligns the version with your Next install. Node `>=20.19` is required.

## Usage

```jsonc
// package.json
{
  "scripts": {
    "dev":   "nextenv -- next dev",
    "start": "nextenv -- next start"
  }
}
```

Migrating from `dotenv-cli`:

```diff
- "dev":   "dotenv -c -- next dev",
- "start": "dotenv -c -- next start",
+ "dev":   "nextenv -- next dev",
+ "start": "nextenv -- next start",
```

The `--` separator is optional (`nextenv next dev` works too). There are no flags; `nextenv` does one thing.

## How it picks dev vs prod

`nextenv` inspects the command args — if the token `dev` appears anywhere, the development cascade is loaded; otherwise the production cascade. This matches what Next itself does internally:

| Command                   | Cascade loaded                                                                            |
| ------------------------- | ----------------------------------------------------------------------------------------- |
| `nextenv -- next dev`     | `.env.development.local` → `.env.local` → `.env.development` → `.env`                     |
| `nextenv -- next start`   | `.env.production.local` → `.env.local` → `.env.production` → `.env`                       |
| `nextenv -- next build`   | `.env.production.local` → `.env.local` → `.env.production` → `.env`                       |

Earlier files in the list take precedence. Existing `process.env` values are **not** overridden by `.env` files (Next's default).

When `NODE_ENV=test`, `@next/env` uses the `test` cascade and skips `.env.local` — same behavior `nextenv` exposes, since it just defers to `loadEnvConfig`.

## What it does *not* do

- No flag surface. No `-e`, no `-c`, no `-p`. If you need those, stick with `dotenv-cli`.
- It doesn't set `NODE_ENV` for the child — Next sets it itself based on the subcommand.
- It doesn't inspect or rewrite variables. Next does that (e.g. `NEXT_PUBLIC_*` inlining).

## License

MIT — see [LICENSE](./LICENSE).

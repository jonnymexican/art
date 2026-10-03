#!/usr/bin/env node
/**
 * Writes the GitHub token to secrets.token (gitignored) WITHOUT printing it.
 *
 * The token comes from the same Windows credential manager that `git push`
 * already uses, so there is nothing to type. Run once per machine:
 *
 *   node scripts/token.mjs
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outPath = join(here, '..', 'secrets.token');

let token = '';
try {
  const out = execFileSync('git', ['credential', 'fill'], {
    input: 'protocol=https\nhost=github.com\n',
    encoding: 'utf8',
  });
  token = (out.match(/^password=(.*)$/m)?.[1] ?? '').trim();
} catch {
  /* fall through to the error below */
}

if (!token) {
  console.error(
    'Could not read a GitHub token via `git credential fill`.\n' +
      'Push something with git once, or paste a token into secrets.token manually.'
  );
  process.exit(1);
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, token + '\n', { mode: 0o600 });
console.log('Token written to secrets.token (never printed).');

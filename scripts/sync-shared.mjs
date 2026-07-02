#!/usr/bin/env node
// Copies supabase/functions/_shared/shared.ts into every function directory so
// each Edge Function deploys self-contained (index.ts + shared.ts).
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'functions');
const shared = readFileSync(join(root, '_shared', 'shared.ts'), 'utf8');

let count = 0;
for (const entry of readdirSync(root)) {
  if (entry === '_shared') continue;
  const dir = join(root, entry);
  if (!statSync(dir).isDirectory()) continue;
  writeFileSync(join(dir, 'shared.ts'), shared);
  count++;
}
console.log(`shared.ts synced into ${count} function directories`);

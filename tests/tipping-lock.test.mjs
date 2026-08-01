import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const submit = read("../supabase/functions/submitTip/index.ts");
const schema = read("../supabase/migrations/0001_core_schema.sql");

// RLT-TIP-001. A matchup's status can only be 'scheduled' or 'final' (the CHECK
// constraint), yet submitTip used to block 'finished'/'live' — values that can
// never exist. So the guard was dead code and a 'final' game (public score) was
// tippable: read the result, tip the exact winner+margin, get a perfect
// settlement. settleTips pays out on 'final', so the chain was live.

test("matchup status is only ever 'scheduled' or 'final'", () => {
  assert.match(
    schema,
    /status text not null default 'scheduled' check \(status in \('scheduled', 'final'\)\)/,
    "the CHECK constraint the fix relies on is present"
  );
});

test("submitTip only accepts tips on a scheduled game, by DB authority", () => {
  // The gate must key off the real terminal value, not the phantom ones.
  assert.match(
    submit,
    /matchup\.status !== 'scheduled'/,
    "a known game must be 'scheduled' to accept a tip (blocks 'final')"
  );
  assert.doesNotMatch(
    submit,
    /status === 'finished' \|\| matchup\.status === 'live'/,
    "the dead 'finished'/'live' guard is gone"
  );
});

test("a known game trusts the DB kickoff, never the client value", () => {
  // Prevents a client from supplying a future kickoff to dodge the lock.
  assert.match(
    submit,
    /kickoff = matchup\.kickoff \|\| ''/,
    "for a matchup with a DB row, kickoff comes from the DB"
  );
  assert.doesNotMatch(
    submit,
    /if \(matchup\?\.kickoff\) kickoff = matchup\.kickoff/,
    "the client-kickoff-when-DB-row-exists fallback is removed"
  );
});

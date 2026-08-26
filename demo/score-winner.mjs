// Score the Coach's winning option — the Beat 7 "map goes green" moment, automated.
//
// In Beat 7 you ADD the winning option live on camera (so that stays authentic),
// but scoring it means switching to all four seats and setting a cell per interest.
// This does that for you: it finds the option you added by name and writes scores
// tuned so every cell is GREEN (parties agree) and every must-have is met (viable),
// making it top the leaderboard.
//
// Safe by default: prints the plan and writes NOTHING unless SEED_COMMIT=1.
// Idempotent: a real run first clears this option's existing scores, then rewrites.
//
// Flow on shoot day (full board already seeded):
//   1. In the app, add the option named exactly "A focused differentiator, launch-ready by Fall".
//   2. Run this with SEED_COMMIT=1.
//   3. Refresh the map → green + leading → record the beauty shot.
//
// Usage (from the app dir):
//   DEMO_OWNER_EMAIL=you@example.com node --env-file=.env demo/score-winner.mjs            # dry run / preview
//   DEMO_OWNER_EMAIL=you@example.com SEED_COMMIT=1 node --env-file=.env demo/score-winner.mjs   # apply
//   OPTION_NAME="..." ...                                                                  # override the option name

import { neon } from "@neondatabase/serverless";
import { randomUUID } from "node:crypto";

const DATABASE_URL = process.env.DATABASE_URL;
const OWNER_EMAIL = (process.env.DEMO_OWNER_EMAIL || "").trim();
const COMMIT = process.env.SEED_COMMIT === "1";
const OPTION_NAME = (process.env.OPTION_NAME || "A focused differentiator, launch-ready by Fall").trim();

const LABEL = "Q3 roadmap — which bet do we make first?";
const DEFAULT_SCORE = 75; // any interest/party not listed below → high enough to stay viable (≥75) and green

// Per-interest, per-party scores for the Coach's winning option, keyed by normalized interest text.
// Tuned so each cell's spread stays ≤ 12.5 (GREEN) and every must-have is ≥ 75 (VIABLE),
// with just enough variation to read as real ("satisfies almost everyone").
const WINNER = {
  "own our biggest market moment of the year": { Product: 100, Marketing: 100, Sales: 100, Engineering: 75 },
  "differentiate in the market":               { Product: 100, Marketing: 100, Sales: 100, Engineering: 100 },
  "a launch with real press and momentum":     { Product: 75,  Marketing: 100, Sales: 75,  Engineering: 75 },
  "neutralize the competition on live deals":  { Product: 75,  Marketing: 75,  Sales: 100, Engineering: 75 },
  "no new critical tech debt":                 { Product: 75,  Marketing: 75,  Sales: 75,  Engineering: 100 }, // ★ must-have ≥ 75 → viable
  "a pace we can sustain after launch":        { Product: 75,  Marketing: 75,  Sales: 75,  Engineering: 100 },
};
const norm = (s) => s.trim().toLowerCase();
const scoreFor = (interestText, partyName) => WINNER[norm(interestText)]?.[partyName] ?? DEFAULT_SCORE;

if (!DATABASE_URL) {
  console.error("✗ Missing DATABASE_URL (run with `node --env-file=.env`).");
  process.exit(1);
}
if (!OWNER_EMAIL) {
  console.error("✗ Set DEMO_OWNER_EMAIL to the email you log into StakeAlign with.");
  process.exit(1);
}

const sql = neon(DATABASE_URL);
const id = () => randomUUID();

// ---- Resolve owner → negotiation → option --------------------------------

const users = await sql`
  SELECT id, email, "displayName" FROM "User"
  WHERE lower(email) = lower(${OWNER_EMAIL}) ORDER BY "createdAt" DESC`;
if (users.length === 0) {
  console.error(`✗ No User with email "${OWNER_EMAIL}". Log into the app once, then retry.`);
  process.exit(1);
}
const owner = users[0];

const negs = await sql`
  SELECT id, label FROM "Negotiation"
  WHERE label = ${LABEL} AND "ownerUserId" = ${owner.id} ORDER BY "createdAt" DESC`;
if (negs.length === 0) {
  console.error(`✗ No demo negotiation "${LABEL}" for ${owner.email}. Run demo/seed-demo.mjs first.`);
  process.exit(1);
}
const neg = negs[0];

const opts = await sql`
  SELECT id, "shortName" FROM "Option"
  WHERE "negotiationId" = ${neg.id} AND lower(trim("shortName")) = lower(${OPTION_NAME})
  ORDER BY "createdAt" DESC`;
if (opts.length === 0 && COMMIT) {
  console.error(`✗ No option named "${OPTION_NAME}" in "${LABEL}".`);
  console.error("  → Add it in the app first (Beat 7), then re-run. (Override the name with OPTION_NAME=...)");
  process.exit(1);
}
const option = opts[0] || { id: null, shortName: OPTION_NAME };

const interests = await sql`
  SELECT id, text, "mustHave" FROM "Interest" WHERE "negotiationId" = ${neg.id}`;
const parties = await sql`
  SELECT id, "displayName" FROM "Party" WHERE "negotiationId" = ${neg.id} ORDER BY "orderIndex"`;

// ---- Build the score rows ------------------------------------------------

const rows = [];
for (const it of interests) {
  for (const p of parties) {
    rows.push({ interest: it, party: p, value: scoreFor(it.text, p.displayName) });
  }
}

// ---- Plan summary --------------------------------------------------------

console.log("── StakeAlign: score the Coach's winning option ─────");
console.log(`Owner:        ${owner.displayName} <${owner.email}>`);
console.log(`Negotiation:  ${neg.label}`);
console.log(`Option:       "${option.shortName}"${option.id ? "" : "  (NOT added yet — preview only)"}`);
console.log(`Cells:        ${interests.length} interests × ${parties.length} parties = ${rows.length}`);
console.log("Every cell high + tight (green); every ★ must-have ≥ 75 (viable). Should top the leaderboard.");
console.log("");

const pnames = parties.map((p) => p.displayName);
console.log(["interest".padEnd(44), ...pnames.map((n) => n.padStart(12))].join(""));
for (const it of interests) {
  const cells = parties.map((p) => String(scoreFor(it.text, p.displayName)).padStart(12));
  console.log([((it.mustHave ? "★ " : "  ") + it.text).slice(0, 44).padEnd(44), ...cells].join(""));
}
console.log("─────────────────────────────────────────────────────");

if (!COMMIT) {
  if (!option.id) console.log(`(Add the option "${OPTION_NAME}" in the app, then re-run with SEED_COMMIT=1.)`);
  console.log("DRY RUN — nothing written. Re-run with SEED_COMMIT=1 to apply.");
  process.exit(0);
}

// ---- Write: replace this option's scores atomically ----------------------

const q = [sql`DELETE FROM "Score" WHERE "optionId" = ${option.id}`];
for (const r of rows) {
  q.push(sql`
    INSERT INTO "Score" (id, "optionId", "interestId", "partyId", value, na)
    VALUES (${id()}, ${option.id}, ${r.interest.id}, ${r.party.id}, ${r.value}, false)`);
}
await sql.transaction(q);

console.log(`✅ Scored "${option.shortName}" — ${rows.length} cells written.`);
console.log("   Refresh the map: it should be green across the board and lead the option scores.");

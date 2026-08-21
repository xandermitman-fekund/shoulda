// Seed the StakeAlign demo negotiation — the pre-Coach "tension" board.
//
// Stages everything the demo needs EXCEPT the Coach's winning option (you add that
// live in Beat 7): 4 parties, 6 interests (incl. the reframed "market moment" and
// Engineering's ★ must-have), cross-party points that light up the shared badges,
// 3 first-draft options, and scores designed to leave the map red with no winner.
//
// Safe by default: prints the plan and writes NOTHING unless SEED_COMMIT=1.
// Idempotent: a real run first deletes the prior demo negotiation for this owner.
//
// Usage (from the app dir):
//   DEMO_OWNER_EMAIL=you@example.com node --env-file=.env demo/seed-demo.mjs           # dry run
//   DEMO_OWNER_EMAIL=you@example.com SEED_COMMIT=1 node --env-file=.env demo/seed-demo.mjs   # apply
//
// Writes to whatever DATABASE_URL points at (your live Neon DB, via .env).

import { neon } from "@neondatabase/serverless";
import { randomUUID } from "node:crypto";

const DATABASE_URL = process.env.DATABASE_URL;
const OWNER_EMAIL = (process.env.DEMO_OWNER_EMAIL || "").trim();
const COMMIT = process.env.SEED_COMMIT === "1";

const LABEL = "Q3 roadmap — which bet do we make first?";
const DESCRIPTION =
  "Which product bet do we make this quarter? Marketing, Sales, and Engineering each want something different.";

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

// ---- The demo scenario ---------------------------------------------------

const parties = [
  { key: "product", name: "Product", role: "owner", proxy: false },
  { key: "marketing", name: "Marketing", role: "participant", proxy: true },
  { key: "sales", name: "Sales", role: "participant", proxy: true },
  { key: "engineering", name: "Engineering", role: "participant", proxy: true },
];

const interests = [
  { key: "market_moment", party: "product", text: "Own our biggest market moment of the year", mustHave: false },
  { key: "differentiate", party: "product", text: "Differentiate in the market", mustHave: false },
  { key: "press", party: "marketing", text: "A launch with real press and momentum", mustHave: false },
  { key: "neutralize", party: "sales", text: "Neutralize the competition on live deals", mustHave: false },
  { key: "no_debt", party: "engineering", text: "No new critical tech debt", mustHave: true },
  { key: "sustain", party: "engineering", text: "A pace we can sustain after launch", mustHave: false },
];

// points[party][interest] — 10 per party; cross-party backing creates the shared badges.
const points = {
  product: { market_moment: 5, differentiate: 5 },
  marketing: { market_moment: 6, press: 4 },
  sales: { neutralize: 6, market_moment: 2, differentiate: 2 },
  engineering: { sustain: 7, differentiate: 3 }, // must-have gets no points (sits above them)
};

const options = [
  { key: "marketplace", name: "Ship the integrations marketplace", desc: "Open a marketplace of third-party integrations." },
  { key: "rearch", name: "A big platform re-architecture", desc: "Pause features and rebuild the core platform for the long haul." },
  { key: "flashy", name: "A flashy AI feature, rushed for Fall", desc: "Ship a splashy AI capability in time for the Fall event, whatever it takes." },
];

// scores[option][interest][party] = 0|25|50|75|100 ; omit a party = blank (no opinion).
// Designed for tension: flashy breaks Engineering's must-have (0) → not viable; re-arch
// misses the market for everyone but Engineering; marketplace is middling → no green winner.
const scores = {
  flashy: {
    market_moment: { product: 100, marketing: 100, sales: 75, engineering: 50 },
    differentiate: { product: 100, marketing: 75, sales: 75, engineering: 25 },
    press: { product: 75, marketing: 100, sales: 50 },
    neutralize: { product: 75, marketing: 75, sales: 100, engineering: 25 },
    no_debt: { product: 25, marketing: 25, sales: 25, engineering: 0 }, // ★ must-have violated → NOT viable
    sustain: { product: 25, marketing: 0, sales: 25, engineering: 0 },
  },
  rearch: {
    market_moment: { product: 25, marketing: 0, sales: 0, engineering: 50 },
    differentiate: { product: 25, marketing: 25, sales: 0, engineering: 50 },
    press: { product: 0, marketing: 0, sales: 0 },
    neutralize: { product: 0, marketing: 0, sales: 25, engineering: 25 },
    no_debt: { product: 100, marketing: 75, sales: 75, engineering: 100 },
    sustain: { product: 75, marketing: 75, sales: 75, engineering: 100 },
  },
  marketplace: {
    market_moment: { product: 50, marketing: 50, sales: 50, engineering: 50 },
    differentiate: { product: 50, marketing: 50, sales: 75, engineering: 50 },
    press: { product: 50, marketing: 50, sales: 25 },
    neutralize: { product: 50, marketing: 25, sales: 75, engineering: 50 },
    no_debt: { product: 50, marketing: 50, sales: 50, engineering: 50 },
    sustain: { product: 50, marketing: 50, sales: 50, engineering: 75 },
  },
};

// ---- Resolve the owner ---------------------------------------------------

const users = await sql`
  SELECT id, email, "displayName", "createdAt"
  FROM "User" WHERE lower(email) = lower(${OWNER_EMAIL})
  ORDER BY "createdAt" DESC`;

if (users.length === 0) {
  console.error(`✗ No User with email "${OWNER_EMAIL}". Log into the target app once, then retry.`);
  process.exit(1);
}
if (users.length > 1) {
  console.warn(`⚠ ${users.length} users share that email; using the most recent: ${users[0].id}`);
}
const owner = users[0];

// ---- Plan summary --------------------------------------------------------

const scoreCells = Object.values(scores).reduce(
  (n, byInterest) => n + Object.values(byInterest).reduce((m, byParty) => m + Object.keys(byParty).length, 0),
  0,
);

console.log("── StakeAlign demo seed ─────────────────────────────");
console.log(`Owner:        ${owner.displayName} <${owner.email}>  (${owner.id})`);
console.log(`Negotiation:  ${LABEL}`);
console.log(`Parties:      ${parties.map((p) => p.name).join(", ")}`);
console.log(`Interests:    ${interests.length} (★ must-have: ${interests.filter((i) => i.mustHave).map((i) => `"${i.text}"`).join(", ")})`);
console.log(`Options:      ${options.map((o) => o.name).join(" · ")}`);
console.log(`Score cells:  ${scoreCells}`);
console.log(`Winning option: NOT seeded — add it live in Beat 7.`);
console.log("─────────────────────────────────────────────────────");

if (!COMMIT) {
  console.log("DRY RUN — nothing written. Re-run with SEED_COMMIT=1 to apply.");
  process.exit(0);
}

// ---- Build ids -----------------------------------------------------------

const negId = id();
const partyId = Object.fromEntries(parties.map((p) => [p.key, id()]));
const interestId = Object.fromEntries(interests.map((i) => [i.key, id()]));
const optionId = Object.fromEntries(options.map((o) => [o.key, id()]));

// ---- One atomic transaction ---------------------------------------------

const q = [];

// Wipe any prior run of this exact demo for this owner (cascades to children).
q.push(sql`DELETE FROM "Negotiation" WHERE label = ${LABEL} AND "ownerUserId" = ${owner.id}`);

// Prisma's @updatedAt is client-populated (no DB default), so a raw INSERT must set it.
const now = new Date().toISOString();
q.push(sql`
  INSERT INTO "Negotiation" (id, label, description, "ownerUserId", "inviteCode", status, "updatedAt")
  VALUES (${negId}, ${LABEL}, ${DESCRIPTION}, ${owner.id}, ${id()}, 'In Progress', ${now})`);

parties.forEach((p, i) => {
  q.push(sql`
    INSERT INTO "Party" (id, "negotiationId", "userId", "inviteCode", "pointBudget", "displayName", role, "orderIndex", "interestsReady")
    VALUES (${partyId[p.key]}, ${negId}, ${p.proxy ? null : owner.id}, ${id()}, 10, ${p.name}, ${p.role}, ${i}, true)`);
});

for (const it of interests) {
  q.push(sql`
    INSERT INTO "Interest" (id, "negotiationId", "ownerPartyId", text, "mustHave")
    VALUES (${interestId[it.key]}, ${negId}, ${partyId[it.party]}, ${it.text}, ${it.mustHave})`);
}

for (const [pk, byInterest] of Object.entries(points)) {
  for (const [ik, pts] of Object.entries(byInterest)) {
    if (pts > 0) {
      q.push(sql`
        INSERT INTO "InterestPoint" (id, "interestId", "partyId", points)
        VALUES (${id()}, ${interestId[ik]}, ${partyId[pk]}, ${pts})`);
    }
  }
}

for (const o of options) {
  q.push(sql`
    INSERT INTO "Option" (id, "negotiationId", "shortName", description, source)
    VALUES (${optionId[o.key]}, ${negId}, ${o.name}, ${o.desc}, 'party')`);
}

for (const [ok, byInterest] of Object.entries(scores)) {
  for (const [ik, byParty] of Object.entries(byInterest)) {
    for (const [pk, val] of Object.entries(byParty)) {
      q.push(sql`
        INSERT INTO "Score" (id, "optionId", "interestId", "partyId", value, na)
        VALUES (${id()}, ${optionId[ok]}, ${interestId[ik]}, ${partyId[pk]}, ${val}, false)`);
    }
  }
}

await sql.transaction(q);

console.log(`✅ Seeded "${LABEL}" (${negId}) for ${owner.email}`);
console.log(`   ${parties.length} parties · ${interests.length} interests · ${options.length} options · ${scoreCells} scores`);
console.log(`   Open it in the app, act as each party to review, then record.`);

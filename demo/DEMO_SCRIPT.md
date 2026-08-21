# StakeAlign — Demo Script (working draft)

> **Purpose:** the word-for-word narration + click-by-click steps for the ~2-minute product demo video. We mature both halves *together* (kept in sync, beat by beat) until it's capture-ready.
> **Status:** 🟢 v3 — full narration locked (read-aloud 2:39). Next: harden click-steps before shooting.
> **Last verified against the app:** 2026-08-21 (labels pulled from live components; proxy/intake behavior confirmed in code).

---

## The spine (the whole demo in three sentences)

- **Problem (for a PM):** Stakeholder alignment is the hardest, slowest part of the job — five people, competing priorities, no durable "yes."
- **Method:** StakeAlign turns *Getting to Yes* (Harvard principled negotiation) into software — surface **interests**, invent **options**, find where you already agree on a shared **map**, and lock a real **agreement**.
- **Payoff:** Weeks of meetings → a shared map and a signed agreement. Your stakeholders don't even have to read the book — the AI runs the method for them.

**The "aha":** the **Negotiation Map** turning **green** on an option the **Coach** invented — a win-win nobody had to argue into existence.

**Two AI wow-moments (the demo is built around these — everything else compresses):**
1. The **assistant** privately interviewing the PM and surfacing *interests, not positions*.
2. The **Coach** reading the whole board and finding the win-win the PM was missing. ← the climax.

**Getting to Yes throughline** (one light touch per act, never a lecture):
`interests, not positions` → `invent options for mutual gain` → `decide by objective criteria (the map)` → `a durable agreement`. GtY = the *process*; the SCIPAB Agreement = the *artifact*.

---

## Format & constraints

- **Audience:** Product Managers (the ICP). Voice = peer-to-peer, "you know this pain," lightly credentialed by the method. Not salesy.
- **Length target:** up to ~3:00 (Xander opened room, 2026-08-21). Use the extra time to let beats *breathe* and to fit the interest-vs-option reframe — not for feature tourism. Crisp value prop still rules.
- **Flow:** Solo / proxy ("nudger") — the PM drives everything, representing each stakeholder. One line acknowledges real stakeholders *can* join; we don't show it.
- **Narration budget:** ~3 min ≈ **~430 words** ceiling; current draft ~314 → headroom for the reframe beat.
- **Structure:** 8 beats. The interest reframe (Beat 3) and the points/common-ground step (Beat 4) each get their own beat now that we have 3-min room.

---

## ✅ / ⚠️ Decisions

1. **Scenario — LOCKED: "Q3 roadmap — which bet do we make?"** (Product/you, Engineering, Sales, Customer Success).
2. **Proxy + intake behavior — CONFIRMED in code** (`CaseWorkspace.tsx:164-167`): when you're "acting as" another party, the Intake tab is hidden — so the assistant interview runs only for *your own* seat, and you represent the others directly on the map. The script (Beat 3) is written to match. *Final proof = the dry-run.*
3. **A few exact labels + the live Coach output still to confirm on camera** (🔎 inline). The Coach's reply is a live AI call — non-deterministic — so we rehearse the board state + question until it reliably lands the target insight (see prep).

---

## Cast & scenario (the seed data we'll stage)

**Negotiation:** "Q3 roadmap — which bet do we make first?"
**Parties (seats the PM creates)** — interests are Xander's real inputs:
- **Product (you)** — interest: *Differentiate in the market*
- **Marketing** — interest: *Announce the new product at the Fall marketing event* (a hard date)
- **Sales** — interest: *Neutralize the competition* (win competitive deals now)
- **Engineering** — ★ must-have: *No new critical tech debt* (+ can we realistically ship by Fall?)

> 🔎 **Notes:** (a) I mapped your three interests to Product/Marketing/Sales and gave Engineering the ★ must-have as the constraint that creates tension — swap freely. (b) **DECIDED: keep the reframe** — "Announce at the Fall event" is really a position, and the assistant reframes it live to the interest beneath ("own our biggest market moment of the year"). **Mechanic (verified in code):** the interest-vs-option coaching (`classifyInterest`) fires in the **"What matters"** panel, which is hidden in proxy mode — so we stage the reframe on the PM's **own seat**, not on the Map.

**First-draft options (deliberately imperfect, to set up the Coach):** Ship the integrations marketplace · A big platform re-architecture · A flashy AI feature rushed for the Fall event.
**The tension the map exposes:** the differentiate-now options threaten Engineering's ★ must-have or can't land by Fall; the safe re-architecture misses the Fall event entirely. The market-facing parties and Engineering don't overlap — no clean green winner.
**The Coach's move (the climax):** it spots that Sales/Marketing and Engineering share no common ground, flags the rushed AI feature as a must-have dead end and the re-architecture as too slow, and proposes a synthesized option — **"A focused differentiator, launch-ready by Fall"** (differentiates for Product, headline-ready for Marketing's event, competitive for Sales, no new critical debt for Engineering). Added and re-scored, **it goes green.**

---

## The script

### Beat 1 — The pain  ·  ~0:00–0:13  ·  *(~40 words)*  ·  ✅ LOCKED
🎙️ **Narration:**
> "If you're a PM, you know this moment. Five stakeholders, five agendas — and you need a yes that actually sticks. That's what StakeAlign does: it takes *Getting to Yes*, the Harvard method, and turns it into software."

🖱️ **Actions:** Open `stakealign.fekund.com` (signed in, admitted account). Rest on the hero — *"Find your way to 'yes,' together."*
🖥️ **On screen:** Landing hero, calm.

---

### Beat 2 — Frame it + set up the room (the "nudger" move)  ·  ~0:13–0:37  ·  *(~85 words)*  ·  ✅ LOCKED
🎙️ **Narration:**
> "Here's a real one: our Q3 roadmap. Marketing, Sales, Engineering — three teams, three different definitions of 'the right call.' Instead of hashing this out in a meeting and wasting people's time, I roll up my sleeves and set up the negotiation myself — a seat for each of them. The hard part is getting stakeholders to actually log in — they can jump in and get hands-on *anytime* they want, but they never have to. It's not now-or-never; the method works either way."

🖱️ **Actions:** In **"Start a new one"** → **"What are you working out?"** type *"Q3 roadmap — which bet do we make first?"* → **"Create →"**. Then **"Manage parties"**, add **Marketing / Sales / Engineering** (you're auto-seated as the fourth party — rename it **Product**); briefly hover a **"Copy invite link"** to show it exists; **"Done."**
🖥️ **On screen:** New workspace; 4 parties; "Acting as" dropdown populated.

---

### Beat 3 — Interests, not positions (the reframe)  ·  ~0:37–1:05  ·  *(~85 words)*  ·  ✅ LOCKED
🎙️ **Narration:**
> "Now the assistant interviews me — privately — to draw out what each side actually needs. And watch this: I tell it one thing that matters is announcing at the Fall event. But the assistant pushes back — that's not really an interest, it's an *option*; so what's the need behind it? The real interest is owning our biggest market moment of the year. That distinction — interests, not positions — is the entire method. Miss it, and you're just haggling over plans."

🖱️ **Actions:** As **Product** (your own seat), open **"Meet the assistant"**, send 1–2 rehearsed lines. Go to **"What matters"** and type **"Announce our new product at the Fall event"** — the interest-vs-option coaching flags it's really an *option* and suggests the interest beneath (*"own our biggest market moment of the year"*); **accept the reframe.** Add Product's other interest (*differentiate in the market*). 🔎 Reframe fires here on your own seat — not on the Map.
🖥️ **On screen:** Private chat → the coaching card catching the position and offering the reframed interest.

---

### Beat 4 — Weigh what matters (common ground appears)  ·  ~1:05–1:22  ·  *(~40 words)*  ·  ✅ LOCKED
🎙️ **Narration:**
> "Now I represent the other stakeholders' interests myself, and everyone gets ten points to spend on what matters most — across *all* the interests, not just their own. Watch the badges stack: that's common ground surfacing on its own, before anyone's argued about a single option."

🖱️ **Actions:** Add Marketing / Sales / Engineering's interests on the map (incl. Engineering's ★ **must-have**, *no new critical debt*). Allocate points per party with **[− n +]** — have **Marketing back Product's "market moment" interest** (shared badge). Point at **association badges** stacking. 🔎 **"Save priorities."**
🖥️ **On screen:** Points allocated; stacked badges = common ground (esp. on the "market moment" interest).

---

### Beat 5 — Options + the map (set up the tension)  ·  ~1:22–1:52  ·  *(~95 words)*  ·  ✅ LOCKED
🎙️ **Narration:**
> "Now we put options on the table — no bad ones yet; we're inventing, not deciding. The assistant even proposes a few built for mutual gain. I've talked to everyone individually, shopped around the options on the table and gauged where each of them lands — then I enter their scores, and the map colors in: green where we agree, red where we don't. And right away — red everywhere. Every fast option breaks Engineering's must-have; the safe one misses the Fall launch. There's no win-win on the board."

🖱️ **Actions:** **"Options"** tab → add the three first-draft options (or **"✨ Suggest options"**). **"Negotiation Map"** → score so the flashy options show red on Engineering's ★ must-have and the re-architecture scores low for Marketing/Sales. Point at the red cells — no green winner.
🖥️ **On screen:** Color-coded map, visibly *not* resolved — red/amber, no green winner.

---

### Beat 6 — Ask the Coach (the climax)  ·  ~1:52–2:22  ·  *(~85 words)*  ·  ✅ LOCKED
🎙️ **Narration:**
> "This is the part you can't do in a spreadsheet. StakeAlign has a Coach — a strategist that's read every interest, every score, every must-have I've got. So I ask it: what am I missing? And it doesn't hedge: Marketing and Sales share no common ground with Engineering — *that's* why nothing's green — and the debt-heavy options are dead on arrival. So it suggests a new option: one focused differentiator we can actually ship by Fall, on a clean core."

🖱️ **Actions:** Click **🧭 Coach**. Send **"What am I missing?"** Let the grounded, streamed critique land — it names the real parties/options and proposes the synthesized option.
🖥️ **On screen:** Coach modal streaming a specific, board-aware critique + a concrete suggested option.

---

### Beat 7 — Act on it → green (the payoff)  ·  ~2:22–2:35  ·  *(~34 words)*  ·  ✅ LOCKED
🎙️ **Narration:**
> "So I take its suggestion, add that option, and re-score. And there it is — the map goes green. A win-win that satisfies almost everyone, that nobody had to argue into existence. Objective criteria, not the loudest voice."

🖱️ **Actions:** Add the Coach's option (**"A focused differentiator, launch-ready by Fall"**), re-score across parties so it trends **green** and tops the option score. 👍 **Go**. Optional **"⤢ Full screen"** beauty shot.
🖥️ **On screen:** Map goes green on the new option; it's the highest option score.

---

### Beat 8 — The agreement + close  ·  ~2:35–2:55  ·  *(~47 words)*  ·  ✅ LOCKED
🎙️ **Narration:**
> "Finally, the assistant writes it all up — the shared story, the recommended win-win, and what's still unresolved. Not just a decision — a durable agreement everyone can get behind. That's how you get a yes that sticks — built on a method that's worked for forty years. That's StakeAlign."

🖱️ **Actions:** **"The agreement"** → **"✨ Draft our agreement"**. Scroll the **SCIPAB** sections; pause on **RECOMMENDED** and **"Still to resolve."** End on the logo with a soft on-screen CTA: `stakealign.fekund.com · get your stakeholders to yes`.
🖥️ **On screen:** Clean SCIPAB doc centered on the recommended option → end card / logo + CTA.

**Running narration total: ~508 words.** All 8 beats ✅ locked. **Read-aloud timing: 2:39** (Xander, 2026-08-21) — under 3:00 at demo pace, no trim needed.

---

## Prep checklist (before the take)

- [ ] Sign in with an **admitted/admin account** (avoid the waitlist gate).
- [ ] **Pre-stage** the negotiation up through the first-draft options + scores so on-camera we shoot the *story* (intake → tension → Coach → green → agreement), not data entry.
- [ ] Pre-write the **1–2 intake chat lines** so the assistant reliably surfaces the target interests (no live-AI roulette).
- [ ] **Rehearse the Coach beat** — its reply is a live, non-deterministic AI call. Lock the exact board state + the exact question until it reliably names the parties/options and proposes the demo-able-slice option; capture that take. Have a fallback phrasing ready.
- [ ] Confirm the **solo-owner path never hits a 🔒 lock** (owner bypasses the scoring gate — verify with all 4 proxied parties).
- [ ] Browser: hide bookmarks, 125–150% zoom, clean profile, no dev/console artifacts.
- [ ] **Recording:** Screen Studio — capture the screen silently, record the **voiceover separately** and sync in the editor; lean on auto-zoom for Beat 6 (Coach) & Beat 7 (map goes green).
- [ ] **Reset the board before each take** with the seed script: `DEMO_OWNER_EMAIL=you@… SEED_COMMIT=1 node --env-file=.env demo/seed-demo.mjs` (stages the pre-Coach tension board — see below).

## Decisions / open items
- **Recording tool:** ✅ Screen Studio; **voiceover recorded separately** (2026-08-21).
- **Seed data:** `demo/seed-demo.mjs` stages the pre-Coach tension board (4 parties, 6 interests incl. the reframed one + Engineering's ★ must-have, cross-party points → shared badges, 3 first-draft options, scores → red / no green winner). It deliberately **omits the Coach's winning option** so you add it live in Beat 7.

## How the live beats interact with the seed
- **Beat 3 (reframe):** "Own our biggest market moment" is already on the board (seeded). To *show* the reframe, add a throwaway interest "Announce at the Fall event," let the coaching catch it, then dismiss/accept — the real interest already exists.
- **Beat 4 (points/badges):** already seeded (badges visible). Nudge a point or two on camera to show it's live.
- **Beat 6–7 (Coach → green):** the winning option is NOT seeded — you add it live and score it so the map flips green.

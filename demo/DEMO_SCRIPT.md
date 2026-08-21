# StakeAlign — Demo Script (working draft)

> **Purpose:** the word-for-word narration + click-by-click steps for the ~2-minute product demo video. We mature both halves *together* (kept in sync, beat by beat) until it's capture-ready.
> **Status:** 🟡 First pass — everything here is up for demolition.
> **Last verified against the app:** 2026-08-21 (labels pulled from the live components).

---

## The spine (the whole demo in three sentences)

- **Problem (for a PM):** Stakeholder alignment is the hardest, slowest part of the job — five people, competing priorities, and no durable "yes."
- **Method:** StakeAlign turns *Getting to Yes* (Harvard principled negotiation) into software — surface **interests**, invent **options**, find where you already agree on a shared **map**, and lock a real **agreement**.
- **Payoff:** Weeks of meetings → a shared map and a signed agreement. And your stakeholders don't have to read the book — the assistant runs the method for them.

**The "aha" moment** (the shot everything builds to): the **Negotiation Map** lighting up **green** where stakeholders already agree — a win-win nobody had to argue into existence.

**Getting to Yes throughline** (one light touch per act, never a lecture):
`interests, not positions` → `invent options for mutual gain` → `decide by objective criteria (the map)` → `a durable agreement`. GtY = the *process*; the SCIPAB Agreement = the *artifact*.

---

## Format & constraints

- **Audience:** Product Managers (the ICP). Voice = peer-to-peer, "you know this pain," lightly credentialed by the method. Not salesy.
- **Length target:** ~2:00. Hard discipline — cut features to protect the value prop.
- **Flow:** Solo / proxy ("nudger") — one person (the PM) drives the whole thing, representing each stakeholder. One line acknowledges real stakeholders *can* join; we don't show it.
- **Narration budget:** ~2 min ≈ **~300 words**. Running total tracked per beat below.
- **Why per-beat blocks (not a 2-col table):** same "script + steps locked together" goal you had at Salesforce, but readable enough to edit line-by-line. Each beat = 🎙️ Narration / 🖱️ Actions / 🖥️ On screen.

---

## ⚠️ Decisions to lock before we polish (these change the script)

1. **Scenario.** I drafted with **"Q3 roadmap: which bet do we make?"** (parties: Product/you, Engineering, Sales, Customer Success). It's the realest PM pain and gives natural interest-conflict. Swap candidates: vendor/tool selection, or "where's the team offsite" (lighter, the app's own example). **Confirm or swap — this is decision #1.**
2. **Proxy + intake behavior — VERIFY before we shoot.** From the code read: when you're "acting as" *another* party (proxy mode), the private **Intake chat is hidden** — you go straight to the Map; the AI intake chat only runs for *your own* seat. If true, the demo shows the assistant chat **once (as yourself)**, then represents the other stakeholders directly on the map. That's actually a *nice* story (see Beat 3), but I want to confirm it live before we commit the click-steps. I can do a Playwright dry-run to prove the exact path.
3. **A few exact button labels still to confirm** (flagged inline with 🔎) — e.g. the "share my interests" button text. I'll verify these in the dry-run.

---

## Cast & scenario (the seed data we'll stage)

**Negotiation:** "Q3 roadmap — which bet do we make first?"
**Parties (seats the PM creates):**
- **Product (you)** — interest: *activation & long-term adoption*
- **Engineering** — interest: *pay down platform debt / maintainability* (★ must-have: *no new critical debt*)
- **Sales** — interest: *a demo-able feature that closes Q3 deals*
- **Customer Success** — interest: *cut churn & ticket volume*

**Options on the table:** Rebuild onboarding · Ship the integrations marketplace · Pay down platform debt · Launch the usage-analytics dashboard.
**Designed result:** *Rebuild onboarding* emerges **green** as the win-win (activation + fewer tickets + demo-able), while a pure debt-paydown scores lower — the map makes the trade-off obvious instead of political.

---

## The script

### Beat 1 — Cold open / the pain  ·  ~0:00–0:14  ·  *(~38 words)*
🎙️ **Narration:**
> "If you're a PM, you know this moment. Five stakeholders, five agendas, and you need them to agree — and *stay* agreed. This is StakeAlign. It takes *Getting to Yes* — the Harvard negotiation method — and turns it into software."

🖱️ **Actions:** Open `stakealign.fekund.com` (already signed in as an admitted account). Rest on the hero for a beat — *"Find your way to 'yes,' together."*
🖥️ **On screen:** Landing hero. Clean, calm.

---

### Beat 2 — Frame the decision  ·  ~0:14–0:26  ·  *(~30 words)*
🎙️ **Narration:**
> "Say it's our Q3 roadmap. Everyone wants something different. So instead of another meeting, I'll start a negotiation — and represent each stakeholder myself."

🖱️ **Actions:** In **"Start a new one"**, type into **"What are you working out?"** → *"Q3 roadmap — which bet do we make first?"* Click **"Create →"**.
🖥️ **On screen:** New empty workspace opens.

---

### Beat 3 — Set up the room (the "nudger" move)  ·  ~0:26–0:44  ·  *(~46 words)*
🎙️ **Narration:**
> "Here's the key idea: getting stakeholders to actually log in is the hard part. So I can just seat them myself — Engineering, Sales, Customer Success. Each *could* get a private link to represent themselves. Most won't. That's fine — the method still works."

🖱️ **Actions:** Click **"Manage parties"**. Add **Engineering**, **Sales**, **Customer Success** (**"New party name…"** + budget). Briefly hover a **"Copy invite link"** to show the option exists, then **"Done"**. Show the **"Acting as"** dropdown.
🖥️ **On screen:** PartyManager with 4 parties; "Acting as" dropdown populated.

---

### Beat 4 — Interests, not positions (the assistant)  ·  ~0:44–1:04  ·  *(~48 words)*
🎙️ **Narration:**
> "First, the assistant interviews me — privately — to get past what I *say* I want to what I actually need. That's the core of the method: interests, not positions. It does this for anyone who joins, and I never see anyone else's private chat."

🖱️ **Actions:** As **Product (you)**, open **"Meet the assistant"**. Send 1–2 pre-planned lines; assistant surfaces interests. Advance via **🔎 "Next: share what matters to you →"**. On **"What matters"**, show ★ **must-have** toggle. Then represent the other seats' interests directly (Map/What-matters), incl. Engineering's ★ *no new critical debt*.
🖥️ **On screen:** Chat → interests captured, one ★ must-have visible.

---

### Beat 5 — Weigh what matters  ·  ~1:04–1:18  ·  *(~32 words)*
🎙️ **Narration:**
> "Everyone gets ten points to weight what matters most — across *all* the interests, not just their own. Watch the badges: that's where common ground starts to show up on its own."

🖱️ **Actions:** On **"Priorities"**, allocate points with the **[− n +]** steppers across parties. Point out the **association badges** stacking on shared interests. **🔎 "Save priorities"**.
🖥️ **On screen:** Points allocated; stacked badges = early common ground.

---

### Beat 6 — Invent options  ·  ~1:18–1:30  ·  *(~28 words)*
🎙️ **Narration:**
> "Now we put options on the table — no bad ones yet, we're inventing, not deciding. And the assistant proposes a few designed for mutual gain."

🖱️ **Actions:** Open the **"Options"** tab. Add the four options (or **"✨ Suggest options"** and accept). *(Renamed from "Ideas" — GtY vocabulary.)*
🖥️ **On screen:** Four options listed on the shared board.

---

### Beat 7 — The map (the "aha")  ·  ~1:30–1:50  ·  *(~44 words)*
🎙️ **Narration:**
> "This is the whole point. Every option, scored against every interest. Green is where we already agree. And there it is — rebuilding onboarding isn't the loudest option, it's the one that quietly satisfies almost everyone. Objective criteria, not the loudest voice."

🖱️ **Actions:** Open **"Negotiation Map"**. Fill scores (○→●) so *Rebuild onboarding* trends **green**; leave a red/amber cell to show honest disagreement. Point at the **option score** number (top option highlighted). Consider **"⤢ Full screen"** for the beauty shot. Mark 👍 **Go** on the winner.
🖥️ **On screen:** Color-coded map; winning option scored highest + green.

---

### Beat 8 — The agreement (the artifact) + close  ·  ~1:50–2:05  ·  *(~40 words)*
🎙️ **Narration:**
> "Finally, the assistant writes it up — the shared story, the recommended win-win, and what's still unresolved. That's the difference: not just a decision, a durable agreement everyone can get behind. Stakeholder alignment, built on a method that's worked for forty years. That's StakeAlign."

🖱️ **Actions:** Open **"The agreement"** → **"✨ Draft our agreement"**. Scroll the **SCIPAB** sections (Situation → Benefit); pause on **RECOMMENDED** and **"Still to resolve."** End on the logo/URL.
🖥️ **On screen:** Clean SCIPAB doc with the recommended option.

**Running narration total: ~306 words (~2:00–2:05).** Tight but on budget — trimming candidates: Beat 3 and Beat 4 are the longest.

---

## Prep checklist (before the take)

- [ ] Sign in with an **admitted/admin account** (avoid the waitlist gate on a fresh account).
- [ ] Decide: **start fresh on camera** (more authentic) vs. **pre-stage** the negotiation and re-shoot only the good beats. For 2:00 polish, likely pre-stage interests/options and shoot the flow.
- [ ] Pre-write the **1–2 intake chat lines** so the assistant reliably surfaces the interests we want (no live-AI roulette on camera).
- [ ] Confirm the **solo-owner path never hits a 🔒 lock** (owner bypasses the scoring gate — verify with 4 proxied parties, not just 1).
- [ ] Browser: hide bookmarks, 125–150% zoom for legibility, clean profile, no dev/console artifacts.
- [ ] Have a **fallback option-score outcome** in mind in case live scores don't land green.

## Open questions for you
1. Scenario: keep **Q3 roadmap**, or swap? (Decision #1.)
2. Recording tool — **Screen Studio** (my rec for the polished Mac look) or your usual?
3. Want me to run the **Playwright dry-run** to verify the proxy/intake path + exact labels before we polish the words?

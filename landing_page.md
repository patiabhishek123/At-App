# AtApp — Landing Page Content (v1)

Research basis: current SaaS landing-page conventions (single-goal architecture, sub-8-word outcome headlines, above-the-fold product demos, early trust signals, mobile-first) plus a live scan of today's Product Hunt front page for tagline tone. Section order below follows the "problem → solution → product → proof → pricing → action" sequence that shows up consistently across high-converting B2B SaaS pages, adapted for AtApp's three distinct audiences (student, teacher, admin) rather than a single buyer persona.

Voice throughout stays inside the Hall Pass system: plain, warm, a little institutional, never alarmist.

---

## 1. Navigation (minimal, single goal)

Logo — **Features** — **How it works** — **Pricing** — **FAQ** — `[ Book a demo ]`

No dropdown mega-menu. Fewer paths out of the page means more people reach the CTA. The primary button stays the same label everywhere on the page: **"Book a demo"** for admins (the actual buyer), with a secondary lighter-weight link **"See it in action"** for teachers/students who land here from word-of-mouth.

---

## 2. Hero (above the fold)

**Eyebrow:** For colleges tired of paper sign-in sheets

**Headline (under 8 words, outcome-first):**
### Attendance that can't be faked. Or forgotten.

**Subhead:**
AtApp verifies who's actually in the room — then shows every student exactly where they stand, in real time. No more finding out you're short at the end of the month.

**Primary CTA:** `[ Book a demo ]`
**Secondary CTA:** `[ Watch 90-second demo ▸ ]`

**Hero visual:** Not a static screenshot — an embedded, click-through mini demo of the teacher's live rotating code and the roster filling in, running on a loop. This is the single most characteristic thing in AtApp's world, so it leads.

**Micro-trust line under the CTA:** *No credit card needed for a pilot. Set up your first department in a day.*

---

## 3. The problem (agitate, briefly)

**Section header:** The paper sheet is costing you more than time

Three short cards, not paragraphs:

1. **Proxy attendance is easy.** A signature is easy to fake or fill in for someone else — everyone knows it, nobody's fixed it.
2. **Students find out too late.** Monthly uploads mean a student can be below the safe threshold for weeks before anyone tells them.
3. **Teachers lose class time to logistics.** Every sheet passed and collected is a few minutes not spent teaching.

---

## 4. The solution (how it works — 3 steps, genuinely sequential so numbering is earned)

**Section header:** How AtApp replaces the sheet

1. **Teacher starts a session.** One tap generates a live check-in code tied to that classroom.
2. **Students check in from their seat.** The app quietly confirms they're on the right network and in the right place — no typing, no fuss.
3. **Everyone sees where they stand, instantly.** Students see their live percentage. Teachers see who's missing. Admins see it all, across every department.

*(This is a real sequence — session starts, then check-in, then visibility — so the numbered steps are informative here, not decorative.)*

---

## 5. Feature depth, split by audience (tabbed section)

Rather than one long feature list, use three tabs — **For Students / For Teachers / For Admins** — since each audience wants different proof, and a shared feature list underserves all three.

**For Students tab:**
- Real-time attendance percentage, not a monthly surprise
- Clear reasons if a check-in doesn't go through — never a silent failure
- A heads-up before you fall below the safe line, while there's still time to fix it

**For Teachers tab:**
- Start a session in one tap, no more passing sheets
- Live roster as students check in
- Manual override always available, always logged — you're never blocked by the tech

**For Admins tab:**
- Cross-department dashboards, exportable in one click
- Configurable thresholds per course
- Full audit log — every override, every verification pattern, searchable

Each tab includes one small embedded screenshot styled in the Hall Pass system (the stamp, the pastel cards) — not just text.

---

## 6. Proof / trust section

**Section header:** Built for how colleges actually run

Since AtApp is pre-launch/pilot-stage, this section leans on **specificity and transparency** rather than fabricated logos or testimonials:

- A short, honest line: *"AtApp is currently piloting with select colleges. Want to be one of the first?"*
- Security/compliance strip: **Data encrypted at rest** · **Row-level tenant isolation** · **Limited retention of location/network data** — stated plainly, each with a one-line explanation on hover, not vague badges.
- Once real pilots exist, this section upgrades to actual college logos + a 1-2 line quote from a real teacher or admin (never fabricate a quote in the meantime — an honest "currently piloting" framing converts better than a fake logo wall would, and protects credibility long-term).

---

## 7. Impact / stats bar (only once real pilot data exists — placeholder structure now)

Three numbers in large Fraunces display type, Plex Sans caption below each:

`< 10 sec` — average time to start a session
`< 5 sec` — average time to check in
`[ pilot data ]` — reduction in manual overrides vs. paper attendance

*(Leave the third blank/marked as "pilot data pending" rather than inventing a number — this section should only go live with real figures.)*

---

## 8. Pricing

**Section header:** Simple, per-department pricing

Pricing transparency is itself a trust signal in 2026 SaaS pages — showing real numbers (or a clear "contact us" reasoning) outperforms a hidden "request a quote" wall for most buyers.

| Tier | For | Price | Includes |
|---|---|---|---|
| **Pilot** | One department, one term | Free | Full feature set, up to 300 students, email support |
| **Department** | A single department, ongoing | Contact us | Everything in Pilot, priority support, custom thresholds |
| **Institution** | Multi-department, multi-college | Contact us | Everything in Department, SSO, dedicated onboarding, SLA |

CTA under the table: `[ Book a demo to get pricing for your college ]` — honest about the fact that institution-level pricing depends on scale, rather than making up a per-seat number that doesn't hold up in a real sales conversation.

---

## 9. FAQ (objection-handling, not feature-repeating)

- **What happens if a student's phone dies or has no signal?** Teachers can manually mark attendance, always logged with a reason.
- **Can students fake their location?** No single signal is trusted alone — AtApp checks network, location, and a live rotating code together, so spoofing one doesn't get you marked present.
- **What data do you store?** Only what's needed to verify attendance, and raw location/network signals are retained for a limited audit window before being reduced to a simple outcome record.
- **Do we need new hardware?** No — AtApp runs on the WiFi infrastructure your college already has.
- **How long does setup take for a new college?** A single department can be piloting within a day; classroom access points are calibrated during onboarding.

---

## 10. Final CTA (mirrors the hero — same label, same friction-reduction line)

### See attendance that actually holds up.

`[ Book a demo ]`
*No credit card needed for a pilot. Set up your first department in a day.*

---

## 11. Footer

Logo · one-line mission statement · **Product** (Features, Pricing, Security) · **Company** (About, Contact) · **Legal** (Privacy, Terms) · social links

Keep it genuinely minimal — this is not the place to re-introduce navigation choices the hero already avoided.

---

## Notes on what to hold off on

- **No fabricated testimonials or logos** until real pilot colleges exist — a transparent "currently piloting" framing is more credible than fake social proof, and this is easy to upgrade later without redesigning the page.
- **No invented stats.** Leave the impact-bar section structurally ready but populate it only once you have a real pilot's numbers.
- **Skip a comparison-vs-competitor table for v1** — you don't have a clearly named competitor category yet (this is closer to inventing a new one), and a table built against a straw-man competitor tends to read as defensive rather than confident.

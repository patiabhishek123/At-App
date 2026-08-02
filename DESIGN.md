# AtApp — Design (v1)
### Visual identity: "Hall Pass"

## 0. The thesis

Every part of this app is really about one small paper ritual: the moment a teacher hands you permission to be counted as present. A hall pass. A punch card. A stamp in a passport. That object is small, slightly bureaucratic, a little bit fun to hold, and unambiguous — either it's stamped or it isn't.

**Hall Pass** is the visual system built on that object. Soft pastel card faces (the paper) bordered by thick near-black ink (the stamp, the pen, the teacher's signature) — nothing rendered in flat corporate blue, nothing trying to look like a fintech dashboard. This is a system for a room full of teenagers and one teacher with a marker, translated into pixels.

## 1. Token system

### Color — "paper and ink"

| Token | Hex | Role |
|---|---|---|
| `ink-900` | `#15171C` | Primary near-black — borders, text, the rotating code digits, stamps |
| `ink-700` | `#2B2E36` | Secondary ink — subheads, icons at rest |
| `paper-050` | `#F8F6F0` | Base background — warm off-white, like card stock, not clinical white |
| `mint-200` | `#BFE8D4` | **Present / success** — pastel, not neon. Roster checkmarks, "on track" states |
| `blush-200` | `#F3C9D2` | **Absent / attention** — never alarming-red; a soft flag, not a siren |
| `butter-200` | `#F6E3A1` | **Pending / live session** — the color of "something is happening right now" |
| `periwinkle-200` | `#CDD3F6` | Informational accent — links, secondary buttons, admin chrome |

Rule of the palette: **pastel fills, ink edges, always.** No color ever appears without its dark-edge outline (2–3px, `ink-900`) — that outline is what keeps six soft colors from feeling like a nursery instead of a functioning tool. Think rubber-stamp ink on colored card stock, not gradients.

### Typography — "stamped, not printed"

| Role | Face | Why |
|---|---|---|
| Display / headlines | **Fraunces** (bold, high-contrast serif) | Has the slightly ceremonial, slightly stamped weight of a hall-pass letterhead or a diploma — avoids the generic geometric-sans-hero look most apps default to |
| Body | **IBM Plex Sans** | Clean, legible, quietly institutional — the "school handbook" register without being cold |
| Codes / data / the rotating check-in code | **IBM Plex Mono** | Monospace so every digit of the rotating code holds its width — legible at a glance from across a room, and reads as "system output," distinct from the human-written display face |

Display type is used sparingly — one hero moment per screen, never for body copy. Everything else stays in Plex Sans at a disciplined type scale (12 / 14 / 16 / 20 / 28 / 40).

### Layout — "the card is the unit"

Every discrete piece of information — a session, a student row, a course — renders as a **card with a visible ink border and a soft drop shadow offset down-right**, like a paper cutout sitting slightly off the table. Corners are gently rounded (8px), never sharp, never fully pill-shaped — a hall pass has soft corners from being handled, not a hard bureaucratic rectangle.

```
┌────────────────────────────┐
│  CS301 · Distributed Sys   │  ← ink-900 border, 3px
│  ░░░░░░░░ mint-200 fill    │
│                            │
│  Present today: 34 / 40    │
└────────────────────────────┘
       ╲
        ╲ (drop shadow, ink-900 @ 15% opacity, offset 4px/4px)
```

### Signature element — the rotating code, as a stamp

This is the one place the system spends its boldness. The teacher's live check-in code doesn't render as a sterile digital counter — it renders as an **ink-stamped badge**: thick black scalloped border (like a rubber stamp edge), butter-200 fill while live, digits in Plex Mono, with a subtle "stamp settling" animation (a quick scale-down-then-up, ~150ms) every time the code rotates — as if it's being re-stamped in front of the class. When the session ends, the stamp visually "presses down" once more and turns to ink-900 solid with paper-050 text, like a cancelled ticket.

Every other element in the app stays quiet by comparison — this is the one signature moment.

## 2. Applying the system to key screens

### Teacher — live session screen
```
┌───────────────────────────────────────┐
│   ● LIVE · CS301                      │   ink-900 bar, butter-200 dot pulsing
│                                        │
│      ┌───────────────────┐            │
│     ╱   4  7  2  9  1  8   ╲           │   the stamp — butter-200, thick ink border
│      ╲___________________╱            │
│         refreshes in 6s               │
│                                        │
│   Roster            34 / 40 checked in│
│   ▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░  (mint progress) │
│                                        │
│   [ End session ]                     │   ink-900 filled button, paper-050 text
└───────────────────────────────────────┘
```
The stamp is the hero. Everything below it — roster, progress — sits in quiet cards so the teacher's eye has exactly one place to check at a glance from the front of the room.

### Student — check-in screen
```
┌───────────────────────────────────────┐
│   CS301 · Attendance is open           │  Fraunces, ink-900
│                                        │
│      ┌───────────────────┐            │
│     ╱     [ scan / 4729 ] ╲            │  matches teacher's stamp shape
│      ╲___________________╱            │
│                                        │
│   ✓ Checked in                         │  mint-200 card, appears on success
│      2:03 PM · this session            │
└───────────────────────────────────────┘
```
On failure, the card renders in blush-200 instead of a harsh red alert, with a plain-language reason underneath — e.g. *"You're 340m from the classroom — move closer and try again"* — written the way a hall monitor would actually say it, not the way an error log would.

### Admin — institution dashboard
```
┌──────────────────────────────────────────────┐
│  Institution overview          [Export CSV]   │  periwinkle-200 button
│                                                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ CS Dept  │ │ EE Dept  │ │ ME Dept  │       │  cards, ink borders
│  │ 91% avg  │ │ 87% avg  │ │ 78% avg  │       │  mint / mint / blush fills
│  └──────────┘ └──────────┘ └──────────┘       │
│                                                │
│  Below threshold (12 students)         ▾      │
└──────────────────────────────────────────────┘
```
Density goes up, playfulness goes down slightly — the admin still lives in the same paper-and-ink world, but the cards get smaller and more numerous, like a filing drawer rather than a hallway bulletin board.

## 3. Motion

One orchestrated moment, not scattered effects:
- **The stamp settle** (described above) is the only recurring animation with real personality. It happens every code rotation and at session end.
- Everything else — screen transitions, list loads — uses a simple 150ms ease, no bounce, no parallax. The stamp gets to be the personality; nothing else competes with it.
- Reduced-motion users get the stamp's color change without the scale animation — the state change is still communicated, just without the movement.

## 4. Voice, applied to this system

Copy speaks like the hall-pass metaphor, not like a system log:
- Not *"Verification failed: geofence mismatch"* → **"You're a bit far from class — move closer and try again."**
- Not *"Threshold breach detected"* → **"You can miss 2 more classes and stay above 75%."**
- Not *"Session terminated"* → **"Attendance closed for today."**

Errors explain what happened and what to do next, in plain sentence case, without apologizing and without sounding like a stack trace.

## 5. What this system deliberately avoids

- No gradient gloss, no glassmorphism — this is a paper-and-ink world, not a glass one.
- No numbered-step markers (01 / 02 / 03) anywhere — nothing in this product is actually a sequence of steps; adding them would decorate rather than inform.
- No neon dark-mode-hacker palette — attendance is a warm, slightly bureaucratic, very human process, and the palette says so.

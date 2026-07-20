# Notebook Card Design System

**Date:** 2026-07-20  
**Status:** Visual language locked (concept boards + in-game CSS tokens)  
**Codename:** *Coach's Page*

---

## 1. Core identity

> **Pages torn from a professional MMA coach’s notebook, transformed into premium pixel-art RPG cards.**

The deck is not a collection of magical spells.  
It is a fighter’s **knowledge**: technique, training, fight IQ, habits, and coaching philosophy.

When a player sees a card they should think:

- “This is not a generic card game.”
- “This is MMA knowledge turned into a playable strategy system.”

### Fusion of

| Source | What we keep |
|--------|----------------|
| Coach notebook | Paper, holes, tape, graphite, red corrections, blue notes |
| Scouting report | Diagrams, stamps, checklists, opponent patterns |
| Training camp plan | Schedules, drills, recovery marks |
| Tactical game card | Clear cost, effect, category, readable hierarchy |
| Premium roguelike UI | Cohesion, rarity ladder, mastery progression |
| Pixel art | Sharp silhouettes, limited palette, sports action |

### Explicitly not

- Magic: The Gathering / Hearthstone / Pokémon layout language  
- Glossy mobile gacha frames  
- Photoreal fighters or 3D renders  
- Anime faces  
- Fantasy runes, orbs, elemental gems  

---

## 2. Concept art boards (source of truth)

| File | Purpose |
|------|---------|
| `assets/cards/design-system/01-exploration-board.jpg` | Full category language (striking → mastery) |
| `assets/cards/design-system/02-technique-examples.jpg` | Jab, Double Leg, Sprawl, Low Kick, GnP, Fight IQ |
| `assets/cards/design-system/03-mastery-progression.jpg` | Basic → Advanced → Mastered + materials strip |
| `assets/cards/design-system/04-card-anatomy.jpg` | Zones, callouts, anatomy of one premium page |

These boards are **visual targets**. Production illustrations live in `assets/cards/illustrations/` (18 plates + art-direction sheets); combat cards load them via `CARD_ILLUSTRATIONS` / `getCardIllustration()`.

---

## 3. Materials vocabulary

Use sparingly. Authenticity ≠ dirt.

| Material | Use | Limit |
|----------|-----|--------|
| Aged cream lined paper | Default card surface | Always |
| Graph paper patch | Timing / stats inset | 1 small corner |
| Binder holes (left) | Physical notebook cue | Always, left edge |
| Masking tape corners | Hold page to mat | 1–2 corners |
| Torn edge | Organic card border | Soft, not shredded |
| Graphite pencil lines | Diagrams, stance, light sketches | Primary drawing |
| Red ink | Corrections, range arrows, stamps, danger | High-priority marks |
| Blue ink | Coaching notes, entry vectors, “coach voice” | Supporting marks |
| Coffee / sweat stain | Flavor only | Mastered cards, rare |
| Staples / paperclip | Mastery / philosophy pages | Master tier |

Palette (aligns with existing game tokens where possible):

| Role | Hex / token |
|------|-------------|
| Paper body | `#f2e8d5` → `--notebook-paper` |
| Paper lines | `#d4c4a8` → `--notebook-line` |
| Graphite | `#3a342e` → `--notebook-ink` |
| Red coach mark | `#c8202f` / `--red` |
| Blue coach mark | `#2f6bbf` / `--blue` |
| Tape | `#c4a574` → `--notebook-tape` |
| Mat background | `#14110f` / `--canvas` |
| Master seal | `#c9a227` / `--belt` (sparingly) |

---

## 4. Card anatomy (three zones)

```
┌─ holes ─ TAPE ──────────────── cost ─┐
│  TOP: name · category · annotations  │
│                                      │
│  MIDDLE: pixel technique / diagram   │
│          arrows · octagon inset      │
│                                      │
│  BOTTOM: coach note · tags · mastery │
│          graph patch                 │
└──────────────────────────────────────┘
```

### Top — page heading

- Card **name** (pixel-clean sans, high contrast on paper)
- **Category** stamp or thin label (Striking / Wrestling / …)
- **Cost / energy** as a small red-ink badge (gameplay first, always readable)
- Optional micro annotation (graphite, never competes with name)

### Middle — visual concept

Must communicate the technique in under 1 second:

| Category | Preferred middle visual |
|----------|-------------------------|
| Striking | Action silhouette + range arrow |
| Wrestling | Entry sequence + level-change arrow |
| Grappling | Positional dominance + control arrows |
| Defense | Reaction lines / sprawl / cover |
| Strategy | Multi-arrow plan, fewer action poses |
| Training | Drill / schedule / equipment marks |
| Traits | Large observation stamp + short notes |

### Bottom — coach’s conclusion

Flavor line style:

> Coach's note: Use after opponent commits to forward pressure.

Gameplay block (always legible):

- Effect summary (short)
- Tags (`lead`, `setup`, `pressure`…)
- Mastery / upgrade pip

---

## 5. Category page types

Same notebook, different **ink language**:

| Category | Visual emphasis |
|----------|-----------------|
| **Striking** | Range double-arrows, combinations, impact timing graph |
| **Wrestling** | Level change, drive vectors, stance X-marks |
| **Grappling** | Octagon / mat position map, control arrows |
| **Defense** | Reaction rings, anticipate labels, reverse arrows |
| **Strategy** | Full mind-map of arrows, round notes, cut-cage diagrams |
| **Training** | Tables, checklists, recovery ticks |
| **Traits** | Red rubber-stamp titles (`ELITE TIMING`), personality notes |

---

## 6. Mastery progression

Cards evolve like a fighter’s notebook over a career.

| Tier | Paper feel | Art | Ink | Border / seals |
|------|------------|-----|-----|----------------|
| **Basic** | Plain lined cream, light pencil | Simple silhouette | Sparse red/blue | Thin tear, little tape |
| **Advanced** | Graph overlays, denser notes | Cleaner pixel pose | Full tactical arrows | Tape + graph inset |
| **Mastered** | Layered page, optional stain | Signature silhouette | Philosophy quotes, dense marks | Staples, **COACH SEAL**, belt-ink corner |

Progression message: *you are not upgrading loot — you are refining a fighting philosophy.*

---

## 7. Example cards (canonical)

### Jab (Striking · Basic→)

- Silhouette jab vs ghost opponent  
- Red **RANGE** double-arrow  
- Notes: *lead hand high · snap it back · head movement*  
- Mini octagon + timing graph  

### Double Leg (Wrestling)

- Shot entry pair  
- Blue **LEVEL CHANGE** / **DRIVE** arrows  
- Notes: *penetration step · head up · finish the drive*  

### Sprawl (Defense)

- Sprawl stop on shot  
- **ANTICIPATE** arc arrows  
- Notes: *hips down · crossface · whizzer*  
- DEFENSE stamp  

### Low Kick (Striking)

- Kick to leg + target ring (stylized, sports-appropriate)  
- Notes: *check the kick · calf meta · disrupt rhythm*  

### Ground and Pound (Grappling)

- Top control composition  
- Red **PRESSURE / DOMINANCE** down-arrows  
- Notes: *posture · elbow strikes · ground control*  
- TOP CONTROL stamp  

### Fight IQ (Strategy · unique layout)

- Dense multi-arrow map, few large poses  
- **READ & REACT** center  
- Corrections, crossed-out ideas, **COACH SEAL**  
- Visually distinct from pure technique pages  

---

## 8. In-game implementation rules

1. **Paper is the UI** — do not put notebook art *inside* a glossy frame; the paper *is* the card.
2. **Gameplay text wins** — name, cost, damage, cooldown always clear; flavor can be graphite-soft.
3. **Pixel only** — card art and icons stay in the game’s pixel language.
4. **Category color** — left ink stripe / hole accent:
   - strike → red  
   - takedown → warm orange (`#e67e22`)  
   - submission → belt gold  
   - defense → blue  
   - strategy → chalk + blue ink mix  
5. **Hand states** (combat UI):
   - available: paper lifted slightly, sharp shadow  
   - hover: more lift, stronger red corner mark  
   - disabled / CD: paper dimmed, graphite “X” feel (opacity)  
6. **No photo textures** of real athletes.

CSS entry point: `css/main.css` tokens `--notebook-*` and classes `.card-item`, `.notebook-card`.

---

## 9. Future art production checklist

For each new card id:

- [ ] Category chosen  
- [ ] Middle visual: pose **or** diagram (or both, hierarchy clear)  
- [ ] 2–4 coach notes max  
- [ ] Optional octagon inset + graph patch  
- [ ] Basic art first; Advanced/Mastered as mastery unlocks  
- [ ] Squint test at ~140px hand size  
- [ ] Side-by-side with Jab card for cohesion  

---

## 10. One-line pitch

**A premium pixel-art MMA strategy game where every card is a page from a coach’s personal fight notebook — knowledge you earn, annotate, and master.**

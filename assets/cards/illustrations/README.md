# Card illustrations (v2 — tactical plates)

**Rule:** art is pose + arrows only. The **card frame is CSS** (mat, red corner stripe, tags).  
Do **not** put notebook paper, tape, binder holes, or titles in the PNG.

## Style

- Background: dark mat `#14110f`
- Pixel fighters, high contrast
- Red = pressure / impact / range
- Blue = coach movement / defense / training
- No text, stamps, graphs, or paper chrome

## Active game cards

| Card id | File |
|---------|------|
| jab | jab.png |
| cross | cross.png |
| overhand | overhand.png |
| highKick | high-kick.png |
| doubleLeg | double-leg.png |
| takedownDefense | sprawl.png |
| rearNaked | rear-naked.png |
| clinchKnee | clinch-knee.png |
| legKick | low-kick.png |
| singleLeg | single-leg.png |
| elbowStrike | clinch-knee.png (temp) |
| groundAndPound | ground-and-pound.png |
| armbar | armbar.png |

## Extra plates (strategy / training / traits)

pressure, fight-at-range, attack-the-body, film-study, boxing-camp, wrestling-camp, cardio-training, iron-chin, heavy-hands, elite-cardio, clutch-fighter, veteran-experience

## Sheets

- `sheet-tech-core.jpg` — jab, double-leg, sprawl, low-kick, gnp, cross  
- `sheet-tech-more.jpg` — overhand, high-kick, clinch-knee, single-leg, rear-naked, armbar  
- `sheet-strategy-traits.jpg`  
- `sheet-training-traits.jpg`  

Legacy moodboards (paper concept only): `../design-system/`

Wire: `js/config/card-config.js` → `CARD_ILLUSTRATIONS` / `getCardIllustration()`  
Crop: `python scripts/crop-card-illustrations.py`

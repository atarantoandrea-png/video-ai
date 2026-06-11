# thumbnail-spec.md — Concept copertina + prompt GPT-image + composizione

Obiettivo: **2-3 concept per video**, ciascuno = (idea visiva di **CURIOSITÀ**) + (testo-copertina ≤5
parole) + (**prompt GPT-image fotorealistico per lo SFONDO**) + (note di composizione). Il prompt genera
**solo lo sfondo/scena**: la **foto di Elisa** (personal brand, sempre presente) viene composta sopra, e il
**titolo grande** viene aggiunto in fase di composizione. Quindi ogni prompt deve **lasciare spazio
negativo** per lei e per il titolo. Parola d'ordine: **CURIOSITÀ**, e **più realistico possibile**.

## Come scrivere ogni variante
1. **Visual (curiosità)**: una scena che apre un loop legato al video. Consulto = calore/presenza/luce;
   Community = un oggetto simbolico del tema. **Una sola idea** (regola del secondo).
2. **Testo copertina**: pescalo da `house-style.md` §2 (≤5 parole).
3. **Prompt sfondo GPT-image**: fotorealistico, cinematografico, con **spazio vuoto esplicito** e
   **niente persone / niente testo** (Elisa + titolo vanno sopra).
4. **Note composizione**: dove va Elisa, dove/quanto grande il titolo, contrasto/palette.

## Regole di composizione (1280×720, 16:9)
- Ragiona per **terzi**. **Elisa**: terzo destro (o sinistro), **mezzo busto**, **occhi in camera**,
  emozione ma calda. Il suo lato è quello "pieno"; il terzo opposto resta **pulito** per il titolo.
- **Titolo**: 2-4 parole enormi sul terzo pulito, sans-serif bold, **bianco con ombra/bordo scuro**
  leggibile su qualunque sfondo; ≤5 parole → leggibile su telefono (regola del secondo).
- **Contrasto/CTR**: sfondo più scuro/morbido dietro al titolo; una **luce calda** vicino a Elisa per
  staccarla dalla scena. Palette: **Consulto** = ambra + blu notte (intimo, "aldilà"); **Community** =
  viola/oro morbidi (spirituale).
- **Fotorealismo**: chiedi luce realistica, profondità di campo, grana naturale — **evita**
  illustrazione/cartoon. Inserisci sempre clausole "no text, no watermark, no people in the clean third,
  leave empty space".

## Template prompt sfondo
```
Photorealistic cinematic background for a YouTube thumbnail, 16:9, <mood>.
Scene: <scena simbolica e a tema>. Soft warm light source on the <right/left> side.
Shallow depth of field, natural film grain, true-to-life colors (<palette>).
Composition: keep the <left/right> third visually clean and darker for a large text
overlay; keep the <opposite> third open for a person to be added later.
No people, no text, no logos, no watermark. Ultra-detailed, high resolution,
realistic photography style.
```

## Esempi compilati

### Consulto — Variante A ("La luce che resta"), testo `È tornato per proteggerla`
```
Photorealistic cinematic background for a YouTube thumbnail, 16:9, intimate and emotional.
Scene: a softly blurred dark interior at night with a single warm candle-like glow and faint
floating particles of light, suggesting a gentle unseen presence. Soft warm amber light from the
right, deep night-blue shadows on the left. Shallow depth of field, natural film grain, true-to-life
colors (amber + midnight blue). Composition: keep the LEFT third clean and darker for a large
two-line text overlay; keep the RIGHT third open for a person to be added later. No people, no text,
no logos, no watermark. Ultra-detailed, realistic photography style.
```
Note: Elisa terzo destro, mezzo busto, mano sul cuore; titolo `È tornato\nper proteggerla` terzo sinistro,
bianco bold con ombra.

### Community — Variante A, testo `le 5 ferite dell'anima`
```
Photorealistic cinematic background for a YouTube thumbnail, 16:9, spiritual and calm.
Scene: a soft purple-to-gold gradient haze with subtle light rays and a faint, out-of-focus open book
glowing gently in the lower area. Warm golden light from the right, gentle violet shadows on the left.
Shallow depth of field, natural grain, realistic colors (violet + warm gold). Composition: keep the LEFT
third clean for large text; keep the RIGHT third open for a person added later. No people, no text, no
logos, no watermark. Ultra-detailed, realistic photography style.
```
Note: Elisa terzo destro, espressione calma/aperta; titolo `le 5 ferite\ndell'anima` terzo sinistro,
minuscolo grande, bianco con ombra; alto contrasto sulla foschia viola.

## Sempre
- Produci **2-3 varianti** (metafora visiva / lato di Elisa / palette diversi) così Andrea sceglie la più
  ad alta curiosità.
- Ricorda: il **volto di Elisa resta interamente visibile** (personal brand). In modalità manuale,
  consegna il prompt; in `comando io gpt`, vedi `cover-auto.md`.

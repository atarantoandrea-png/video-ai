# thumbnail-spec.md — Copertina generata DA GPT (prompt completo)

**Decisione di Andrea**: la **parte grafica la fa tutta GPT** (è migliore di Claude per la grafica).
Quindi la copertina — **sfondo + volto di Elisa + titolo** — la **genera GPT** da un prompt, con una
**foto di Elisa allegata** di cui GPT **riproduce fedelmente il volto**. Il compito della skill è scrivere
il **prompt perfetto** (curiosità, fotorealistico) e scegliere la foto di riferimento. **Niente
ritaglio/composizione lato Claude.**

## Cosa produce la skill (per ogni video: 2-3 varianti)
Per ogni variante un **prompt copertina COMPLETO** pronto da incollare in ChatGPT (con foto allegata), che
descrive:
1. **Formato**: copertina YouTube **fotorealistica 16:9 (1280×720)**, cinematografica, ad alto CTR, **una
   sola idea** (regola del secondo).
2. **Elisa**: «RIPRODUCI FEDELMENTE il volto della donna nella foto allegata», **mezzo busto**, sguardo in
   camera, espressione coerente col tema (dolce per Consulto, calma per Community), in un terzo del frame.
3. **Scena (curiosità)**: ambientazione simbolica a tema, fotorealistica (Consulto: luce calda/presenza/
   particelle; Community: oggetto simbolico del tema).
4. **Titolo**: il testo-copertina (≤5 parole) **grande, leggibile, alto contrasto**, sul terzo libero,
   bianco con ombra. (NB: GPT a volte **sbaglia il testo italiano** → se serve, rigenera o correggi.)
5. **Palette/luce**: Consulto ambra+blu notte; Community viola+oro. Luce realistica, profondità di campo.
   «Niente loghi, niente watermark.»

## Template prompt (copertina completa)
```
Crea una copertina YouTube fotorealistica 16:9 (1280×720), stile cinematografico ad alto impatto.
Soggetto: una donna — RIPRODUCI FEDELMENTE il volto della donna nella foto allegata — a mezzo busto sul
lato <destro/sinistro>, sguardo <espressione> verso la camera. Scena: <ambientazione a tema, curiosità>.
<luce/palette>. Testo grande e ben leggibile sul lato <opposto>, due righe: «<TITOLO COPERTINA>», font
grassetto bianco con ombra per il contrasto. Fotorealistico, nitido, profondità di campo, colori
<palette>. Niente loghi, niente watermark.
```

## Esempio (Consulto, «È tornato per proteggerla»)
```
Crea una copertina YouTube fotorealistica 16:9 (1280×720), stile cinematografico ad alto impatto.
Soggetto: una donna — RIPRODUCI FEDELMENTE il volto della donna nella foto allegata — a mezzo busto sulla
destra, sguardo dolce e commosso verso la camera, una mano sul cuore. Scena: interno scuro e intimo di
notte, una calda luce ambrata di candela alle sue spalle e tenui particelle di luce sospese che suggeriscono
una presenza invisibile; ombre blu notte sul lato sinistro. Testo grande e ben leggibile sul lato sinistro,
due righe: «È tornato per proteggerla», font grassetto bianco con leggera ombra. Fotorealistico, nitido,
profondità di campo, colori ambra e blu notte. Niente loghi, niente watermark.
```

## Esempio (Community, «le 5 ferite dell'anima»)
```
Crea una copertina YouTube fotorealistica 16:9 (1280×720), stile spirituale e calmo.
Soggetto: una donna — RIPRODUCI FEDELMENTE il volto della donna nella foto allegata — a mezzo busto sulla
destra, espressione serena e aperta verso la camera. Scena: foschia morbida dal viola all'oro con tenui
raggi di luce e un libro aperto sfocato che brilla in basso. Luce dorata calda da destra. Testo grande e
ben leggibile sul lato sinistro: «le 5 ferite dell'anima», font grassetto bianco con ombra. Fotorealistico,
nitido, colori viola e oro caldo. Niente loghi, niente watermark.
```

## Sempre
- Produci **2-3 varianti** (scena/lato/palette diversi) così Andrea sceglie la più ad alta curiosità.
- Generazione + allegato della foto: vedi `cover-auto.md` (modalità `comando io gpt`).

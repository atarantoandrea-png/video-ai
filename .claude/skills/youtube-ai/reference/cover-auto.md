# cover-auto.md — Copertina con GPT (modalità `comando io gpt`)

La copertina la **genera interamente GPT** (sfondo + volto di Elisa + titolo). **Niente ritaglio/
composizione lato Claude** (scelta di Andrea: GPT è migliore per la grafica). Due modi a runtime:
- **`comando io gpt`** → prendo il controllo del Mac e **piloto io ChatGPT**.
- **manuale** → ti do il **prompt** + ti dico **quale foto allegare**, e lo generi tu in ChatGPT.

## Materiali
- **Foto di Elisa**: scegli dal **database `cover-images.md`** (le foto pulite a sfondo neutro/studio),
  in base all'**emozione** del video. Lì trovi filename + lato `spazio` per il titolo. File in
  **`~/Desktop/Carosello/Elisa immagini/`**.
- **Prompt copertina**: dal Pack (variante scelta), vedi `thumbnail-spec.md`. Ricorda: il prompt descrive
  **solo sfondo/grafica/contesto** e dice a GPT di **usare la persona IDENTICA** alla foto (non descriverla).

## Procedura `comando io gpt`
1. **Scegli la foto** dal database `cover-images.md` (emozione coerente col video; es. consulto d'amore/lutto
   → gesto del cuore).
2. **Apri ChatGPT** (app nativa → computer-use full tier; `request_access` per ChatGPT). Nuova chat.
3. **Allega quella foto** (pulsante allega/📎 → file) e **incolla il prompt** (che dice a GPT di usare la
   persona della foto **identica** + descrive solo sfondo/contesto + titolo).
4. **Genera** → attendi l'immagine → **scaricala** (di norma in `~/Downloads`).
5. **Mostra** l'anteprima ad Andrea (apri il file / screenshot). Se il **testo** è sbagliato o la resa non
   convince → **rigenera** ritoccando il prompt, o prova un'altra variante/foto.
6. Usa il file nella **Fase 7** di `youtube-studio.md` (impostalo come copertina del video).

## Note
- GPT a volte **sbaglia il testo italiano** dentro le immagini: controlla l'ortografia del titolo; se è
  sbagliato, **rigenera** (o, solo come ultima spiaggia, correggi il testo con un overlay).
- Mira a **fotorealismo** e **una sola idea** (regola del secondo) — vedi `thumbnail-spec.md`.
- L'immagine deve restare **1280×720 (16:9)**; se GPT la genera quadrata, chiedi esplicitamente 16:9 o
  ritaglia al volo a 1280×720.

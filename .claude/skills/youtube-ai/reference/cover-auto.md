# cover-auto.md — Copertina con GPT (modalità `comando io gpt`)

La copertina la **genera interamente GPT** (sfondo + volto di Elisa + titolo). **Niente ritaglio/
composizione lato Claude** (scelta di Andrea: GPT è migliore per la grafica). Due modi a runtime:
- **`comando io gpt`** → prendo il controllo del Mac e **piloto io ChatGPT**.
- **manuale** → ti do il **prompt** + ti dico **quale foto allegare**, e lo generi tu in ChatGPT.

## Materiali
- **Foto di riferimento di Elisa**: da **`~/Desktop/Carosello/Elisa immagini/`** (156 foto). Scegli una
  **frontale, ben illuminata, volto ben visibile** (GPT riproduce il volto da questa). Annota quale.
- **Prompt copertina completo**: dal Pack (variante scelta), vedi `thumbnail-spec.md`.

## Procedura `comando io gpt`
1. **Scegli la foto** di Elisa adatta (frontale, volto nitido, espressione coerente col tono del video).
2. **Apri ChatGPT** (app nativa → computer-use full tier; `request_access` per ChatGPT). Nuova chat.
3. **Allega la foto** di Elisa (pulsante allega/📎 → file) e **incolla il prompt completo** (che chiede a
   GPT di riprodurre fedelmente il volto dalla foto + scena + titolo).
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

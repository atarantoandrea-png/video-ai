# cover-auto.md — Copertina automatica (modalità `comando io gpt`)

Due modi per la copertina, **scelti a runtime** da Andrea:
- **`comando io gpt`** → automatico (questo file): genero lo sfondo con ChatGPT e **compongo** la
  copertina con una foto di Elisa + il titolo.
- **prompt manuale** → consegno solo il prompt + concept (da `thumbnail-spec.md`) e Andrea fa la
  copertina in GPT. (Fallback sempre valido se l'automazione fallisce.)

## Materiali
- **Foto di Elisa**: nella cartella **`…/Carosello/Elisa immagini/`** (Andrea conferma che esiste, piena
  di foto). Se non la localizzo: `find`/`ls` nelle posizioni probabili (Desktop, Downloads, dentro la
  cartella del progetto/carosello) o **chiedo il percorso** ad Andrea la prima volta.
- **Prompt sfondo**: dal Pack (variante scelta), vedi `thumbnail-spec.md`.

## Procedura `comando io gpt`
1. **Scegli la foto di Elisa** adatta al tono del video (espressione coerente: dolce per Consulto, calma
   per Community). Annota quale.
2. **Genera lo SFONDO con ChatGPT**:
   - L'app **ChatGPT** è nativa → si può pilotare con il **computer-use a pixel** (tier "full" sulle app
     desktop), oppure ChatGPT web via `claude-in-chrome`.
   - Apri una nuova chat → incolla il **prompt sfondo** (fotorealistico, niente persone/testo, spazio per
     Elisa + titolo) → genera → **scarica l'immagine** sfondo.
   - `request_access` per ChatGPT prima di pilotarlo.
3. **Componi la copertina** (script Python, 1280×720):
   - Carica lo **sfondo** (ridimensiona/croppa a 1280×720).
   - **Ritaglia Elisa**: se la foto NON è già un PNG trasparente, rimuovi lo sfondo con **`rembg`**
     (`pip install rembg pillow` se serve), poi incolla il ritaglio nel terzo previsto (destra/sinistra),
     mezzo busto, dimensione ~60-75% dell'altezza.
   - **Titolo copertina** (≤5 parole) sul terzo pulito: font bold grande (es. Montserrat/Arial Bold ~110-150px),
     **bianco con ombra/bordo scuro**, su 1-2 righe, leggibile a misura telefono.
   - Esporta `copertina.png` (o .jpg <2MB) in una cartella di sessione.
   - Schema script (Pillow): apri sfondo → `paste` ritaglio Elisa (con maschera alpha) → `ImageDraw.text`
     col titolo (stroke per il bordo) → `save`.
4. **Mostra l'anteprima** ad Andrea (apri il file / screenshot) per un ok rapido, poi usala nella **Fase 7**
   di `youtube-studio.md`.

## Note
- Il **volto di Elisa resta interamente visibile** (personal brand): non coprirlo col titolo.
- Mira al **fotorealismo** e a **una sola idea** (regola del secondo) — vedi `thumbnail-spec.md`.
- Se la generazione/composizione dà problemi (rembg impreciso, font mancante, ChatGPT non collaborativo),
  **fallback** al prompt manuale: consegna il prompt e il concept, Andrea finalizza e mi indica il file.
- La copertina può comunque arrivare **in Sessione 2**: se generata in auto, posso prepararla già in
  Sessione 1 e impostarla quando Andrea dà data/ora; oppure generarla al momento del ripristino.

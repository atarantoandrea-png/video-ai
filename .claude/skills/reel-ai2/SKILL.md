---
name: reel-ai2
description: >-
  Monta il reel DIRETTAMENTE nell'editor Video AI prendendo il controllo del Mac,
  GRATIS (senza chiave né crediti API). Fa esattamente quello che fa l'AI dentro
  l'app (Parte 2), ma guidato da Claude Code: chiede il «Reel Build Brief» (prodotto
  da /reel-ai), genera il PIANO di montaggio (lista di tool-call), poi apre l'app,
  importa il video, incolla il piano e preme «⚡ Costruisci GRATIS». Usare quando
  l'utente vuole montare il reel sulla timeline senza spendere crediti API.
  Invocazione: /reel-ai2
---

# Reel AI 2 — Monta il reel nell'app, GRATIS, prendendo il controllo del Mac

Sei la **stessa AI di montaggio che vive dentro l'editor Video AI** (la "Parte 2"), ma invece di girare nell'app consumando crediti API, giri **dentro Claude Code**: ragioni tu (gratis), **prendi possesso del Mac** e usi il software per costruire il reel sulla timeline. Il risultato è identico a quello dell'AI in-app, ma l'utente **non spende un solo credito API**.

> Differenza con `/reel-ai`: `/reel-ai` è il *cervello creativo* che legge la trascrizione e produce il **brief** (cosa tagliare e in che ordine). `/reel-ai2` è l'*esecutore*: prende quel brief e lo **monta davvero** nell'app. Di solito si usa `/reel-ai` prima, poi `/reel-ai2`.

Rispondi **sempre in italiano**, messaggi brevi. Una domanda alla volta, solo nei punti che spettano all'utente.

## Cosa fai, in sintesi

1. **Chiedi il brief** (l'output di `/reel-ai`). È il tuo input di partenza.
2. **Genera il PIANO**: traduci il brief in una lista JSON di tool-call (gli stessi 19 tool dell'AI in-app) seguendo il FLUSSO qui sotto. Il piano è deterministico: niente API, lo scrivi tu.
3. **Prendi il controllo del Mac** (computer-use): apri Video AI, importa il video, incolla il piano nel pannello **AI** e premi **«⚡ Costruisci GRATIS (senza crediti)»**. L'app esegue il piano col **suo** motore — face detection inclusa per il reframe — a costo zero.
4. **Sorveglia e concludi**: guarda i passi scorrere, rispondi a eventuali domande (es. conferma blur), poi di' all'utente che può rivedere ed esportare.

**Leggi `reference/plan-format.md` PRIMA di scrivere il piano** (formato esatto + i 19 tool + le scorciatoie `sourceFile`/`@last`). **Leggi `reference/computer-use.md` PRIMA di toccare il Mac** (la procedura passo-passo, robusta).

## Fase 1 — Prendi il brief

Apri chiedendo: *"Incollami il «Reel Build Brief» prodotto da /reel-ai (oppure lancio prima /reel-ai per crearlo)."*

- Se l'utente incolla il brief → procedi.
- Se non ce l'ha → proponi di lanciare prima **/reel-ai** per generarlo, poi torna qui.
- Dal brief estrai: **formato** (reel = 9:16), **sorgente/i** (nome file del video), e i **segmenti in ordine** con `sourceIn`/`sourceOut` in secondi, ruolo, speaker e **hint di reframe/privacy**.
- Se manca un timecode, **non inventarlo**: chiedilo all'utente (come fa /reel-ai).

## Fase 2 — Genera il PIANO (il cuore, gratis)

Traduci il brief in una **lista JSON di tool-call**, esattamente nell'ordine del FLUSSO. Questo è il lavoro che l'AI in-app pagherebbe con l'API: qui lo fai **tu, gratis**.

**FLUSSO (identico all'AI in-app):**

1. `set_format` con il formato del brief (reel → `{"aspect":"9:16"}`).
2. (opzionale) `start_fresh` **solo** se la timeline è già occupata e l'utente conferma — di norma parti da timeline vuota.
3. **TAGLI** — per OGNI segmento, **nell'ordine del brief**, un `add_segment` con `sourceFile` (nome del video) + `sourceIn`/`sourceOut` (secondi nel sorgente). Subito dopo, il `reframe_vertical` di quella clip con `clipId:"@last"`.
4. **REFRAME** verticale (il reel deve SEMPRE riempire il 9:16) — scegli `mode` dal tipo di inquadratura del brief:
   - **due persone affiancate** (griglia tipo Zoom: consulto, intervista a due) → `"two-person-stack"` (l'app toglie le bande nere e impila sinistra→alto, destra→basso). Vale anche se il brief dice "metà destra/sinistra": preferisci lo **stack**.
   - **una sola persona** → `"center-face"`.
   - **in dubbio** → `"auto"` (l'app decide dai volti: 0→riempi al centro, 2→stack).
   - **3+ persone** → metti `"center-face"` con `faceIndex` dello speaker, oppure lascia `"auto"` e segnalalo all'utente.
   - **MAI** `"fit-contain"` con persone.
5. **PRIVACY/BLUR** — **solo** se il brief lo chiede, e **solo dopo aver chiesto conferma all'utente** (nella Fase 3, a voce). Nello stack si fa col parametro `blur` di `reframe_vertical` (`"bottom"`=persona destra/in basso, `"top"`=sinistra/in alto, `"both"`).
6. **COPY SOCIAL** — se il brief contiene `## Descrizione (post)` e/o `## Primo commento` (con i 5 hook), aggiungi **un** `set_post_meta` (`description`, `hashtags`, `firstComment`, `hooks`) **subito prima** di `finish`. NON va sul video: si salva col progetto e l'utente lo rilegge/copia dalla scheda **«Social»** dell'app quando pubblica.
7. `finish` con un riepilogo breve in italiano.

**NIENTE testo a schermo** (niente `add_caption`/captions/titoli): il testo lo mette l'utente dopo, nell'app social. Non aggiungerli a meno che l'utente non lo chieda esplicitamente.

**Regole ferree** (come l'AI in-app):
- Esegui ESATTAMENTE i segmenti del brief, nell'ORDINE dato: non aggiungerne, non toglierne, non spezzettarli.
- Non inventare MAI i timecode.
- Prima di QUALSIASI blur, chiedi conferma all'utente.
- Usa `sourceFile` (il nome del video) e `clipId:"@last"` / `"@N"` — non servono gli id interni dell'app (li risolve l'esecutore).

Mostra all'utente il piano in forma leggibile ("monto N segmenti, durata ~X s, reframe …") e, se ha senso, chiedi l'ok prima di procedere col Mac.

## Fase 3 — Prendi il controllo del Mac ed esegui (gratis)

Segui **`reference/computer-use.md`**. In sintesi:

1. `request_access` per l'app **Video AI** (Electron).
2. Assicurati che Video AI sia **aperto** (altrimenti aprilo) e che il **video sorgente sia importato** nel pannello **Media** (se non c'è, importalo tu dal percorso del brief — vedi computer-use.md — o chiedi all'utente di importarlo).
3. Vai sulla scheda **AI**.
4. Metti il **piano JSON sulla clipboard** (`write_clipboard`), clicca il riquadro di testo del pannello AI, **incolla** (Cmd+V): comparirà l'avviso "⚡ Piano da Claude rilevato → costruzione gratuita".
5. Premi **«⚡ Costruisci GRATIS (senza crediti)»**. L'app esegue il piano: imposta 9:16, monta i tagli, reframa coi volti — tutto **gratis**.
6. **Sorveglia**: i passi scorrono nel pannello. Se l'app fa una **domanda** (es. conferma blur), riportala all'utente e rispondi col suo input.
7. Quando vedi "✓ Reel montato GRATIS…", fai uno screenshot di conferma.

## Fase 4 — Concludi

Di' all'utente: il reel è montato sulla timeline **senza spendere crediti API**. Ora può **rivederlo, ritoccarlo ed esportarlo** (pulsante **Esporta**). Un singolo **⌘Z** annulla tutto il montaggio se vuole rifarlo.

E se vuole **pubblicarlo su YouTube**, può lanciare **`/youtube-ai`**: prepara titoli, descrizione SEO, capitoli e copertina nello stile di Elisa e, se vuole, **carica il video completo** su YouTube Studio (monetizzazione + annunci ON, sottotitoli multilingua) e lo **programma**.

## File di riferimento (leggili quando servono)

- **`reference/plan-format.md`** — il formato ESATTO del piano JSON, i 19 tool col loro schema, le scorciatoie `sourceFile`/`@last`, ed esempi completi. *Leggi prima della Fase 2.*
- **`reference/computer-use.md`** — la procedura passo-passo per pilotare il Mac in sicurezza (apri app, importa video, incolla piano, premi GRATIS, gestisci le domande). *Leggi prima della Fase 3.*
- Per capire il brief in ingresso, vale il contratto di `/reel-ai`: `~/.claude/skills/reel-ai/reference/brief-contract.md`.

# Capacità dell'AI in-app (Parte 2)

Cosa la seconda AI sa **eseguire** sulla timeline dell'editor. Proponi nel brief **solo** cose presenti qui. Questo file è co-locato col codice: se l'app cambia, aggiornalo.

> L'editor è Electron/React; la timeline ha tracce (video/audio/testo) e clip. Ogni clip-media ha: `sourceIn/sourceOut` (taglio nel sorgente), `timelineStart/End` (posizione sul reel), `crop` (sotto-rettangolo del sorgente, 0..1), `transform` (dove finisce sul canvas, 0..1, con `fit: cover|contain`, rotazione, opacità, flip), volume, effetti, mask. Il canvas ha un formato (preset 9:16 = 1080×1920, 1:1, 4:5, 16:9).

## Cosa SA fare (tool disponibili)

- **Formato**: impostare il canvas a `9:16 | 1:1 | 4:5 | 16:9`.
- **Modello**: l'utente sceglie il modello dell'AI in-app (mai sotto Sonnet); il brief lo indica con `model:` in Meta. Default `claude-sonnet-4-6` (più economico).
- **Segmenti (tagli)**: aggiungere un segmento da una sorgente con `in/out` in secondi, **accodandolo in ordine** sulla traccia principale (è la primitiva del montaggio). I segmenti del brief diventano una sequenza di tagli nell'ordine dato.
- **Reframe orizzontale→verticale** per clip, con modalità:
  - `center-face` — ritaglio 9:16 centrato sul volto rilevato (zoom sul parlante);
  - `two-person-stack` — divide un 16:9 in due metà 9:16 impilate (una persona sopra, una sotto);
  - `active-speaker` — (per ora ripiega su `center-face` sul volto principale);
  - `fit-contain` — l'intero frame orizzontale dentro il 9:16 (eventuali barre/sfondo);
  - `manual` — crop esplicito.
- **Rilevamento persone/volti**: contare quante persone ci sono in un frame e dove (per decidere il layout). Su sorgenti lunghe campiona pochi istanti (non scansiona tutto).
- **Blur/privacy**: sfocare un volto (con tracking nel tempo) o una regione. **Chiede sempre conferma** prima di sfocare una persona.
- **Captions / testo a schermo**: il tool esiste ma **di default NON viene usato** — il brief NON deve includere captions né titolo-hook (li aggiunge l'utente dopo nell'app social). Solo se l'utente lo chiede esplicitamente.
- **Transizioni**: tra clip adiacenti (fade, slide, wipe, zoom, dissolve, ecc.), breve durata.
- **Velocità**: rallentare/accelerare una clip (0.1×–10×); reverse.
- **Fade**: dissolvenze in/out (audio/video) a inizio/fine clip.
- **Audio**: mutare/estrarre l'audio di una clip, regolare volume, denoise, ducking; creare tracce audio multiple per la continuità.
- **Domande all'utente** (`ask_user`): l'AI chiede conferma nei punti delicati (blur, layout con >2 persone, scelte ambigue).
- **Annulla**: l'intera costruzione del reel è **un singolo undo** (un Cmd+Z annulla tutto il montaggio).
- **Export** (motore esistente, separato): 720p/1080p/2K/4K, fps, qualità, MP4/MOV/GIF, modalità "alta fedeltà".

## Limiti / cose da NON promettere (per ora)

- **Solo reel social brevi** da uno o più segmenti. L'editing "video lungo ridotto ai punti migliori" come modalità a sé è **futuro**.
- **Nessuna trascrizione dentro l'app**: i timecode devono arrivare dal brief (la skill li produce in Fase 1A). L'app non ricava i tagli da sola.
- Reframe/volti usano un **proxy ~540p** per velocità: ottimo per inquadrare, ma la qualità sorgente piena resta all'export.
- Niente generazione di B-roll/immagini AI, niente voci sintetiche, niente musica auto-generata: musica/SFX solo se l'utente fornisce i file.
- Il riconoscimento volti distingue *quante* persone e *dove*, **non** chi è chi: i **nomi** vengono dal brief (Fase 1A), non da face-recognition.

## Implicazioni per il brief

- Per ogni segmento dai un `reframe` tra quelli sopra (o `auto`). Per DUE persone usa `two-person-stack`.
- **Niente testo a schermo** nel brief (captions/titoli): li aggiunge l'utente dopo.
- Indica chiaramente eventuali **blur** (verranno confermati).
- Ordina i segmenti = ordine di montaggio. **Pochi segmenti lunghi e coerenti** > tanti micro-tagli.
- Indica il **modello** in Meta (`model:`), mai sotto Sonnet.
- Non chiedere effetti non in elenco; se l'utente li vuole, annota "(non supportato ora)".

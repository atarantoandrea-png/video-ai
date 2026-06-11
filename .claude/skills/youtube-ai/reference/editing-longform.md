# editing-longform.md — Montaggio long-form orizzontale (riferimento per `/youtube-ai`)

Riferimento pratico per trasformare un video lungo e orizzontale (vlog, podcast, consulto, talk — anche 10h)
in un long-form YouTube più stretto e ottimizzato per la retention (es. 2-3h), partendo dalla **trascrizione**
e producendo un **EDIT PLAN** che l'app "Video AI" esegue.

Principio guida: **il long-form resta ORIZZONTALE (16:9). Niente reframe verticale.** Il montaggio = scegliere
le porzioni da TENERE; i tagli sono i **buchi** tra le porzioni tenute.

> Coerente con le preferenze fisse del progetto (vedi `../reel-ai/reference/expert-knowledge.md`): **qualità e
> completezza del contenuto > ottimizzazione delle metriche.** Si taglia per togliere lo scarto, non per
> mutilare la sostanza.

---

## 1. Cosa TAGLIARE e cosa TENERE

**TAGLIA (lo scarto che uccide la retention):**
- **Aria morta / silenzi lunghi**: pause oltre ~1s, attese, "vuoti" tecnici.
- **Filler / intercalari**: "ehm", "uhm", "cioè", "tipo", "no?", "diciamo", "insomma" (EN: um/uh/like/you know/so).
- **False partenze e auto-correzioni**: tieni solo la versione buona.
- **Ripetizioni / ridondanza**: stesso concetto ridetto 3 volte → tieni il take migliore.
- **Tangenti / off-topic**: divagazioni che allontanano dal filo.
- **Intoppi tecnici**: starnuti, rumori, "aspetta riprendo", problemi audio/video.
- **Intro deboli / rambling iniziale**: convenevoli, riscaldamento prima di entrare nel vivo.

**TIENI (la sostanza e ciò che fa restare):**
- La **sostanza**: spiegazioni chiare, risposte forti, la tesi, i momenti "aha".
- I **beat emotivi**: commozione, risata, lo scambio acceso, la rivelazione. (Da testo non sempre si vedono:
  estrai fotogrammi nei punti dubbi — vedi `../reel-ai/reference/transcription.md`.)
- Il **payoff promesso**: ciò che l'hook anticipa DEVE arrivare nel corpo.
- Le **pause "buone"**: una pausa drammatica che pesa va tenuta. Non tutti i silenzi sono scarto.

**Regole del pollice:**
- **Non rimuovere OGNI filler**: toglierli tutti rende il parlato innaturale/a scatti. Togli quelli che
  disturbano, lascia il respiro.
- **Sii spietato ma riascolta**: dopo un taglio pesante, verifica che la sezione fili e non sia sconnessa.
- **Ogni taglio serve la storia, non l'editor.**

## 2. Pacing & retention per il long-form

- **Cold open / hook nei primi 30s**: apri col pezzo più forte/curioso (spesso una frase di più avanti,
  **spostata all'inizio**). Niente preamboli. La caduta più ripida è tra il **secondo 10 e il 20**.
- **Stringi di più i primi minuti**; poi, una volta agganciato, **allarga** la distanza tra i tagli (25-40s)
  quando il messaggio si regge da solo.
- **Mantieni il momentum**: nelle parti che calano, taglia o accelera; cambia ritmo/energia ai cambi di tema.
- **Soglia minuto 8**: superata, YouTube tende a spingere di più → tieni l'energia almeno fin lì.
- **Retention**: >70% buono, >80% eccezionale; sotto ~50% nei primi 10-15s = hook che non funziona.
- **Autenticità**: in un brand intimo/parlato (consulto, vlog) **preserva voce e respiri** — meglio under-cut
  che over-cut.
- **Chaptering**: dividi in **capitoli** con timecode **reali** (primo `00:00`) → navigazione + retention; i
  tempi confluiscono nel «YouTube Pack».

## 3. Workflow transcript/text-based

L'editing si fa **leggendo il testo**: decidi keep/drop dalla trascrizione e traduci in **range da TENERE**.
1. **Scorri tutta la trascrizione** e marca, per riga, i blocchi **KEEP** vs **CUT**.
2. **Filler & silenzi**: chiudi i buchi/intercalari che disturbano.
3. **Pulizia bordi (CRITICO)**: ogni range KEEP **inizia** su una frase completa (mai "…e quindi", pronomi
   senza referente) e **finisce** su un pensiero concluso. Sposta `in`/`out` su confini di frase reali.
   Vedi `../reel-ai/reference/expert-knowledge.md` §3c.
4. **Mappa dei contesti**: un tema spesso si apre, si interrompe, riprende e si chiude dopo: ricostruisci
   l'arco (OPEN→PAUSE→RESUME→CLOSE) e tienilo intero anche se i pezzi sono lontani.
5. **Continuità**: ricucendo range distanti, verifica che fili; se serve, copri il salto con transizione/fade.
6. **Output = keep-list**: lista ordinata di `(sourceIn, sourceOut)` in **secondi**, con tempi **reali**.

## 4. Strategia per la durata-obiettivo (es. 10h → 2-3h) — a passate

- **Pass 1 — Togli il morto/filler** (sfoltitura grezza): silenzi, false partenze, intoppi, intro/rambling.
  Recupera spesso il grosso senza toccare la sostanza.
- **Pass 2 — Tangenti & ripetizioni** (redazionale): elimina divagazioni e concetti ridetti; decidi quali
  archi/temi tenere interi. Qui prende forma la struttura per **capitoli**.
- **Pass 3 — Stringi** (rifinitura): asciuga i bordi, accorcia/accelera le parti che calano, copri i salti.
  **Riascolta** le sezioni tagliate pesantemente.
- Regola: **prima togli scarto, poi accorcia sostanza** — e solo se necessario per centrare la durata.

## 5. Quando AGGIUNGERE (e cosa non esagerare)
- **B-roll** (materiale fornito dall'utente, niente AI): nasconde i jump cut dei tagli e dà respiro.
- **`set_speed`**: accelera gli stretch noiosi-ma-necessari invece di tagliarli.
- **`blur_person` / regione**: sfoca volti o info sensibili (cognomi a schermo, documenti). Per i **consulti**
  spesso dovuto. **Chiedi sempre conferma** prima di sfocare una persona.
- **`add_transition` / `set_fade`**: dissolvenza breve ai salti tra range lontani o ai cambi di capitolo.
- **`mute_clip`**: silenzia un tratto (audio sporco) tenendo il video.
- **`set_look` / `set_filter` (COLORE)**: Video AI **HA i filtri colore** (stile CapCut/Canva), validi in
  anteprima **ED export**. `set_look` = **filtro con nome** one-click (`cinema`, `warm`/`cool`, `bw`, `noir`,
  `teal`, `gold`, `moody`, `vintage`, `film`…; `intensity` 0..1) per dare un'atmosfera coerente a tutto il
  video; `set_filter` = **ritocco fine** di un parametro (brightness/contrast/saturation/hue/sepia/grayscale/
  sharpen/vignette/grain). Per i **consulti**: look sobrio e caldo (es. `cinema` o `moody` a bassa intensità)
  che scalda la scena senza tradire il tono intimo.
- **Non esagerare**: transizioni/zoom/whoosh continui stancano; b-roll in eccesso distrae; un colore troppo
  spinto invecchia male. Mano leggera — il colore serve l'atmosfera, non se stesso.

## 6. Errori comuni
Over-editing (parlato a scatti) · jump cut scoperti · hook debole o sepolto · hook che non mantiene la
promessa · pacing incoerente · tagliare la sostanza per "fare durata" (o tenere parti che calano) · bordi
sporchi (range a metà frase) · niente capitoli · **timecode inventati**.

---

## 7. L'EDIT PLAN per l'app "Video AI" (handoff)

Array JSON di tool-call che l'app esegue **in ordine** quando lo incolli nel pannello AI e premi
«⚡ Costruisci GRATIS» — stesso motore di `/reel-ai2` (vedi `../reel-ai2/reference/plan-format.md`). Ogni
elemento: `{ "tool": "<nome>", "input": { … } }`.

**Forma del piano long-form:**
1. **`set_format` `{ "aspect": "16:9" }`** come primo step — il long-form resta ORIZZONTALE, **nessun
   `reframe_vertical`**.
2. Una sequenza ordinata di **`add_segment`** — **uno per ogni range TENUTO** (`sourceFile` + `sourceIn` +
   `sourceOut` in **secondi**), nell'ordine finale. **I tagli sono i buchi** tra un `sourceOut` e il
   `sourceIn` successivo.
3. (Opz.) dopo un segmento: `blur_person` / `set_speed` / `add_transition` / `set_fade` / `mute_clip` /
   `trim_clip` / **`set_look`** / **`set_filter`** (COLORE) con `clipId:"@last"`.
4. **`finish`** come ultimo elemento.

Scorciatoie: `sourceFile` (anche parziale) al posto di `sourceId`; `clipId:"@last"` = ultimo `add_segment`,
`@N` = l'N-esimo. Tool e input ESATTI: vedi `../reel-ai2/reference/plan-format.md`.

**Regole:** `set_format 16:9` per primo; **mai `reframe_vertical`**; pochi range lunghi e coerenti > tanti
micro-tagli; bordi puliti; **niente timecode inventati** (tutti dalla trascrizione); **niente captions** (il
testo lo mette l'utente dopo); **colore** con `set_look`/`set_filter` solo se serve, mano leggera; blur solo
dopo conferma; chiudi con `finish`.

### Esempio — long-form 16:9 (riduzione podcast/consulto, pochi range tenuti)
```json
[
  { "tool": "set_format", "input": { "aspect": "16:9" } },
  { "tool": "add_segment", "input": { "sourceFile": "podcast.mp4", "sourceIn": 142.0, "sourceOut": 905.5 } },
  { "tool": "add_transition", "input": { "clipId": "@last", "preset": "dissolve", "durSec": 0.4 } },
  { "tool": "add_segment", "input": { "sourceFile": "podcast.mp4", "sourceIn": 1320.0, "sourceOut": 2480.0 } },
  { "tool": "set_speed", "input": { "clipId": "@last", "speed": 1.3 } },
  { "tool": "add_segment", "input": { "sourceFile": "podcast.mp4", "sourceIn": 3110.0, "sourceOut": 4015.0 } },
  { "tool": "blur_person", "input": { "clipId": "@last", "region": { "x": 0.62, "y": 0.30, "w": 0.30, "h": 0.45 } } },
  { "tool": "add_segment", "input": { "sourceFile": "podcast.mp4", "sourceIn": 5200.0, "sourceOut": 6890.0 } },
  { "tool": "set_fade", "input": { "clipId": "@last", "edge": "out", "sec": 1.0 } },
  { "tool": "finish", "input": { "summary": "4 range tenuti in 16:9 (~75 min): tolti aria morta e tangenti, una sezione lenta a 1.3x, blur privacy sul 3o range, dissolve sul 1o salto, fade-out finale." } }
]
```
I **tagli** sono i buchi: 0-142s (intro), 905-1320s, 2480-3110s, 4015-5200s, e tutto dopo 6890s.

### Trascrizione enorme → procedi a CHUNK
1. **Spezza** la trascrizione in blocchi (~30-60 min o per capitolo/cambio-tema), **conservando i timecode reali**.
2. Per ogni chunk applica il Pass 1 e segna i **range KEEP** coi loro `(sourceIn, sourceOut)` reali; annota gli archi che continuano nel chunk dopo.
3. **Concatena** le keep-list; poi Pass 2 (tangenti/ripetizioni tra chunk) e Pass 3 (rifinitura) **sull'insieme**.
4. **Traduci** la keep-list finale in `add_segment`. **Timecode sempre reali: mai inventarli/stimarli a occhio.**

---

## Fonti
- Riverside — Remove Silence & Filler Words: https://riverside.com/clean-up-speech · Podcast Editing in 13 steps: https://riverside.com/blog/podcast-editing
- Descript — Silence Remover / Remove Filler: https://www.descript.com/tools/silence-remover
- AIR Media-Tech — Advanced retention editing (oltre il minuto 8): https://air.io/en/youtube-hacks/advanced-retention-editing-cutting-patterns-that-keep-viewers-past-minute-8
- 1of10 — Hook nei primi 30s: https://1of10.com/blog/how-to-hook-viewers-in-the-first-30-seconds-of-a-youtube-video/
- Humble & Brag — Retention benchmarks 2026: https://humbleandbrag.com/blog/youtube-audience-retention-benchmarks
- AutoCut — Repetition removal (AutoCut Repeat): https://www.autocut.com/en/autocutpodcast/
- Storyblocks — 8 editing mistakes (over-editing / b-roll): https://www.storyblocks.com/resources/blog/editing-mistakes-beginners-make-with-video

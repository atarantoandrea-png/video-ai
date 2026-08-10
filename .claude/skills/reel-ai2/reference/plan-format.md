# Il PIANO — formato esatto + i tool

Il "piano" è un **array JSON di tool-call** che l'app esegue **gratis** (senza API) quando lo incolli nel pannello AI e premi «⚡ Costruisci GRATIS». Ogni elemento è `{ "tool": "<nome>", "input": { … } }`. L'app li esegue **in ordine**, dall'alto in basso.

## Scorciatoie (così non servono gli id interni dell'app)

- **`sourceFile`**: in `add_segment`, invece di `sourceId` (che non conosci) scrivi `"sourceFile": "<nome del video>"` — anche **parziale**. L'esecutore lo abbina al media importato (match esatto → contiene → se c'è un solo media, quello).
- **`clipId: "@last"`**: la clip aggiunta dall'**ultimo** `add_segment`. Usalo per `reframe_vertical`, `set_speed`, ecc. subito dopo aver aggiunto un segmento.
- **`clipId: "@N"`**: la clip dell'N-esimo `add_segment` (0 = il primo). Utile per tornare su una clip precedente.

## I tool (nome → input)

- **`set_format`** `{ "aspect": "9:16" | "1:1" | "4:5" | "16:9" }` — formato del canvas. Reel → `"9:16"`. Primo passo.
- **`start_fresh`** `{}` — svuota la timeline (mantiene i media). Solo se serve, dopo conferma utente.
- **`add_segment`** `{ "sourceFile": "video.mp4", "sourceIn": <s>, "sourceOut": <s> }` — accoda un taglio sulla traccia video principale. Tempi in **secondi nel sorgente**. Una chiamata per segmento, nell'ordine del brief.
- **`reframe_vertical`** `{ "clipId": "@last", "mode": "...", "faceIndex"?: <n>, "blur"?: "none|top|bottom|both", "cropRect"?: {x,y,w,h} }` — reframe orizzontale→verticale.
  - `mode`: `"two-person-stack"` (due affiancati → impila), `"center-face"` (una persona, zoom sul volto), `"auto"` (decide dai volti), `"fit-contain"` (intero con barre — evita con persone), `"manual-crop"` (con `cropRect` 0..1).
  - `blur` SOLO con `two-person-stack`: `"bottom"`=persona destra/in basso, `"top"`=sinistra/in alto, `"both"`. Sfoca **l'INTERO riquadro** di quella persona (rettangolo a copertura piena) con **blur al MASSIMO** (sigma 80) → vedi **REGOLA BLUR** in fondo. Solo dopo conferma utente.
- **`detect_people`** `{ "clipId": "@last", "timeSec"?: <s> }` — quante persone/volti e dove (per decidere il layout con 3+ persone).
- **`blur_person`** `{ "clipId": "@last", "faceIndex"?: <n> }` oppure `{ "clipId":"@last", "region": {x,y,w,h}, "shape"?: "rectangle"|"ellipse", "strength"?: <8..80> }` — sfoca una persona/area. Con `region` di **default copre il RIQUADRO INTERO** (maschera **rettangolare**) con **blur massimo** (sigma 48): ideale per oscurare un **tile Zoom** (persona a sinistra `{x:0,y:0,w:0.5,h:1}`, a destra `{x:0.5,y:0,w:0.5,h:1}`, in alto `{x:0,y:0,w:1,h:0.5}`, in basso `{x:0,y:0.5,w:1,h:0.5}`). `shape:"ellipse"` = ovale morbido; `strength` regola il blur. **Solo dopo conferma utente.**
- **`add_transition`** `{ "clipId": "@last", "preset"?: "fade|wipeleft|...|dissolve", "durSec"?: 0.4 }` — transizione verso la clip successiva.
- **`set_speed`** `{ "clipId": "@last", "speed": <0.1..10> }` · **`set_fade`** `{ "clipId":"@last","edge":"in|out","sec":<s> }` · **`set_volume`** `{ "clipId":"@last","volume":<0..4> }` · **`mute_clip`** `{ "clipId":"@last","muted":true }` · **`trim_clip`** `{ "clipId":"@last","edge":"start|end","deltaSec":<s> }`.
- **`set_look`** `{ "clipId":"@last", "look":"none|vivid|cinema|warm|cool|bw|noir|vintage|fade|punch|pastel|sunset|teal|dreamy|mono-blue|matte|film|gold|moody|cyber|autumn|frost|crisp", "intensity"?: 0..1 }` — **FILTRO colore con nome** (look one-click stile CapCut; vale in anteprima **ED export**). È il modo consigliato per dare un colore d'insieme (es. `cinema`, `teal`, `gold`, `moody`, `bw`). · **`set_filter`** `{ "clipId":"@last", "type":"brightness|contrast|saturation|hue|sepia|grayscale|invert|sharpen|vignette|grain", "value": <num> }` — regolazione fine (brightness/contrast/saturation = delta ~ -1..1; hue = gradi -180..180; gli altri 0..1). Si somma al look.
- **`add_caption`** `{ "text","startSec","endSec","style":"caption|title" }` / **`add_captions_bulk`** `{ "segments":[{start,end,text}] }` — **NON usarli** per i reel (il testo lo mette l'utente dopo), salvo richiesta esplicita.
- **`ask_user`** `{ "question", "options"?:[...] }` — di norma NON serve nel piano: le domande le fai TU all'utente in chat **prima** di generare il piano (es. conferma blur). Mettilo solo se vuoi che l'app chieda a metà esecuzione.
- **`set_post_meta`** `{ "description"?, "hashtags"?, "firstComment"?, "hooks"?: [...], "extraDescription"?, "notes"? }` — **salva nel progetto la copy social del reel** (descrizione del post, hashtag, **primo commento**, i 5 hook, e la **descrizione extra** FISSA di Elisa). **NON scrive nulla sul video**: resta salvata col progetto e l'utente la rilegge/copia dalla scheda **«Social»** dell'app. Prendi i testi **dal brief** (sezioni `## Descrizione (post)`, `## Primi commenti`, `## Hook`, `## Descrizione extra` — quest'ultima VERBATIM, identica). In `firstComment` metti **TUTTE le 3 versioni** del primo commento, separate (es. `▸ Versione A — …\n\n▸ Versione B — …\n\n▸ Versione C — …`), così l'utente sceglie. Mettilo **una sola volta, subito prima di `finish`**.
- **`finish`** `{ "summary": "riepilogo in italiano" }` — ultimo elemento.

## Regole per un buon piano

1. **`set_format` per primo**, poi i segmenti **nell'ordine del brief**.
2. Dopo OGNI `add_segment`, un `reframe_vertical` con `clipId:"@last"`.
3. Reframe: due persone affiancate (Zoom: consulto/intervista) → `"two-person-stack"`; una persona → `"center-face"`; in dubbio → `"auto"`; mai `"fit-contain"` con persone.
4. **Niente captions/titoli** salvo richiesta esplicita.
5. **Niente timecode inventati**: usa quelli del brief.
6. **Copy social**: se il brief ha `## Descrizione (post)` e/o `## Primi commenti`, aggiungi **un** `set_post_meta` (con `description`, `hashtags`, `firstComment` = tutte le 3 versioni, `hooks`, `extraDescription`) **subito prima** di `finish`. Così descrizione e commenti si salvano col progetto (scheda «Social»), pronti da copiare quando l'utente pubblica.
7. Chiudi con `finish`.

## Esempio — consulto a due (griglia tipo Zoom), 3 segmenti

```json
[
  { "tool": "set_format", "input": { "aspect": "9:16" } },
  { "tool": "add_segment", "input": { "sourceFile": "consulto.mp4", "sourceIn": 723.4, "sourceOut": 751.0 } },
  { "tool": "reframe_vertical", "input": { "clipId": "@last", "mode": "two-person-stack" } },
  { "tool": "add_segment", "input": { "sourceFile": "consulto.mp4", "sourceIn": 192.0, "sourceOut": 228.5 } },
  { "tool": "reframe_vertical", "input": { "clipId": "@last", "mode": "two-person-stack" } },
  { "tool": "add_segment", "input": { "sourceFile": "consulto.mp4", "sourceIn": 2360.0, "sourceOut": 2392.0 } },
  { "tool": "reframe_vertical", "input": { "clipId": "@last", "mode": "two-person-stack" } },
  { "tool": "finish", "input": { "summary": "3 segmenti, ~96s, 9:16, stack due-persone su tutti." } }
]
```

## Esempio — un solo relatore (intervista a camera singola)

```json
[
  { "tool": "set_format", "input": { "aspect": "9:16" } },
  { "tool": "add_segment", "input": { "sourceFile": "talk.mp4", "sourceIn": 95.0, "sourceOut": 128.0 } },
  { "tool": "reframe_vertical", "input": { "clipId": "@last", "mode": "center-face" } },
  { "tool": "add_segment", "input": { "sourceFile": "talk.mp4", "sourceIn": 410.0, "sourceOut": 447.0 } },
  { "tool": "reframe_vertical", "input": { "clipId": "@last", "mode": "center-face" } },
  { "tool": "set_post_meta", "input": {
    "description": "Ecco cosa ho sentito quando…",
    "hashtags": "#ElisaSoulMedium #medium #aldilà #lutto #spiritualità",
    "firstComment": "▸ Versione A — …\n\n▸ Versione B — …\n\n▸ Versione C — … (le 3 versioni dal brief: approfondimento, NON ripetono il video)",
    "hooks": ["Hook emotivo…", "Hook curiosità…", "Hook strappalacrime…", "Hook shock…", "Hook clickbait…"],
    "extraDescription": "Buongiorno a tutti 💓 … (testo fisso VERBATIM dalla sezione ## Descrizione extra del brief)"
  } },
  { "tool": "finish", "input": { "summary": "2 segmenti, ~70s, 9:16, center-face. Copy social salvata." } }
]
```

## ⚠️ REGOLA BLUR — legge di Andrea, non negoziabile

Quando si sfoca una persona (privacy), vale **sempre** questo, senza bisogno che venga richiesto:

1. **Si sfoca TUTTA la persona, non il volto.** Mai ellissi/ovali sulla faccia, mai «copro gli occhi»,
   mai maschere ritagliate: si oscura **l'intero riquadro** in cui compare (tutto il suo tile Zoom, dalla
   testa ai piedi, sfondo compreso), con una **maschera rettangolare a copertura piena**.
2. **Blur al MASSIMO.** `sigma 80` (il tetto). Il riquadro deve risultare **irriconoscibile**: non si deve
   vedere praticamente niente — né il viso, né i vestiti, né cosa c'è dietro.
3. **Meglio sfocare di troppo che di meno.** Nel dubbio si allarga la regione e si alza il blur.
   Se un file si chiama «… no volto» / «oscurata» / «viso coperto», quella persona va sfocata: non si chiede.

**Come si ottiene**
- Nello **stack a due**: `"blur":"bottom"` (destra/in basso) o `"top"` (sinistra/in alto) dentro
  `reframe_vertical` — l'app applica da sé rettangolo pieno + sigma 80 su quella metà.
- Su un **riquadro qualsiasi**: `blur_person` con `region` = il tile intero, `shape:"rectangle"`,
  `strength: 80` (es. persona a destra `{x:0.5,y:0,w:0.5,h:1}`, a sinistra `{x:0,y:0,w:0.5,h:1}`).
- ⚠️ `blur_person` **non** sa puntare la clip di sotto **dopo** un `two-person-stack` (`@last` = quella
  in alto): nello stack usa **sempre** il parametro `blur` di `reframe_vertical`.

**Prima di sfocare**, chiedi conferma all'utente in chat (chi va oscurato). Il *come* invece non si chiede:
è sempre intero + massimo.

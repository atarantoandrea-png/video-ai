# Il «Reel Build Brief» — contratto Parte 1 → Parte 2

Questo è il **formato esatto** dell'output della skill e l'**input** dell'AI in-app. Deve essere **leggibile dall'utente** (per rivedere segmenti, hook e descrizione) e **interpretabile senza ambiguità** dalla seconda AI, che lo mappa in chiamate di tool sulla timeline.

## Regole invarianti

- **Timecode in SECONDI** (float, canonico per la macchina), con annotazione umana `MM:SS.s` tra parentesi. Es: `in: 723.4 (12:03.4)`.
- I tempi sono sempre **riferiti al video SORGENTE**, non al reel finale.
- I **segmenti** sono elencati nell'**ordine finale del reel** (già ricuciti). La numerazione = l'ordine di montaggio.
- Le **sorgenti** si identificano per **alias + nome file** (la Parte 2 risolve l'alias sul file realmente importato; se ambiguo, chiede).
- **Niente timecode inventati.** Se un valore non è certo, scrivilo come `(da confermare)` — la Parte 2 chiederà.
- Campi sconosciuti/non applicabili: ometterli o `—`. Non aggiungere campi non previsti qui.

## Struttura

````markdown
# Reel Build Brief

## Meta
- formato: 9:16            # uno tra 9:16 | 1:1 | 4:5 | 16:9 (default reel: 9:16)
- durata_target_s: 45      # durata indicativa del reel finale, in secondi
- piattaforma: Instagram Reels   # Instagram Reels | TikTok | YouTube Shorts
- tono: ispirazionale
- lingua: it
- model: claude-sonnet-4-6   # modello per la Parte 2 in-app (mai sotto Sonnet)

## Speakers
# Una riga per persona. Sigla stabile (S1, S2…), nome, ruolo opzionale.
- S1: Marco — host
- S2: Giulia — ospite
# Se una sola persona: "- S1: <nome o 'Speaker unico'>"

## Sources
# alias stabile + nome file + (orientamento e durata se noti)
- src_main: intervista_giulia.mp4 — orizzontale 1920x1080, durata 2530.0 (42:10)

## Segments
# In ORDINE FINALE del reel. Ogni segmento è un blocco numerato con questi campi.
1. [HOOK] src=src_main in=723.4 (12:03.4) out=751.0 (12:31.0) speaker=S2
   text: "Ho rischiato tutto quello che avevo, e per sei mesi ho dormito in macchina."
   reason: frase shock, apre il loop (rischio) da chiudere alla fine
   reframe: center-face(S2)
   blur: none
2. [PUNTO] src=src_main in=192.0 (03:12.0) out=228.5 (03:48.5) speaker=S1
   text: "All'inizio nessuno credeva nel progetto..."
   reason: contesto minimo necessario a capire l'hook
   reframe: center-face(S1)
   blur: none
3. [CHIUSURA] src=src_main in=2360.0 (39:20.0) out=2392.0 (39:52.0) speaker=S2
   text: "...e oggi quella stessa macchina è il logo dell'azienda."
   reason: paga e chiude il loop aperto dall'hook
   reframe: center-face(S2)
   blur: none

# (Nessun testo a schermo: captions e titolo-hook NON vanno nel brief — li aggiunge l'utente dopo.)

## Privacy
# Persone/volti da sfocare. La Parte 2 CHIEDERÀ comunque conferma.
- none
# esempio: "- volto sullo sfondo nel segmento 2 (~205s): valutare blur"

## Hook (5 angoli — l'utente ne sceglie uno per il post)
1. [Emotivo forte] "<hook ≤ ~12 parole>"
2. [Curiosità grande] "<hook>"
3. [Strappalacrime] "<hook>"
4. [Shock] "<hook>"
5. [Clickbait generico] "<hook>"

## Descrizione (post)        # riflessione CON keyword, breve e profonda — dal "cervello" di Elisa (vedi hooks-seo.md)
<es. "Ecco cosa succede quando... il mio punto di vista come medium. ..." — keyword congrue, no stuffing>
hashtag: #ElisaSoulMedium #medium #aldilà #lutto #spiritualità    # 4-8, i primi branded

## Primo commento            # il MESSAGGIO è il focus: lunghezza LIBERA (anche lunga), dalla conoscenza di Elisa, radicato nel QUOTIDIANO — vedi hooks-seo.md
<riflessione profonda e UTILE nella voce di Elisa, sviluppata quanto serve il tema, portata nella vita di tutti i giorni; SOLO alla fine, piccolo, il ponte al libro «La Vita Oltre il Velo» (link in bio/storie). Il libro è secondario, mai venditore.>
````

## Note sui campi dei segmenti

- **Ruolo** (in `[...]`): `HOOK` | `SVILUPPO` | `RISPOSTA` | `CHIUSURA` | `CTA` (`PUNTO` = alias di SVILUPPO). Un solo HOOK (posizione 1). Il discorso deve **chiudersi** (`CHIUSURA`) prima di un eventuale secondo discorso; con più interlocutori includi le `RISPOSTA`. I bordi (in/out) devono cadere su **frasi complete** (vedi `expert-knowledge.md` → Pulizia dei bordi).
- **src**: alias definito in `## Sources`.
- **in/out**: secondi nel sorgente; `out > in`. È il taglio che la Parte 2 applicherà come `sourceIn/sourceOut`.
- **speaker**: sigla da `## Speakers` (o `—` se non distinguibile).
- **text**: la trascrizione *verbatim* del segmento (serve all'utente per rivedere e per scrivere hook/descrizione; la Parte 2 NON lo scrive a schermo).
- **reason**: 1 riga sul perché del segmento (aiuta l'utente a fidarsi e la Parte 2 a capire le priorità).
- **reframe**: uno tra `center-face(Sx)` | `two-person-stack` | `active-speaker` | `fit-contain` | `manual` (+ nota). Se non sai: `auto` (la Parte 2 decide rilevando i volti).
- **blur**: `none` | descrizione di cosa sfocare.

## Come lo usa la Parte 2 (per scriverlo bene)

La seconda AI leggerà questo brief e chiamerà i suoi tool in quest'ordine tipico: `set_format(9:16)` → per ogni segmento `add_segment(src, in, out)` (in ordine) → `reframe_vertical(...)` secondo l'hint → eventuali `blur_person(...)` (dopo conferma) → eventuali fade. **NIENTE captions/titoli** (li aggiunge l'utente dopo). Quindi: **ordine dei segmenti = ordine di montaggio**, e ogni hint deve corrispondere a una capacità reale (vedi `app-capabilities.md`).

Per un esempio completo end-to-end (input → ragionamento → brief), vedi `example-brief.md`.

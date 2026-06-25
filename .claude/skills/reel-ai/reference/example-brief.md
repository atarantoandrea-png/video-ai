# Esempio lavorato (few-shot) — da intervista a reel

Esempio realistico end-to-end: mostra il ragionamento (mappa dei contesti) e il **brief finale** nel formato del contratto. Usalo come riferimento di stile/qualità per il tuo output. *Numeri e testo sono inventati a scopo illustrativo.*

## Input (estratto di trascrizione con tempi, 2 speaker)

```
[00:03:10] S1 (Marco): Quando avete iniziato, qualcuno credeva nel progetto?
[00:03:14] S2 (Giulia): No, zero. Mi dicevano tutti di lasciar perdere e trovarmi un lavoro vero.
[00:03:48] S2 (Giulia): Però io avevo una cosa in testa e basta.
[00:11:55] S1 (Marco): Qual è stato il momento più duro?
[00:12:03] S2 (Giulia): Ho rischiato tutto. Per sei mesi ho dormito in macchina, senza dire niente a nessuno.
[00:12:31] S2 (Giulia): ...e ogni mattina mi truccavo allo specchietto per andare agli appuntamenti.
[00:31:40] S2 (Giulia): Il punto di svolta è stato quando ho smesso di vergognarmi della mia storia.
[00:39:20] S2 (Giulia): Oggi quella stessa macchina dove dormivo è il logo dell'azienda. L'abbiamo messa in vetrina.
```

## Ragionamento (mappa dei contesti) — interno, non è l'output

```
Tema "nessuno ci credeva":  OPEN 03:14 → (sviluppo) 03:48
Tema "il momento più duro": OPEN 12:03 (← HOOK: shock + curiosità) → 12:31
Tema "svolta/orgoglio":     OPEN 31:40
Tema "il pagamento":        CLOSE 39:20 (← chiude il loop "rischio/macchina")
```
Hook = "Ho rischiato tutto… dormito in macchina" (12:03–12:31): forte, emotivo, apre il loop "macchina".
Arco ricucito: **HOOK (la macchina)** → **CONTESTO (nessuno ci credeva)** → **CHIUSURA (la macchina in vetrina = paga il loop)**. Durata ~ 27+34+? → punto a ~45–50s. Speaker quasi tutto S2 → `center-face(S2)`.

## Output — il brief (questo è ciò che si incolla nell'app)

````markdown
# Reel Build Brief

## Meta
- formato: 9:16
- durata_target_s: 48
- piattaforma: Instagram Reels
- tono: ispirazionale / storia di rivincita
- lingua: it
- model: claude-sonnet-4-6

## Speakers
- S1: Marco — host
- S2: Giulia — ospite (protagonista del reel)

## Sources
- src_main: intervista_giulia.mp4 — orizzontale 1920x1080, durata 2700.0 (45:00)

## Segments
1. [HOOK] src=src_main in=723.0 (12:03.0) out=751.0 (12:31.0) speaker=S2
   text: "Ho rischiato tutto. Per sei mesi ho dormito in macchina, senza dire niente a nessuno... e ogni mattina mi truccavo allo specchietto per andare agli appuntamenti."
   reason: shock + immagine vivida; apre il loop "la macchina" da chiudere alla fine
   reframe: center-face(S2)
   blur: none
2. [PUNTO] src=src_main in=194.0 (03:14.0) out=228.0 (03:48.0) speaker=S2
   text: "No, zero. Mi dicevano tutti di lasciar perdere e trovarmi un lavoro vero. Però io avevo una cosa in testa e basta."
   reason: contesto che alza la posta (tutti contro) e crea empatia
   reframe: center-face(S2)
   blur: none
3. [CHIUSURA] src=src_main in=2360.0 (39:20.0) out=2384.0 (39:44.0) speaker=S2
   text: "Oggi quella stessa macchina dove dormivo è il logo dell'azienda. L'abbiamo messa in vetrina."
   reason: paga e CHIUDE il loop dell'hook (la macchina) — finale memorabile
   reframe: center-face(S2)
   blur: none

# (niente testo a schermo nel brief: captions e titolo li aggiunge l'utente dopo)

## Privacy
- none

## Hook (5 angoli — scegline uno per il post)
1. [Emotivo forte] "Per sei mesi ho dormito in macchina pur di non mollare."
2. [Curiosità grande] "Quella macchina dove dormivo oggi è in vetrina. Indovina perché."
3. [Strappalacrime] "Mi truccavo allo specchietto piangendo. Non avevo altro."
4. [Shock] "Ho rischiato tutto quello che avevo. Davvero tutto."
5. [Clickbait generico] "Da dormire in auto a fondare un'azienda — guarda fino alla fine."

## Descrizione (post)
Ecco cosa succede quando non molli: ho rischiato tutto e ho trasformato la macchina in cui dormivo nel logo della mia azienda. Il mio percorso, senza filtri.
hashtag: #imprenditoria #startup #motivazione #nonmollare #mindset

## Primi commenti
# ALMENO 3 versioni, angoli diversi, APPROFONDIMENTO (NON ripetono il video) — niente libro qui. Vedi hooks-seo.md.
1. [allarga] Quello che nessuno dice è che il "fondo" non è la fine: è il punto da cui finalmente si costruisce, perché non hai più niente da perdere.
2. [sposta il piano] Non conta quanto sei caduto, ma cosa decidi nei giorni in cui nessuno ti vede: lì si gioca tutto.
3. [il perché] Tocchiamo il fondo non per punizione: è il momento in cui smettiamo di difendere ciò che non funzionava più e ricominciamo davvero.
# (Per i reel di Elisa: attingi a cerca_conoscenza/voce_di_elisa e resta nel suo registro — vedi hooks-seo.md)
````

## Perché funziona (per autovalutarti)

- Hook entro il 1° secondo, immagine forte, apre un loop chiaro ("la macchina").
- L'ordine NON è cronologico (12:03 → 03:14 → 39:20): è **ricucito** per senso ed emozione.
- La chiusura **richiama e paga** l'hook → loop chiuso.
- ~48s, tutto S2 → reframe semplice e coerente; UNA storia sola (pochi segmenti coerenti, non micro-tagli); nessun testo a schermo (lo mette l'utente dopo).

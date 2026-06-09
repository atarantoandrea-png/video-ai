# Trascrizione, diarizzazione, allineamento — guida operativa (Fase 1A)

Procedura e comandi per ottenere **trascrizione con tempi** e **chi parla**, quando l'utente non li ha già. Eseguibili via Bash (questa è una skill di Claude Code: puoi lanciare strumenti locali e, se serve, **fare WebFetch della documentazione aggiornata** del tool/API che usi).

> **Scenario (a): l'utente HA già la trascrizione con i tempi** → non serve nulla di tutto questo. Leggi/normalizza il file (vedi "Normalizzazione" in fondo) e procedi alla Fase 1B.

## Strumenti disponibili su questa macchina (rilevato)

- **ffmpeg bundle dell'app**: `/Users/andreataranto/Desktop/Video Ai/node_modules/ffmpeg-static/ffmpeg` (45 MB, pronto). Usalo per estrarre l'audio senza installare nulla.
- **brew**: presente (`/opt/homebrew/bin/brew`) → `brew install ffmpeg` se serve ffmpeg "di sistema".
- **python3** 3.9.6 di sistema (per whisperX meglio un Python 3.10+ in venv/uv).
- whisper/whisperX/torch/pyannote: **NON installati** (vanno messi su alla prima esecuzione, oppure usa l'API cloud).

**Estrai prima l'audio** (leggero, accelera tutto):
```bash
FFMPEG="/Users/andreataranto/Desktop/Video Ai/node_modules/ffmpeg-static/ffmpeg"
"$FFMPEG" -i "<VIDEO>" -vn -ac 1 -ar 16000 -c:a pcm_s16le /tmp/reel_audio.wav -y
```

## Scenario (b): solo VIDEO → trascrizione + diarizzazione

Servono: testo, **timestamp** (idealmente a parola) e **speaker label**. Due strade.

### Strada 1 — API cloud (consigliata su M1/8GB: leggera, diarizzazione inclusa)
Provider che danno trascrizione + word-timestamps + speaker labels in una chiamata (es. AssemblyAI, Deepgram). "Non importano i crediti".
- Richiede una chiave del provider (chiedila all'utente o usa quella già configurata in env).
- **Non memorizzare a memoria l'API**: prima di chiamarla fai **WebFetch della doc ufficiale aggiornata** (endpoint, parametri `speaker_labels`/`diarize`, formato risposta), poi costruisci la `curl`. Esempio di forma (verifica i dettagli con la doc):
  ```bash
  # 1) upload /tmp/reel_audio.wav  2) richiedi transcript con speaker_labels=true
  # 3) poll fino a 'completed'  4) salva il JSON con words[] {text,start,end,speaker}
  ```
- Privacy: l'audio viene inviato a un terzo. Se l'utente non vuole, usa la Strada 2.

### Strada 2 — whisperX locale (offline, privato; più pesante da installare)
whisperX = faster-whisper (trascrizione + word timestamps) + pyannote (diarizzazione).
```bash
# ffmpeg su PATH (una volta):
brew install ffmpeg        # oppure: export PATH="/Users/andreataranto/Desktop/Video Ai/node_modules/ffmpeg-static:$PATH"
# ambiente isolato con Python moderno (consigliato uv o venv):
pipx install whisperx      # oppure: python3 -m venv ~/.reelai && ~/.reelai/bin/pip install whisperx
# diarizzazione: serve un token HuggingFace gratuito (accetta le condizioni del modello pyannote)
export HF_TOKEN=<token>
whisperx "<VIDEO_o_/tmp/reel_audio.wav>" --model small --language it \
  --diarize --hf_token "$HF_TOKEN" --output_format json --output_dir /tmp/reelai_out
```
- Su 8GB usa `--model small` (o `base`); evita `large` (rischio OOM/lentezza). Output JSON con `segments[]` e `words[]` (start/end/speaker).
- Se l'install fallisce o è troppo lenta, ripiega sulla Strada 1.
- Adatta i flag alla versione installata: se incerto, **WebFetch del README di whisperX**.

## Scenario (c): TESTO + VIDEO, senza tempi → forced alignment

L'utente ha il testo "giusto" ma niente tempi: aggancia il testo all'audio.
- **Via whisperX**: trascrivi l'audio (Strada 2 senza `--diarize` se basta), ottieni i word-timestamps, poi **allinea il testo fornito** ai word del riconoscimento (matching parola/sequenza) per trasferire i tempi al testo dell'utente. whisperX ha anche uno step di align dedicato (`--align_model`); in alternativa usa i timestamp della trascrizione e correggi le parole col testo utente.
- **Diarizzazione** anche qui se ci sono più speaker (vedi sotto).

## Speaker → nomi (vale per tutti gli scenari multi-speaker)

1. Se il testo **non distingue** chi parla, chiedi all'utente: *"una sola persona o più?"*.
2. Se più persone e non c'è diarizzazione → ottienila (Strada 1 o 2): otterrai `SPEAKER_00/01/...`.
3. **Assegna i nomi**: deducili dal dialogo (presentazioni, "grazie, Marco…") e poi **chiedi conferma** all'utente di mappare ogni etichetta a un nome (`SPEAKER_00 → Marco`).
4. Riporta la mappa in `## Speakers` del brief; usa le sigle `S1/S2…` nei segmenti.

## Toni ed emozioni — estrarre fotogrammi (opzionale ma potente)

Dal solo testo non capisci se uno **piange, si commuove, urla**. Se hai il video, **estrai un fotogramma** al momento candidato e **guardalo** (la skill legge le immagini con Read):

```bash
FFMPEG="/Users/andreataranto/Desktop/Video Ai/node_modules/ffmpeg-static/ffmpeg"
"$FFMPEG" -ss <SECONDI> -i "<VIDEO>" -frames:v 1 -y /tmp/reel_frame.jpg
# più frame in un colpo (uno ogni 5s): aggiungi  -vf fps=1/5  e usa /tmp/f_%03d.jpg
```

Poi apri `/tmp/reel_frame.jpg` (Read) e valuta l'espressione (pianto, sguardo intenso, sorriso…). Ripeti per i momenti chiave: serve a **confermare i picchi emotivi** e a decidere quali discorsi **ampliare**. Se non hai il video e i toni sono ambigui, **chiedi all'utente**.

## Normalizzazione timecode → SECONDI

Il brief usa **secondi** (float) come valore canonico. Conversioni:
- SRT `HH:MM:SS,mmm` e VTT `HH:MM:SS.mmm` → `H*3600 + M*60 + S + mmm/1000`.
- Es: `00:12:03,400` → `723.4`. Aggiungi sempre l'annotazione umana `(MM:SS.s)` accanto.
- Se la trascrizione ha timestamp solo per blocco (non per parola), va bene: usa start/end del blocco che contiene la frase scelta, rifinendo i confini a inizio/fine frase.

## Promemoria

- Per **(a)** non installare nulla. Installa/chiama strumenti **solo** quando servono davvero (b/c).
- Tieni i file temporanei in `/tmp`; non lasciare chiavi API nei comandi loggati se evitabile (usa variabili d'ambiente).
- In caso di dubbio sui flag/endpoint correnti, **WebFetch della documentazione** prima di lanciare.

# Prendere il controllo del Mac ed eseguire il piano

Procedura **robusta** per montare il reel pilotando l'app Video AI. Fai **uno screenshot prima di ogni azione importante** per localizzare i pulsanti (le coordinate cambiano tra schermi). Parla all'utente in italiano e procedi con calma.

## 0. Accesso

- `request_access` per l'app **"Video AI"** (il programma desktop). In sviluppo il processo può chiamarsi **"Electron"** — se non vedi "Video AI" tra le app, chiedi all'utente se l'app è aperta o usa "Electron".
- Fai uno `screenshot` per vedere lo stato attuale.

## 1. Apri Video AI e verifica il video importato

- Se Video AI non è in primo piano, `open_application` "Video AI" (o "Electron" in dev).
- **Il video sorgente dev'essere nel pannello «Media»** (colonna sinistra). Guarda lo screenshot:
  - Se il video c'è già (miniatura + nome file) → ok, passa al punto 2.
  - Se NON c'è → importalo:
    1. Clicca la scheda **«Media»** in alto a sinistra.
    2. Clicca **«+ Importa o trascina»**.
    3. Si apre la finestra file di macOS. Premi **Cmd+Shift+G**, **incolla il percorso completo del video** (chiedilo all'utente se non ce l'hai — es. `/Users/.../Desktop/consulto.mp4`), premi **Invio**, poi **Invio/Apri**.
    4. Attendi che l'import finisca (compare la miniatura; l'app genera un'anteprima — possono volerci alcuni secondi). Usa `wait` + `screenshot`.
  - In alternativa, **chiedi all'utente di trascinare il video** nel pannello Media: a volte è più rapido e sicuro.

## 2. Vai sul pannello AI

- Clicca la scheda **«✦ AI»** in alto a sinistra (prima scheda, con la stellina).
- Fai uno `screenshot`: devi vedere il riquadro di testo grande con scritto *"Incolla il «Reel Build Brief» … OPPURE il piano JSON di /reel-ai2 …"* e il pulsante **«▶ Costruisci reel»**.

## 3. Incolla il piano ed esegui GRATIS

1. `write_clipboard` con **il piano JSON completo** (l'array che hai generato nella Fase 2 della skill).
2. Clicca **dentro il riquadro di testo** del pannello AI.
3. Incolla con **Cmd+V** (`key` cmd+v). Tutto il piano entra in un colpo (niente digitazione carattere per carattere).
4. `screenshot`: sotto il riquadro deve comparire l'avviso verde **«⚡ Piano da Claude rilevato → costruzione gratuita, senza crediti API»** e il pulsante deve essere diventato **«⚡ Costruisci GRATIS (senza crediti)»**.
   - Se invece vedi ancora «▶ Costruisci reel», il testo non è stato riconosciuto come piano: controlla che sia un **array JSON valido** (inizia con `[`), reincollalo.
5. Clicca **«⚡ Costruisci GRATIS (senza crediti)»**.

## 4. Sorveglia l'esecuzione

- I passi scorrono nel pannello (`▶ set_format`, `▶ add_segment (…s)`, `▶ reframe_vertical`, …). Fai `screenshot` ogni tanto (`wait` 1–2 s tra uno e l'altro): il reframe coi volti richiede qualche secondo per clip.
- **Se compare una domanda** (riquadro con una domanda + pulsanti, es. conferma di sfocare qualcuno): **fermati**, riportala all'utente in chat, aspetta la risposta, poi clicca l'opzione giusta (o scrivi la risposta nel campo e premi «Invia»).
- Quando vedi **«✓ Reel montato GRATIS dal piano di Claude (zero crediti API)»**, è finito. Fai uno `screenshot` di conferma: nella timeline in basso devono esserci i segmenti, e l'anteprima è verticale 9:16.

## 5. Errori comuni

- **Il pulsante resta «▶ Costruisci reel»** → il piano non è JSON valido: rigeneralo come array `[ … ]` e reincolla.
- **`add_segment … — sorgente non trovata`** → il `sourceFile` non combacia col nome del media importato: guarda il nome esatto nel pannello Media e correggi il `sourceFile` (anche parziale va bene), poi reincolla ed esegui.
- **Il reframe non riempie bene** → l'utente può rifinirlo a mano (maniglie di crop sull'anteprima) dopo; oppure rigenera quel segmento con `mode` diverso (`center-face` ↔ `two-person-stack`).
- **Vuoi rifare tutto** → un singolo **⌘Z** annulla l'intero montaggio (è raggruppato in un solo undo).

## Note

- Non serve la chiave API né crediti: il pulsante GRATIS esegue il piano col motore dell'app (face detection inclusa). L'unico "costo" è il tuo lavoro qui in Claude Code.
- Non toccare altri file/finestre dell'utente. Resta dentro Video AI. Non cliccare link esterni.

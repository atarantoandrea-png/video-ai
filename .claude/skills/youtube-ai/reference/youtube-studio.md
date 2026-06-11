# youtube-studio.md — Procedura: carica e programma su YouTube Studio (browser)

Procedura **robusta** per caricare e programmare un video su **YouTube Studio**, pilotando **Chrome
tramite l'estensione Claude** (`mcp__claude-in-chrome__*`). Parla in italiano, una cosa alla volta,
con calma.

> ⚠️ **NON** usare il computer-use a pixel sul browser: i browser sono in tier "read" (clic/digitazione
> bloccati). Ogni azione passa per `mcp__claude-in-chrome__*`. Fai una `read_page`/`find` **prima di ogni
> azione** per localizzare l'elemento: l'UI di Studio cambia e può essere in **italiano o inglese** →
> cerca per etichetta/ruolo in **entrambe** le lingue.

## 🔒 GATE DI SICUREZZA (sempre attivi)
- **Mai** loggarsi, **mai** inserire credenziali (Andrea è già loggato).
- Login / 2FA / CAPTCHA / banner di consenso → **STOP**, riporta verbatim, chiedi ad Andrea (mai risolvere
  CAPTCHA, mai accettare consensi al posto suo).
- Prima dell'azione finale (**Pubblica/Programma**) → mostra **riepilogo completo** e attendi un **"vai"**
  esplicito.
- Resta dentro `studio.youtube.com`; non cliccare link esterni; non toccare altre schede/file.

---

## SESSIONE 1 — Carica + metadati + annunci → BOZZA (Privato)

### Fase 0 — Prerequisiti (ogni voce è un gate; se fallisce, STOP e chiedi)
1. **Estensione connessa?** `mcp__claude-in-chrome__list_connected_browsers`. Se vuoto → *"Mi serve
   l'estensione Claude per Chrome connessa. Abilitala e dimmi quando è pronta."* STOP. Se più browser,
   usa `tabs_context_mcp` per il `tabId` attivo e tienilo per tutte le chiamate.
2. **Studio + canale giusto.** `navigate` `https://studio.youtube.com`. Leggi nome/avatar canale
   (`get_page_text` / `find "account/channel name, top-right"`) → *"Vedo il canale «<nome>». È quello di
   Elisa, giusto?"* Conferma esplicita. Se compare una pagina di **login/scelta account** → GATE: STOP,
   non inserire credenziali, chiedi ad Andrea di loggarsi.
3. **Guardia login/2FA/CAPTCHA/consenso.** `find` per form di login, 2FA, CAPTCHA, banner cookie. Se
   presente → STOP e chiedi.
4. **YouTube Pack presente?** Conferma di avere: titolo scelto, descrizione SEO completa (capitoli
   inclusi), tag, playlist, lingua, categoria. Se manca qualcosa, chiedi.
5. **File video accessibile.** Il video è quello **condiviso in `/reel-ai`** → dovrebbe essere accessibile
   alla sessione. (Se `file_upload` lo rifiuta perché non condiviso → fallback: *"Trascina tu il file
   nella finestra di upload di YouTube; ti dico quando è aperta."*)
- ✅ Checkpoint: `screenshot` di studio.youtube.com col canale corretto.

### Fase 1 — Avvia il caricamento
- `find "Crea / Create (icona camera+ in alto a destra)"` → click. `find "Carica video / Upload videos"`
  → click.
- **Selezione file (compatibile con l'estensione):** NON cliccare "Seleziona file" (apre il picker nativo
  che l'estensione non vede). Invece: `read_page filter:"interactive"` / `find "file input"` → individua
  il `<input type=file>` (ref) → `mcp__claude-in-chrome__file_upload { paths:[<video>], ref, tabId }`.
  Se rifiutato → chiedi ad Andrea di trascinare il file nella finestra aperta.
- ✅ Checkpoint: `screenshot` + `find "barra di avanzamento / processing"`; conferma che si è aperta la
  finestra **Dettagli** con l'upload in corso (carica il **video completo**).

### Fase 2 — Dettagli
Per ogni campo: `find` per etichetta/ruolo → `form_input` (testo/select) o click (toggle/radio) →
`read_page`/`get_page_text` per **verificare** che il valore sia entrato.

> ⚠️ **REGOLA CAMPI PRECOMPILATI (sempre):** Studio può pre-riempire **titolo/descrizione** (dal nome file,
> da una **bozza precedente**, o auto). I valori del **nostro Pack VINCONO SEMPRE**: **svuota e sostituisci,
> non chiedere, non interpretare.** ❗ **Non dedurre MAI quale file è stato caricato dal testo precompilato**
> (un titolo tipo «Consulto … completo» può essere il residuo di una vecchia bozza, non il file di adesso).
1. **Titolo** — **REGOLA FERREA: qualsiasi titolo già nel campo va SEMPRE sostituito** col titolo del Pack,
   **senza chiedere**, qualunque ne sia l'origine (nome file, **bozza precedente**, auto). **Svuota** il
   campo (seleziona tutto → cancella) → `form_input` col titolo del Pack → verifica testo == titolo del Pack.
   **Non chiedere all'utente "che file hai caricato?" basandoti sul titolo precompilato.**
2. **Descrizione** — stessa regola: **svuota** qualsiasi testo precompilato, poi `form_input` con la
   descrizione SEO completa (i **capitoli** sono già nel testo). Verifica che una riga capitolo sia presente.
3. **Playlist** — apri il dropdown → spunta la playlist del Pack → chiudi. Verifica che compaia.
4. **Pubblico / Bambini** — seleziona **"No, non è un video per bambini"** (OBBLIGATORIO, altrimenti
   YouTube blocca la pubblicazione). Verifica radio "No" selezionato.
5. **"Mostra altro"** → espandi. Poi:
   - **Tag** — `form_input` coi tag (csv) del Pack. Verifica.
   - **Lingua del video** — seleziona (Italiano). Verifica.
   - **Categoria** — seleziona quella del Pack. Verifica.
- ✅ Checkpoint: `get_page_text` del pannello Dettagli, echo compatto ad Andrea. Non avanzare se una
  verifica fallisce.

### Fase 3 — Sottotitoli (le 7 tracce) — vedi `subtitles.md`
- Se i file SRT sono già stati generati: nel flusso di upload c'è il passo **Sottotitoli/Subtitles**
  (oppure si fanno dal pannello Sottotitoli del video). Per ogni lingua: **Aggiungi lingua** → scegli
  lingua → **Carica file → Con i tempi** → seleziona `sub_<lang>.srt` (via `file_upload`, sono file di
  sessione) → **Pubblica/Salva** la traccia → verifica che compaia nell'elenco.
- Ordine: `it` (originale) → `en, es, ja, zh-Hans, hi, ar`. Imposta **lingua video = Italiano**.

### Fase 4 — Monetizzazione (OBBLIGATORIA: annunci ON)
1. `find "Monetizzazione / Monetization"` nello stepper a sinistra (Dettagli → **Monetizzazione** →
   Elementi video → Controllo → Visibilità) → click.
2. Imposta monetizzazione **ON** (`find "Attiva / On"`). Verifica "On" via `read_page`.
3. Apri **"Tipi di annunci / Ad types"** (a volte dietro una matita "Modifica") → spunta **tutti**:
   display, overlay, skippabili, **non skippabili**, e per il long-form i **mid-roll automatici**
   ("Posiziona automaticamente le interruzioni pubblicitarie"). Usa `read_page filter:"interactive"` per
   enumerare le checkbox e spuntare quelle mancanti. **Fine/Salva**.
4. ✅ Verifica: `get_page_text` del pannello → monetizzazione On + elenco annunci (mid-roll inclusi).
   Echo: *"Monetizzazione ON, tutti gli annunci attivi (mid-roll automatici inclusi)."*
   Se il tab è assente o "non idoneo / not eligible" → **STOP** e avvisa (gli annunci sono obbligatori;
   il canale/video potrebbe non essere idoneo).

### Fase 5 — Elementi video / Controllo verifiche
- **Elementi video**: end screen/card solo se Andrea li chiede; altrimenti `find "Avanti / Next"`.
- **Controllo**: leggi i risultati (copyright / idoneità annunci) con `get_page_text`. Se ci sono
  rivendicazioni copyright o "annunci limitati / non idoneo" → **STOP** e riporta (impatta gli annunci
  obbligatori); altrimenti avanti.

### Fase 6 — Visibilità = PRIVATO (bozza) e salva
- `find "Visibilità / Visibility"` → seleziona **Privato / Private** (NON pubblicare ora: copertina e
  data/ora arrivano dopo).
- **Salva la bozza** (se Studio offre "Salva", clicca; altrimenti il video resta come bozza Privata
  nell'elenco Contenuti). **Registra la URL di modifica** del video in Studio (es.
  `studio.youtube.com/video/<ID>/edit`) per riaprirlo in Sessione 2.

### 🔁 Handoff (fine Sessione 1)
> **"Fatto ✅ Ho caricato il video completo e impostato titolo, descrizione SEO (con capitoli), tag,
> playlist, lingua, categoria, pubblico = non per bambini, **monetizzazione ON con tutti gli annunci**,
> e i sottotitoli (it + en/es/ja/zh/hi/ar). Visibilità = **Privato (bozza)**. Quando hai la copertina,
> riprendi la conversazione e dimmi **dove sta** e **quando/a che ora** pubblicare: imposto la copertina,
> ti mostro il riepilogo e **programmo**."**

---

## SESSIONE 2 — Copertina + programmazione (Andrea riprende)

### Fase 7 — Riapri la bozza + imposta la copertina
1. `navigate` alla URL di modifica salvata (o Studio → **Contenuti** → clicca il video → **Dettagli**).
2. Nella sezione **Anteprima/Thumbnail**: `find "Carica file / Upload thumbnail"` → individua l'input file
   → `file_upload { paths:[<copertina>], ref, tabId }`. (Se il percorso è rifiutato → chiedi ad Andrea di
   trascinare l'immagine nello slot.) La copertina personalizzata richiede canale verificato (Elisa lo è).
3. ✅ Verifica: `screenshot` + conferma che l'anteprima mostri la **copertina personalizzata** scelta
   (non un frame auto). `find "Salva"` se ci sono modifiche non salvate. Echo: *"Copertina impostata ✅"*.

### Fase 8 — Programmazione + gate finale
1. Vai su **Visibilità** → **Programma / Schedule** → imposta **data** e **ora** date da Andrea
   (`form_input`); **conferma il fuso** mostrato. Verifica la rilettura della data/ora.
2. Mostra il **RIEPILOGO**: titolo · anteprima descrizione (primi ~200 char + "capitoli presenti ✅") ·
   n. tag · playlist · lingua · categoria · **non per bambini ✅** · **monetizzazione ON, annunci tutti
   (mid-roll inclusi) ✅** · **sottotitoli: 7 lingue ✅** · **copertina impostata ✅** · **programmazione:
   <GG/MM hh:mm>**.
3. Chiedi: *"Confermi? Scrivi «vai» per programmare per <GG/MM hh:mm>."* **Attendi "vai"** esplicito.
   Senza "vai" → **non** cliccare.
4. Su "vai": `find "Programma / Schedule"` (il pulsante finale) → click.
5. ✅ Conferma: `screenshot` + `get_page_text` della conferma "Video programmato"; leggi stato + URL e
   riporta ad Andrea.

---

## Tabella errori
| Sintomo | Causa | Azione |
|---|---|---|
| Pagina di login / scelta account | Non loggato / sessione scaduta | **STOP**, non inserire credenziali, chiedi ad Andrea di loggarsi |
| 2FA / CAPTCHA / banner consenso | Verifica di sicurezza | **STOP**, riporta verbatim, chiedi (mai risolvere CAPTCHA / accettare consensi) |
| `list_connected_browsers` vuoto | Estensione non connessa | Chiedi di installare/abilitare l'estensione Claude per Chrome |
| `file_upload` "path rejected" | File non condiviso con la sessione | Chiedi di condividere/trascinare il file nella finestra |
| Tab "Monetizzazione" assente / "non idoneo" | Canale/video non in YPP o non idoneo | **STOP**, avvisa (annunci obbligatori) |
| Studio in inglese vs italiano | Lingua account | `find` per ruolo/etichetta in **entrambe** le lingue |
| Pulsante Pubblica/Programma disabilitato | "Pubblico/Bambini" non impostato o controlli in corso | Imposta audience; attendi la fine dei controlli |
| Caricamento fermo a X% | Rete / file grande | `wait` + `screenshot`; se fermo a lungo, avvisa Andrea |

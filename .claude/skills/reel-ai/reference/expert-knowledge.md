# Expert knowledge — reel social & editing verticale

Base di conoscenza per la Fase 1B. Sintesi di best-practice 2025–2026 (OpusClip, Choppity, Reap, studi di retention). Usala per ragionare, non per recitarla all'utente.

---

## ⭐ Preferenze fisse dell'utente (override — hanno la precedenza)

> Salvate su richiesta esplicita dell'utente. Valgono per i reel di questo progetto e **prevalgono** sulle linee guida generali qui sotto, quando in conflitto.

- **Qualità del contenuto > ottimizzazione social.** Conta la forza e la completezza del contenuto, non ciò che è "ottimale" per le metriche. Più il contenuto è qualitativo, meglio è.
- **Durata: minimo 60s, massimo 90s** (default). Lo spettatore deve potersi fare un'idea completa del contenuto. Non sacrificare il senso/la completezza per la brevità, anche se significa superare il "punto dolce" social classico (20–45s). **Eccezione per reel «profondi/completi» (es. consulti):** se l'utente chiede reel completi e profondi, si può arrivare **fino a 3 minuti**, ma **mai superarli**. Meglio pochi discorsi lunghi e chiusi che tanti tagli.
- **📝 SCRIVERE SEMPRE IL REEL PRIMA DI MONTARLO (regola ferrea).** Ogni volta che l'utente chiede un reel, **prima** di costruirlo (prima di `/reel-ai2`, prima di qualsiasi montaggio) si scrive **tutto il brief** e soprattutto le **PAROLE ESATTE (verbatim)** che verranno pronunciate nel reel — segmento per segmento, **nell'ordine del montaggio** — così l'utente legge il "copione" reale e decide **quali parti usare**. Si monta **solo dopo** la sua conferma. Il `text:` di ogni segmento nel brief dev'essere la **trascrizione fedele** di ciò che si sente in quei timecode (non una parafrasi), pulita solo dagli errori evidenti di ASR; se un punto è incerto, segnalalo.
- **🎬 DUE PERSONE = SEMPRE DUE TRACCE (regola ferrea).** Ogni volta che si monta un video con **due persone** (consulto, intervista, dialogo), il layout è **sempre**: **una traccia SOPRA per Elisa** e **una traccia SOTTO per l'altra persona** (`reframe: two-person-stack` con Elisa in alto). **Mai più di due tracce**, mai una sola persona a schermo. Se l'altra persona va oscurata (privacy consulti), il **blur va sulla traccia in basso** (`bottom`). Se il video sorgente ha **già** il blur applicato sul cliente, basta impilarli (Elisa sopra / cliente sotto) senza aggiungere altro blur. Vale per tutti i reel a due persone, sempre.
- **🔗 LETTURA→CONFERMA: prima verifica il legame, poi preferisci il BLOCCO INTERO (regola ferrea).** Nei consulti Elisa spiega prima "quello che le arriva" (spesso alla cieca, senza contesto), e la conferma del cliente arriva **minuti dopo**, altrove nella registrazione. Prima di accostare due spezzoni lontani come "lettura → conferma":
  1. **Verifica che la conferma si riferisca DAVVERO a quella lettura specifica**, non solo che il tema sia vicino nel tempo o simile — leggi il testo, non dedurre dalla vicinanza. Spesso Elisa **ricita da sola** la propria frase originale quando la ricollega ("adesso capisco cosa voleva dire… ha scritto X…"): quello è il punto di aggancio sicuro, cercalo.
  2. **Quando trovi quell'aggancio, preferisci il BLOCCO INTERO e continuo** attorno ad esso (spiegazione del cliente + il "ricollegamento" di Elisa + eventuale rivelazione successiva), **invece di** tagliare tanti micro-spezzoni sparsi accostati "a salti". Un pezzo unico, ininterrotto, dove Elisa stessa fa da ponte ripetendo la sua frase, dà **il contesto vero** e si segue senza sforzo. Tanti frammenti isolati — anche se ciascuno è corretto — restano "scuciti" e il senso si perde.
  3. **Un solo salto è meglio di quattro.** Se serve un'apertura di contesto (es. "chi è questa persona"), tienila cortissima e poi taglia dritto sul blocco intero: **un salto contesto→blocco**, non una sequenza di salti tra frasi isolate.
  4. Questo vale ogni volta che si costruisce un reel da un consulto/lettura: prima di scrivere il verbatim per l'utente (vedi regola sopra), controlla se la "conferma" che stai per usare è in realtà dentro un blocco più ampio e continuo che conviene tenere intero.

## ⓿ Tipo di video → strategia di taglio (RICONOSCI il tipo e CHIEDI sempre)

**Il tipo di contenuto cambia COSA privilegi nei tagli.** Prima di scegliere i segmenti devi (1) **riconoscere** che tipo di video è, e (2) **chiederlo/confermarlo all'utente** — perché lo stesso video può diventare reel diversi a seconda dell'obiettivo.

**Come riconoscere il tipo** (dalla trascrizione + contesto): guarda chi parla, il registro, la presenza di domande/risposte, di spiegazioni, di narrazione, di emozione.

| Tipo | Segnali | **Cosa privilegiare nei tagli** | Hook tipico |
|---|---|---|---|
| **Divulgativo / explainer / tutorial** | una voce che spiega, concetti, "come si fa", esempi | le **SPIEGAZIONI chiare** e i concetti "aha" / passaggi azionabili; **meno** enfasi sull'emotivo, **più** sulla chiarezza e completezza del concetto. Togli divagazioni; tieni ciò che fa capire. | la **promessa** di capire qualcosa ("ecco perché X", "il vero motivo per cui…") |
| **Documentario / narrativo** | racconto, voce narrante, archi temporali, immagini | l'**ARCO narrativo** e la tensione: contesto → sviluppo → rivelazione. Tieni il **filo della storia**, anche a scapito di singole frasi forti isolate. | tensione/mistero ("quello che successe dopo cambiò tutto") |
| **Consulto / seduta** (es. lettura, coaching, terapia, consulenza) | due persone, domanda del cliente → risposta dell'esperto, tono intimo | lo **SCAMBIO domanda→risposta** e i momenti di **rivelazione/emozione misurati**; tieni l'**interazione** (domanda + risposta), non solo il monologo. **Privacy/consenso**: no cognome, eventuale volto del cliente da sfocare. | la **domanda forte** del cliente o la **rivelazione** dell'esperto |
| **Intervista / podcast** | host + ospite, botta-risposta | le **RISPOSTE forti** e gli **scambi**, le frasi citabili dell'ospite. Tieni **domanda+risposta** quando la domanda dà senso. | l'**affermazione shock** dell'ospite |
| **Talk / speech / keynote** | un relatore, pubblico, struttura argomentativa | i punti più **CITABILI**, le frasi a effetto, la tesi. | la **tesi forte** / dato sorprendente |
| **Vlog / racconto personale** | prima persona, vita/esperienza | i momenti **EMOTIVI** e i colpi di scena personali. | il momento clou anticipato |

> Se il video è un **ibrido** (es. intervista che spiega = intervista+divulgativo), dillo e chiedi su quale **angolo** puntare.

**REGOLA OBBLIGATORIA — dopo la PRIMA analisi della trascrizione, SEMPRE:**
1. **Dichiara il tipo che hai riconosciuto**: *"Questo mi sembra un **consulto** (due persone, domanda→risposta, tono intimo)."*
2. **Chiedi che contenuto/risultato vuole l'utente**: *"Che taglio vuoi dare al reel? Es. (a) la rivelazione più forte, (b) lo scambio domanda-risposta completo, (c) il momento più emozionante. O dimmi tu l'angolo."* — offri 2–3 opzioni coerenti col tipo riconosciuto.
3. **Solo DOPO la sua risposta**, dai i **suggerimenti specifici** per quel tipo+angolo (quali parti privilegiare, quali archi tengono) e procedi alla scelta dei segmenti. Non dare per scontato l'angolo: lo decide l'utente.

Questa domanda è **sempre dovuta**, anche se il tipo ti sembra ovvio: è ciò che fa la differenza tra un reel generico e uno mirato.

---

## 1. L'hook (i primi 3 secondi decidono tutto)

- **Dato chiave:** il 50–60% di chi abbandona lo fa **entro i primi 3 secondi**. La "intro retention" dovrebbe stare **sopra il 70%**. Se l'inizio è debole, il reel non parte, punto.
- **Anatomia di un hook forte:** `[Rottura di pattern] + [Trigger emotivo] + [Curiosity gap]`. Deve fermare lo scroll **istantaneamente**, a livello visivo **e** verbale.
- **L'hook va consegnato entro il 3° secondo.** Niente preamboli ("ciao a tutti, benvenuti…"), niente convenevoli: è la morte della retention. Mai la **buried lede** (il pezzo più forte sepolto al secondo 15–20: il 70% se n'è già andato).
- **Per un reel da intervista/podcast**, l'hook è quasi sempre **una frase già detta** dallo speaker: la più scioccante, controintuitiva, emotiva o "proibita". La trovi tu nella trascrizione e la **sposti all'inizio**.

**Format di hook collaudati** (per riconoscere/inquadrare la frase, e per la caption-titolo):
| Tipo | Formula | Esempio |
|---|---|---|
| Contrarian | "Tutti dicono X, ma…" | "Tutti ti dicono di postare ogni giorno, io ho fatto 100K postando 2 volte a settimana" |
| Errore/Costo | "Ho perso [X] perché…" | "Ho buttato 5.000€ in ads prima di capire questa cosa" |
| Lista numerata | "[N] cose che [esito]" | "3 errori che uccidono la tua reach" |
| Time-based | "Come ho [risultato] in [tempo breve]" | "Come ho fatto 10K follower in 60 giorni" |
| Domanda/Provocazione | "Stai sbagliando X?" / "E se…?" | "Stai usando l'algoritmo contro te stesso?" |
| Verità nascosta | "La cosa che nessuno ti dice su…" | apre un loop fortissimo |

L'hook può **durare 20–30s** se è una frase che monta la tensione: va bene, purché ogni secondo "tiri".

---

## 2. Open loop — aprire e CHIUDERE il loop

La tecnica più potente per la retention: **apri una curiosità (loop) all'inizio e paga la promessa più avanti / alla fine.**
- L'hook **promette** qualcosa ("ora ti spiego perché ho rischiato tutto"); il reel **deve mantenere**. Hook esagerato/non mantenuto = crollo della fiducia e delle performance future.
- **Riproponi/chiudi l'hook**: l'ultima parte del reel deve **richiamare** e **risolvere** la frase di apertura (è esattamente la richiesta dell'utente: l'hook si rimette e si chiude più avanti).
- Se il segmento viene da un discorso più lungo, **chiudi con un cliffhanger** o un take memorabile che lasci voglia di cercare il contenuto completo.

---

## 3. Mappa dei contesti (il lavoro più complesso)

In un'intervista/podcast un **tema** raramente vive in un blocco unico: **si apre**, viene **interrotto** da divagazioni, poi **riprende** e **si chiude** molto dopo. Per tagliare bene devi ricostruire questi archi.

**Metodo:**
1. Scorri **tutta** la trascrizione e marca, per ogni tema rilevante, gli eventi: `OPEN` (dove si introduce), `PAUSE` (dove viene lasciato in sospeso), `RESUME` (dove riprende), `CLOSE` (dove si conclude/paga).
2. Costruisci una tabella mentale tipo:
   ```
   Tema "rischio economico":  OPEN 03:10 → PAUSE 04:05 → RESUME 31:40 → CLOSE 39:50
   Tema "primo successo":     OPEN 12:03 (← potenziale HOOK) → CLOSE 12:31
   ```
3. **Scegli un arco** che, ricucito, regga da solo in 20–60s e abbia una **micro-struttura completa** (tensione → sviluppo → pagamento). Spesso = `HOOK (un pezzo forte) + CONTESTO (il minimo che serve a capirlo) + CHIUSURA (il pagamento del loop)`.
4. Verifica la **continuità di senso**: ricucendo pezzi lontani, il discorso deve filare. Se serve una frase-ponte o una caption per colmare un salto, annotala.
5. Verifica la **continuità audio/visiva**: salti bruschi di tono di voce o di inquadratura si possono coprire con un taglio sul cambio-speaker, una caption, o una micro-transizione (lo gestirà la Parte 2).

Gli speaker aiutano: sapere **chi dice cosa** rende ovvi i confini dei segmenti e i cambi di turno (e abilita il layout two-person).

---

## 3b. Il discorso completo (l'unità da selezionare)

NON selezionare "momenti" isolati: seleziona **discorsi completi**. Un discorso ha:
- **apertura** (l'hook: la frase che incuriosisce/emoziona),
- **sviluppo** (il perché, il racconto, la tensione),
- **risposte/reazioni** degli altri interlocutori (in un'intervista: la domanda di A + la risposta di B; un'obiezione + la replica),
- **chiusura** (il pagamento: la frase che risolve, la rivelazione, la morale).

**Regola d'oro: un discorso non si lascia a metà.** Se l'hook apre un loop ("ho rischiato tutto…"), il reel deve **chiuderlo** ("…e oggi è il logo dell'azienda"). Prima di passare a un altro discorso, quello attuale deve avere una **fine sensata**. Se un discorso forte non ha una chiusura da nessuna parte nel video, **non usarlo come spina dorsale**. Metodo: per ogni candidato hook, cerca nel testo **dove quel filo si chiude** (anche lontano) e **chi risponde**; ricostruisci l'arco completo, poi taglialo a misura.

---

## 3c. Pulizia dei bordi (taglio pulito)

Il punto più trascurato, e quello che rovina i reel: **i bordi dei tagli**.
- L'**inizio** di un segmento dev'essere una frase **completa e auto-consistente**. MAI iniziare con parole monche o che si riferiscono a qualcosa di prima ("…e quindi", "…per questo", "…lei invece", pronomi senza referente): chi guarda non ha il contesto precedente e si perde.
- La **fine** dev'essere su una frase conclusa, non troncata a metà pensiero.
- Sposta `in`/`out` su **confini di frase reali** (di solito una breve pausa nel parlato).
- Se per dare senso serve una frase-ponte presa da un altro punto, **annotala** nell'ordine dei segmenti.

---

## 3d. Quanti reel + durata (qualità > quantità)

- I reel durano **max 2 minuti** (idealmente 30–90s).
- **Quanti reel** da un video = quanti **discorsi forti e COMPLETI** ci sono davvero (hook + sviluppo + chiusura). Non spremere: **meglio 1 reel eccellente che 4 mediocri.** Conta gli archi completi e **proponi tu** quel numero (indicando quali).
- **Durata**: parti dal discorso, non da un timer. Se un discorso regge in 40s, non allungarlo a 90 per "riempire"; se è troppo lungo e cala, **proponi di accorciare**. Concorda la durata con l'utente.

---

## 3e. Toni ed emozioni (e l'uso del video)

Dal **solo testo** non si vede chi **piange, si commuove, urla, è arrabbiato** — ma il tono è ciò che rende un reel potente. Come capirlo:
- **Dal contesto**: il contenuto (un lutto, una rivincita), le parole, le ripetizioni, i puntini di sospensione.
- **Dal video (se disponibile)**: estrai **fotogrammi** ai momenti candidati e **guardali** (vedi i volti: pianto, sguardo intenso…) — comando in `transcription.md`. Ottimo per confermare i picchi.
- (Opzionale) **dall'audio**: picchi di volume = enfasi/urla.

Nei momenti a **tono forte**, **amplia** il discorso (più respiro, includi la reazione): sono i momenti che fermano lo scroll. Se l'utente non ha condiviso il video e i toni sono ambigui, **chiediglielo** ("in questo punto piange / si commuove?").

---

## 4. Struttura e durata del reel

- **Durata**: 15–60s è la zona ottimale per i clip social; per un reel "narrativo" da intervista, **20–45s** è il punto dolce. Più corto = completion rate più alto; più lungo solo se ogni secondo è forte.
- **Arco classico**: `HOOK (0–3s, fino a ~20–30s se monta) → SVILUPPO (i punti che reggono la promessa) → PAGAMENTO/CHIUSURA (chiude il loop) → (opz.) CTA breve`.
- **Ritmo**: i reel che performano hanno **un taglio ogni 2–4 secondi** o comunque un cambio visivo frequente (cambio inquadratura, zoom, caption che scatta). Evita lunghe inquadrature statiche.
- **Editing minimalista (2025–2026)**: ogni effetto deve avere uno scopo. Niente orpelli. Pulito, ritmato, leggibile.

---

## 5. Scelta dei momenti (long → short)

Cerca, nella trascrizione, i segnali di un **momento clippabile**:
- frasi **shock/controintuitive**, **grandi domande**, **fatti sorprendenti**;
- **picchi emotivi** (risata, commozione, scontro acceso, ispirazione);
- **quote** memorabili, definizioni nette, numeri forti;
- **cambi di energia** o di argomento (spesso aprono/chiudono un arco).
Da un'intervista lunga di solito escono **più reel**: proponi il migliore, ma segnala se ne vedi altri 1–2 forti.

**Pezzi lunghi vs micro-tagli (principio chiave):** di norma **meglio POCHI segmenti lunghi e approfonditi** su un'unica sezione forte, che TANTI micro-tagli presi da punti diversi. I micro-tagli sconnessi confondono e tolgono senso. Punta a **2–4 segmenti** che, ricuciti, raccontano UNA cosa fatta bene e completa. **Chiedi all'utente** quale stile vuole: (a) più micro-tagli → più argomenti ma meno profondità; (b) una parte più lunga e coerente → un argomento mostrato benissimo (**consigliato**).

---

## 6. Reframing orizzontale → verticale (hint per la Parte 2)

L'app farà il reframe; tu suggerisci il **come** per ogni segmento:
- **Center-lock / center-face** (default per parlato): tieni il soggetto **centrato**, taglia uguale a sinistra/destra. Ideale per interviste/monologhi dove chi parla resta al centro. Tieni il volto entro il **centro 80%** del frame verticale (mai a filo dei bordi).
- **Two-person stack** (due persone affiancate, es. gallery Zoom): è la scelta GIUSTA e PREFERITA per due riquadri affiancati → l'app **taglia via le bande nere** e impila la persona **SINISTRA in alto** e la **DESTRA in basso**, ognuna a riempire la sua metà. Metti `reframe: two-person-stack` per OGNI segmento di quel video (mostra entrambe, sempre — non una sola persona). Per **sfocare** una delle due, scrivi nel brief chi e da che lato: la Parte 2 sfoca `top`=sinistra / `bottom`=destra con una regione fissa robusta (regge le mani sul viso), dopo conferma.
- **Active speaker**: se gli speaker si alternano, indica di **seguire chi parla** (la Parte 2 può centrare di volta in volta lo speaker attivo del segmento).
- **Fit-contain** (fallback): se >2 persone o scena d'insieme, l'intero frame orizzontale dentro il 9:16 con barre (eventuale sfondo). La Parte 2 chiederà conferma sopra le 2 persone.

---

## 7. Captions (NON nel brief — le aggiunge l'utente)

> Nota: l'app **non** inserisce captions/titoli automaticamente e il **brief non li include**. Il testo a schermo lo mette l'utente dopo, nell'app social. Quanto segue sono best-practice da passargli a voce, non istruzioni per il brief.

- **80%+ guarda senza audio**: le captions non sono opzionali. Aumentano engagement (~+30%) e completion.
- **Stile**: sans-serif **bold** (Poppins/Futura/Gotham-like), **centrato**, testo bianco con **outline/ombra scura** (leggibile su qualsiasi sfondo).
- **Quantità**: **3–4 parole alla volta** (max ~20–27 caratteri per riga), una riga, ritmo serrato sincronizzato col parlato (entro ~100–200ms dalla parola).
- **Posizione sicura**: fascia **centro-medio / medio-alto**. Evita il **25% inferiore** (UI di like/commenti) e il **15% superiore** (username).
- **Hook on-screen**: rinforza l'hook verbale con una **caption-titolo** grande nei primi secondi (chi guarda muto deve capire la promessa).

---

## 8. Audio e continuità

- L'audio **guida** il montaggio: taglia preferibilmente **a fine frase/respiro**, non a metà parola.
- Rimuovi pause morte, "ehm", false partenze (segnala i tagli interni nel brief se utili).
- Ricucendo pezzi lontani, attenzione agli **stacchi di tono**: un micro-fade o un taglio sul cambio-speaker li ammorbidisce (Parte 2).
- Musica/SFX: opzionali; se l'utente li vuole, indicali nel brief, ma **la voce resta in primo piano**.

---

## 9. Errori comuni da evitare

- Preamboli/saluti prima dell'hook · buried lede · hook che promette e non mantiene.
- Inquadrature statiche e lunghe · nessuna caption · testo nel 25% basso coperto dalla UI.
- Reel troppo lungo "perché il contenuto è bello": se cala, taglia.
- Ricuciture che spezzano il senso senza una frase-ponte/caption.
- Dimenticare di **chiudere il loop** aperto dall'hook.

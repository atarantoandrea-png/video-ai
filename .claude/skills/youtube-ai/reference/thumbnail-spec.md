# thumbnail-spec.md — Copertina generata DA GPT (prompt = solo sfondo/grafica)

**Decisioni di Andrea:**
1. La **grafica la fa tutta GPT** (sfondo + composizione + titolo) — è migliore di Claude per la grafica.
2. **NON descrivere Elisa** (cosa fa, com'è): dì a GPT di **usarla IDENTICA alla foto allegata**, copiandola
   uguale. Lei è **sempre e solo** l'unica persona.
3. Nel prompt ti occupi **solo di SFONDO + GRAFICA + CONTESTO** (inerente al video) e del **titolo**.
4. La **posa/emozione** della copertina si sceglie **scegliendo la foto giusta** dal database
   (`cover-images.md`), non descrivendola.

## Cosa produce la skill (per ogni video: 2-3 varianti)
Per ogni variante:
- **Foto di Elisa da allegare**: una riga di `cover-images.md` (sfondo neutro/studio, frontale), scelta in
  base all'**emozione** del video. Annota il filename + il lato `spazio` (lì va il titolo).
- **Prompt copertina** pronto per ChatGPT (con quella foto allegata) che descrive **solo**: formato,
  istruzione di usare la persona della foto identica, **sfondo/contesto** a tema, **titolo**.

## Template prompt (copertina completa)
```
Crea una copertina YouTube fotorealistica 16:9 (1280×720), cinematografica e ad alto impatto.
USA LA PERSONA NELLA FOTO ALLEGATA ESATTAMENTE COM'È: stessa identica — non modificarle viso, posa,
espressione, capelli o vestiti; ricopiala uguale. È lei l'UNICA persona della copertina. Scontornala dal
suo sfondo e inseriscila sul lato <destro/sinistro>, mezzo busto.
SFONDO E CONTESTO (è QUI il tuo lavoro): <scena/ambientazione fotorealistica inerente al video — luce,
palette, elementi simbolici>. Lato <opposto> più scuro/pulito per il testo.
TESTO grande e ben leggibile sul lato <opposto>: «<TITOLO COPERTINA>», bianco grassetto con ombra.
Niente altre persone, niente loghi, niente watermark. Colori <palette>.
```
> Nota: descrivi la **scena**, non Elisa. La sua posa/espressione arrivano dalla **foto scelta**.

## Esempio — Consulto (incidente/aldilà), foto `…mani-sul-cuore…`, titolo «Mamma, ora sto bene»
```
Crea una copertina YouTube fotorealistica 16:9 (1280×720), cinematografica, intima ed emotiva.
USA LA PERSONA NELLA FOTO ALLEGATA ESATTAMENTE COM'È: stessa identica, non modificarla, ricopiala uguale.
È lei l'unica persona. Scontornala e inseriscila sulla DESTRA, mezzo busto.
SFONDO E CONTESTO: una strada di campagna al crepuscolo che si perde verso l'orizzonte, luce calda e
morbida, tenui particelle di luce dorata sospese che suggeriscono una presenza gentile e invisibile; cielo
fra l'ambra e il blu notte; atmosfera rispettosa e poetica (NON drammatica, nessun veicolo o scena di
incidente). Lato sinistro più scuro e pulito per il testo.
TESTO grande e ben leggibile sul lato SINISTRO, due righe: «Mamma, ora sto bene», bianco grassetto con ombra.
Niente altre persone, niente loghi, niente watermark. Colori ambra e blu notte.
```

## Esempio — Community («le 5 ferite dell'anima»), foto studio/serena
```
Crea una copertina YouTube fotorealistica 16:9 (1280×720), spirituale e calma.
USA LA PERSONA NELLA FOTO ALLEGATA ESATTAMENTE COM'È: identica, ricopiala uguale; unica persona. Scontornala
e inseriscila sulla destra, mezzo busto.
SFONDO E CONTESTO: foschia morbida dal viola all'oro con tenui raggi di luce e un libro aperto sfocato che
brilla in basso; lato sinistro pulito per il testo.
TESTO grande sul lato sinistro: «le 5 ferite dell'anima», bianco grassetto con ombra.
Niente altre persone, niente loghi, niente watermark. Colori viola e oro caldo.
```

## Sempre
- **2-3 varianti** (sfondo/contesto diversi, eventualmente foto diverse).
- GPT può **sbagliare il testo italiano**: controlla l'ortografia; se sbagliato, **rigenera**.
- La generazione + l'allegato della foto: vedi `cover-auto.md` (modalità `comando io gpt`).

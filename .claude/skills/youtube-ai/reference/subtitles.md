# subtitles.md — Sottotitoli multilingua + audio multilingua (futuro)

Obiettivo: coprire una bella fetta del mondo con i **sottotitoli** in più lingue, e — quando YouTube lo
permetterà nativamente — anche l'**audio tradotto**.

## Sottotitoli — lingue (7 tracce)
- **Originale**: Italiano `it`
- **Traduzioni**: Inglese `en` · Spagnolo `es` · Giapponese `ja` · Cinese semplificato `zh-Hans` ·
  Hindi `hi` (= "indiano", default; chiedi se intende un'altra lingua indiana) · Arabo `ar`

**Selezione (Step 7):** mostra tutte e 7 come **caselle da spuntare**. L'**Italiano è l'originale** (sempre
incluso, **NON si traduce** — la trascrizione è già in italiano). L'utente **spunta** quali **traduzioni**
generare → produci l'SRT `it` + **solo** le lingue scelte (più mirato e più veloce). EN/ES = ROI migliore.

## Generazione
1. **Originale (it)**: parti dal transcript/VTT già prodotto da `/reel-ai` (ha i timecode). Costruisci un
   file **SRT** (o VTT) accurato: correggi nomi propri e termini medianici (l'originale accurato batte
   l'auto-caption di YouTube; migliora SEO e accessibilità).
2. **Traduzioni**: **traduci tu** (Claude è multilingue) **cue per cue**, **mantenendo i timecode**
   identici — cambia solo il testo dentro ogni finestra temporale. Non unire/spezzare le battute.
   - **Arabo** è RTL: l'SRT lo gestisce nativamente, YouTube lo rende correttamente.
   - **Giapponese/Cinese**: niente spazi tra le parole (normale); tieni le righe brevi.
   - Adatta la lunghezza alla durata della battuta (riformula se troppo lunga da leggere).
3. **Dove scrivere i file**: in una **cartella della sessione** (output/uploads), così sono caricabili
   dall'estensione di Chrome (`file_upload` accetta solo file condivisi con la sessione).
   Nomina: `sub_it.srt`, `sub_en.srt`, `sub_es.srt`, `sub_ja.srt`, `sub_zh-Hans.srt`, `sub_hi.srt`,
   `sub_ar.srt`.

### Formato SRT (promemoria)
```
1
00:00:01,000 --> 00:00:04,200
<testo della battuta>

2
00:00:04,300 --> 00:00:07,000
<testo successivo>
```
(VTT è equivalente con header `WEBVTT` e `.` al posto della `,` nei millisecondi.)

## Upload (in youtube-studio.md, Fase Sottotitoli — sessione 1, sulla bozza)
- Studio → video → **Sottotitoli** → per ogni lingua: **Aggiungi lingua** → scegli la lingua →
  **Carica file** → **"Con i tempi"** → seleziona l'SRT → **Pubblica/Salva** la traccia → verifica.
- Imposta la **lingua del video = Italiano** così l'originale è marcato come tale.
- Si può fare **prima** della pubblicazione (sulla bozza Privata).

## Audio multilingua / doppiaggio — quando YouTube lo consente nativamente
Obiettivo: audio tradotto, **prima inglese**, poi le altre disponibili.
- **Via nativa (preferita)**: la funzione **"audio multilingua"** di YouTube e l'auto-dub **Aloud** si
  abilitano a livello di canale. In `youtube-studio.md`, **rileva** in Studio la sezione **Audio / lingue
  audio aggiuntive** (o Aloud):
  - se **presente** → usala, ordine **EN → ES → JA → ZH → HI → AR**;
  - se **assente** → **salta con avviso**: "Audio multilingua non ancora disponibile nativamente sul
    canale; carico solo i sottotitoli." Non tentare workaround.
- **Produzione tracce nostre** (solo su richiesta esplicita, modulo futuro): generare il doppiaggio con
  TTS/voice-clone (es. servizi di dubbing). È esterno/oneroso → **non** attivarlo di default; preferisci
  sempre la via nativa appena disponibile.

## Note
- I sottotitoli aiutano SEO (testo indicizzabile) **e** reach internazionale: vale la pena anche solo per
  l'originale accurato.
- Tieni le tracce coerenti con eventuali tagli del video finale (i timecode devono combaciare col file
  caricato su YouTube, non con la sorgente grezza se il montaggio è diverso).

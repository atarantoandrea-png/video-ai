# youtube-pack-contract.md — Formato del «YouTube Pack»

Il «YouTube Pack» è l'artefatto markdown che la skill produce. È ordinato **in ordine di pubblicazione**
così Andrea (o la Fase upload) può copiarlo dall'alto verso il basso dentro YouTube Studio. Tutto in italiano.

## Formato esatto

```markdown
# YouTube Pack — <titolo breve interno> (<tipo: Consulto | Community-live | Generico>)

## Meta
- tipo: <Consulto | Community-live | Generico>
- formato: <long-form | Shorts>
- lingua: it
- categoria: <categoria YouTube consigliata, es. People & Blogs>
- playlist: <playlist del canale in cui inserirlo>
- fonte: <trascrizione del video lungo | brief /reel-ai>

## Titoli (scegline 1) — ≤100 caratteri, keyword in apertura
1. <titolo opzione 1>
2. <titolo opzione 2>
3. <titolo opzione 3>
4. <titolo opzione 4>   # opzionali
5. <titolo opzione 5>

## Titolo copertina (scegline 1) — ≤5 parole, CURIOSITÀ
1. <copertina opzione 1>
2. <copertina opzione 2>
3. <copertina opzione 3>

## Descrizione (incolla così com'è)
<prime 2 righe: gancio + keyword>

<corpo narrativo>

<ponte/blocco del tipo: community bridge / libro citato>

<BLOCCO LINK canonico del tipo>

📌 Indice / Capitoli            <!-- SEMPRE in youtube-ai (tempi reali del video montato); il primo DEVE essere 00:00 -->
00:00 <…>

<BLOCCO HASHTAG canonico del tipo>

## Tag / keyword (campo "Tag" di Studio, separati da virgola)
<keyword principale>, <varianti>, <long-tail>, Elisa Soul Medium, ...

## Hashtag (i primi 3 compaiono sopra il titolo)
#Tag1 #Tag2 #Tag3 #Tag4 #Tag5

## Capitoli / timestamp (INDICE — SEMPRE, dentro la descrizione subito prima degli #)
# In youtube-ai i tempi sono SEMPRE reali (trascrizione + video montato) → l'indice è SEMPRE presente,
# alla FINE della descrizione, subito prima del blocco HASHTAG. Il primo DEVE essere 00:00.

## Sottotitoli (tracce generate)
- it (originale): <percorso file .srt>
- en: <percorso> · es: <percorso> · ja: <percorso> · zh-Hans: <percorso> · hi: <percorso> · ar: <percorso>
# (i file li genera la Fase Sottotitoli; vedi subtitles.md)

## Concept copertina (2-3 varianti) — la genera TUTTA GPT
### Variante A — <nome>
- Idea (curiosità): <descrizione scena>
- Testo copertina: "<≤5 parole>"
- Foto di Elisa da allegare: <quale foto da ~/Desktop/Carosello/Elisa immagini, frontale e nitida>
- Prompt copertina COMPLETO per GPT (sfondo + volto dalla foto allegata + titolo): "<vedi thumbnail-spec.md>"
### Variante B — ...
### Variante C — ...

## Note di pubblicazione
- Privacy (se Consulto): nessun cognome, 3ª persona.
- Audience: NON per bambini. Monetizzazione: ON, tutti gli annunci.
- end screen / cards consigliati; eventuali avvertenze.
```

## Regole di compilazione
- **Mai** inventare timestamp: se il brief/carosello non li ha, scrivi la riga "nessun capitolo".
- **Tag ordinati** per rilevanza (keyword primaria per prima); includi sempre `Elisa Soul Medium`.
- **Hashtag**: 3-5, mai >15; `#ElisaSoulMedium` primo (vedi house-style + algorithm-playbook).
- La **Descrizione** dev'essere già pronta da incollare (capitoli inclusi nel testo).
- I **percorsi sottotitoli** vengono riempiti dopo la generazione (Fase Sottotitoli); se l'utente vuole
  solo il pacchetto testuale e non l'upload, lascia i percorsi come `— (da generare)`.

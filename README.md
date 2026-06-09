# Video AI — editor reel desktop con AI

Editor video desktop professionale con un'AI in due parti che trasforma una
registrazione in un **reel verticale 9:16** montato sulla timeline. Per **macOS** e **Windows**.

- 🌐 **Sito di download:** abilita GitHub Pages su questo repo (Settings → Pages → *Deploy from a branch* → `main` / `/docs`). Sarà su `https://atarantoandrea-png.github.io/video-ai/`.
- ⬇️ **Download app:** dalla pagina [Releases](../../releases/latest) (Mac `.dmg`, Windows `.exe`).
- 🤖 **Skill `/reel-ai`:** inclusa in [`docs/reel-ai-skill.zip`](docs/reel-ai-skill.zip) e in [`.claude/skills/reel-ai/`](.claude/skills/reel-ai).

---

## 🚀 Pubblicare una nuova versione (aggiornamento automatico)

Gli utenti **non riscaricano tutto**: l'app ha un pulsante **⟳** che controlla GitHub
Releases e scarica/installa il delta. Per pubblicare un aggiornamento:

1. Aumenta la versione in `package.json` (es. `"version": "1.0.1"`).
2. Commit + crea un tag e fai push:
   ```bash
   git add -A && git commit -m "v1.0.1"
   git tag v1.0.1 && git push origin main --tags
   ```
3. GitHub Actions (`.github/workflows/release.yml`) compila **Mac + Windows** sui
   rispettivi runner e pubblica gli installer come **Release** (con i file
   `latest-mac.yml` / `latest.yml` che alimentano l'auto-update).
4. Fatto. Gli utenti vedranno l'aggiornamento col pulsante **⟳** dentro l'app.

> Build locale (solo Mac, per provare): `npm run dist:mac` → `release/`.

## 🔄 Aggiornare la skill `/reel-ai` (semplicissimo)

Quando la skill cambia, il modo più semplice per l'utente è **ri-scaricare lo zip e
sostituire la cartella**:

1. Scarica `reel-ai-skill.zip` dal sito (sezione *Skill AI*).
2. Decomprimi e **sostituisci** la cartella in `~/.claude/skills/reel-ai/`.
3. Riavvia Claude Code.

Oppure, da terminale, **un solo comando** (sovrascrive la versione installata):
```bash
curl -sL https://atarantoandrea-png.github.io/video-ai/reel-ai-skill.zip -o /tmp/reel-ai.zip \
  && rm -rf ~/.claude/skills/reel-ai \
  && unzip -o /tmp/reel-ai.zip -d ~/.claude/skills/
```
(La skill è solo testo/markdown: aggiornarla è immediato e non tocca l'app.)

---

## 🛠️ Sviluppo

```bash
npm install
npm run dev        # avvia l'app in sviluppo (HMR)
npm run typecheck  # controllo tipi
npm test           # test (vitest)
npm run dist:mac   # crea il .dmg in release/
```

- **Stack:** Electron + electron-vite + React + TypeScript + Zustand + PixiJS + ffmpeg-static.
- **AI in-app:** SDK Anthropic nel *main process*; la chiave API resta cifrata
  (`safeStorage`) e non raggiunge mai il renderer.
- **Packaging:** `electron-builder` (config in `electron-builder.yml`), `asar` disattivato
  così i modelli face-api e i binari ffmpeg sono file reali. Auto-update via
  `electron-updater` ← GitHub Releases.

## 📦 Cosa NON è nel repo

`Key/` (chiave API), `samples/` (video di test), `node_modules/`, `out/`, `release/` —
vedi `.gitignore`.

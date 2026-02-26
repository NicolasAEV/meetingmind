# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start Vite + Electron dev server with HMR
npm run build      # Type-check and build production bundle (tsc -b && vite build)
npm run lint       # Run ESLint
npm run preview    # Preview production build
```

## Architecture

MeetingMind is an **Electron desktop app** for meeting transcription and AI analysis, built with React + TypeScript + Vite.

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop | Electron 40 + electron-builder |
| UI | React 19 + TypeScript |
| Build | Vite 8 + vite-plugin-electron |
| Speech-to-text | nodejs-whisper (local, offline) |
| NLP / LLM | @xenova/transformers + Ollama |
| Persistence | electron-store |

### Process Model

Electron splits execution into two processes:
- **Main process** (Node.js): System access — audio capture, file I/O, electron-store, whisper/ollama integration
- **Renderer process** (React): UI only — communicates with main via IPC (`ipcRenderer`/`ipcMain`)

All AI inference (Whisper, Ollama, Transformers.js) runs locally — no cloud APIs.

### Key Design Constraints

- TypeScript strict mode is enabled; no unused locals/parameters allowed.
- Module resolution is set to `bundler` (Vite handles imports, not Node's resolver).
- vite-plugin-electron bridges Vite's dev server with Electron's main/preload scripts.

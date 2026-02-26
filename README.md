# MeetingMind

Aplicación de escritorio para transcripción de reuniones en tiempo real y generación automática de notas técnicas con IA local.

> Todo el procesamiento ocurre localmente — sin APIs en la nube.

---

## Características

- **Transcripción en vivo** de micrófono y audio del sistema por separado
- **Detección automática** de consultas técnicas (`¿cómo funciona X?`, `vs`, `¿qué es...?`, keywords de tecnología)
- **Notas automáticas** generadas por Ollama al detectar una consulta técnica
- **Visualizador dual** de audio (micrófono en verde, sistema en morado) con barras de frecuencia
- **Tema de color configurable** (6 paletas) y **transparencia ajustable** en tiempo real
- Ventana siempre visible (always-on-top), sin marco, con barra de título personalizada

---

## Stack

| Capa | Tecnología |
|---|---|
| Desktop | Electron 40 |
| UI | React 19 + TypeScript (strict) |
| Build | Vite 8 + vite-plugin-electron 0.29 |
| Speech-to-text | @xenova/transformers 2.17 (Whisper, ONNX local) |
| LLM / Notas | Ollama (cliente HTTP puro, sin compilación) |
| Persistencia | electron-store 11 |
| Audio | Web Audio API + AudioWorklet (Blob URL) |

---

## Requisitos previos

| Requisito | Notas |
|---|---|
| Node.js 20+ | |
| Ollama | `ollama pull llama3.2` antes de abrir la app |
| Windows 11 | El audio del sistema (loopback) sólo funciona en Windows |

---

## Instalación y desarrollo

```bash
npm install
npm run dev
```

En la primera ejecución, la app descarga automáticamente el modelo Whisper seleccionado (~150 MB para `whisper-tiny`) y lo guarda en `%AppData%/MeetingMind/.models`.

### Otros comandos

```bash
npm run build   # Compilar para producción (tsc -b && vite build)
npm run lint    # ESLint
```

---

## Arquitectura

```
┌──────────────────────────────────────────────────┐
│  Renderer (React + Web Audio API)                │
│  ┌──────────┐  ┌────────────┐  ┌─────────────┐  │
│  │ Meeting  │  │ Components │  │   Hooks     │  │
│  │  Page    │  │ Transcript │  │ useAudio-   │  │
│  │          │  │ Notes      │  │ Recording   │  │
│  │          │  │ Visualizer │  │ useElectron │  │
│  │          │  │ Settings   │  │ Events      │  │
│  └────┬─────┘  └────────────┘  └─────────────┘  │
│       │  contextBridge (IPC)                     │
└───────┼──────────────────────────────────────────┘
        │
┌───────┼──────────────────────────────────────────┐
│  Main process (Node.js)                          │
│  ┌────┴──────┐  ┌────────────┐  ┌─────────────┐  │
│  │  audio.ts │  │transcriber │  │   llm.ts    │  │
│  │  loopback │  │  Whisper   │  │   Ollama    │  │
│  │  IPC      │  │  @xenova   │  │   notas     │  │
│  └───────────┘  └────────────┘  └─────────────┘  │
│  ┌──────────────────────────────────────────────┐ │
│  │  detector.ts — detección de consultas        │ │
│  │  main.ts     — ventana + settings IPC        │ │
│  └──────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

### Proceso principal vs renderer

| Tarea | Proceso |
|---|---|
| Captura de audio (getUserMedia / getDisplayMedia) | Renderer |
| AudioWorklet — buffering PCM | Renderer |
| Whisper — transcripción | Main (`electron/transcriber.ts`) |
| Detección de consultas técnicas | Main (`electron/detector.ts`) |
| Ollama — generación de notas | Main (`electron/llm.ts`) |
| electron-store — persistencia | Main (`electron/main.ts`) |
| Ventana frameless + opacidad | Main (`electron/main.ts`) |

### Audio del sistema en Windows

El proceso main registra un `setDisplayMediaRequestHandler` con `audio: 'loopback'`. Cuando el renderer llama a `getDisplayMedia()`, Electron intercepta la llamada y devuelve el mix de audio del sistema sin mostrar ningún diálogo al usuario.

---

## Estructura del proyecto

```
electron/                   ← proceso principal
  main.ts                   — BrowserWindow, IPC de ventana y settings
  preload.ts                — contextBridge: expone ElectronAPI al renderer
  audio.ts                  — setDisplayMediaRequestHandler (loopback Windows)
  transcriber.ts            — Whisper vía @xenova/transformers
  detector.ts               — detección de consultas técnicas (patrones + keywords)
  llm.ts                    — cliente Ollama, buffer de contexto de reunión

src/                        ← proceso renderer (React)
  App.tsx                   — shell: monta <div.shell> + <MeetingPage />
  App.css                   — variables CSS de tema, layout grid, animaciones

  pages/
    Meeting/                — vista principal de la reunión
      index.tsx

  components/               — cada componente en su propia carpeta
    TranscriptPanel/        — lista de segmentos transcritos en vivo
    NotesPanel/             — tarjetas de notas generadas por Ollama
    AudioVisualizer/        — canvas dual con barras de frecuencia (RAF)
    Settings/               — panel de configuración (tema, opacidad, modelos)

  hooks/
    useAudioRecording.ts    — gestiona captura de audio y devuelve analysers
    useElectronEvents.ts    — suscribe a todos los eventos IPC del main

  services/
    electron.ts             — export const electron = globalThis.electronAPI

  constants/
    themes.ts               — COLOR_THEMES (6 paletas)
    settings.ts             — DEFAULT_SETTINGS
    worklet.ts              — código fuente del AudioWorklet (Blob URL)
    index.ts                — barrel

  types/                    — una interfaz/tipo por archivo
    transcript.ts           — TranscriptEntry, TranscriptResult
    notes.ts                — Note
    settings.ts             — AppSettings, ColorTheme
    events.ts               — ModelProgressEvent
    electron-api.ts         — ElectronAPI + declaración Window
    index.ts                — barrel

  utils/
    audio.ts                — resampleTo16k, buildAudioGraph, releaseStream
```

---

## Canales IPC

| Canal | Dirección | Propósito |
|---|---|---|
| `transcribe:load-model` | R → M | Cargar modelo Whisper |
| `transcribe:is-ready` | R → M | Verificar si el modelo está listo |
| `transcribe:chunk` | R → M | Enviar Float32Array a 16 kHz |
| `transcribe:model-progress` | M → R | Progreso de descarga del modelo |
| `transcript:new` | M → R | Nueva entrada de transcripción |
| `note:generated` | M → R | Nota generada por Ollama |
| `llm:generate-note` | R → M | Generar nota manualmente |
| `settings:get` | R → M | Leer configuración (electron-store) |
| `settings:save` | R → M | Guardar configuración |
| `window:minimize/maximize/close` | R → M | Controles de ventana |
| `window:set-opacity` | R → M | Transparencia (0.4 – 1.0) |
| `window:set-always-on-top` | R → M | Ventana siempre visible |
| `audio:get-sources` | R → M | Listar fuentes de desktopCapturer |

---

## Configuración del usuario

| Ajuste | Descripción |
|---|---|
| **Color del tema** | 6 paletas (Midnight, Ocean, Forest, Sunset, Rose, Amber) — aplicadas vía CSS custom properties en tiempo real |
| **Opacidad** | 40 % – 100 % — llama a `win.setOpacity()` instantáneamente |
| **Siempre visible** | `win.setAlwaysOnTop('screen-saver')` |
| **Modelo Whisper** | tiny / base / small — descarga automática en primera selección |
| **Modelo Ollama** | cualquier modelo instalado localmente |
| **Idioma** | Español / English / Auto-detectar |

---

## Notas de compatibilidad

**`@xenova/transformers` en el proceso main**
Utiliza `onnxruntime-node` con binarios precompilados. Si aparece un error de ABI en la primera ejecución:

```bash
npx electron-rebuild -f -w @xenova/transformers
```

**Audio del sistema**
El loopback (`audio: 'loopback'`) es una extensión de Electron exclusiva de Windows. En macOS/Linux, sólo se captura el micrófono.

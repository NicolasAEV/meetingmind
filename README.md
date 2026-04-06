# MeetingMind

Aplicación de escritorio para transcripción de reuniones en tiempo real y generación automática de notas técnicas con múltiples proveedores de IA (Ollama, Gemini, OpenAI, Claude).

> Procesa audio localmente (Whisper) y genera notas usando el proveedor de tu elección.

---

## Características

- **Transcripción en vivo** de micrófono y audio del sistema por separado.
- **Soporte Multi-IA**: Elige entre Ollama (local), Google Gemini, OpenAI (GPT) o Anthropic (Claude).
- **Detección automática** de consultas técnicas (`¿cómo funciona X?`, `vs`, `¿qué es...?`, keywords de tecnología).
- **Notas automáticas** generadas al detectar una consulta técnica, usando el modelo configurado.
- **Visualizador dual** de audio (micrófono en verde, sistema en morado) con barras de frecuencia.
- **Tema de color configurable** (6 paletas) y **transparencia ajustable** en tiempo real.
- **Ventana always-on-top**, sin marco, con barra de título personalizada.

---

## Stack

| Capa | Tecnología |
|---|---|
| Desktop | Electron 40 |
| UI | React 19 + TypeScript (strict) |
| Build | Vite 8 + vite-plugin-electron 0.29 |
| Speech-to-text | @xenova/transformers 2.17 (Whisper, ONNX local) |
| AI / Notas | Strategy Pattern: Ollama, Gemini SDK, OpenAI SDK, Anthropic SDK |
| Persistencia | electron-store 11 |
| Audio | Web Audio API + AudioWorklet |

---

## Requisitos previos

| Requisito | Notas |
|---|---|
| Node.js 20+ | |
| Ollama | (Opcional) Si usas modelos locales |
| API Keys | Necesarias si usas Gemini, OpenAI o Claude |
| Windows 11 | El audio del sistema (loopback) sólo funciona en Windows |

---

## Instalación y desarrollo

```bash
npm install
npm run dev
```

En la primera ejecución, la app descarga el modelo Whisper seleccionado (~150 MB para `whisper-tiny`) y lo guarda en `%AppData%/MeetingMind/.models`.

### Otros comandos

```bash
npm run build   # Compilar para producción (tsc -b && vite build)
npm run lint    # ESLint
```

---

## Arquitectura

La aplicación sigue una arquitectura modular en el proceso principal, separando los puntos de entrada de los servicios de negocio.

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
│  ┌───────────────┐ ┌───────────────────────────┐ │
│  │ main/index.ts │ │ services/                 │ │
│  │ lifecycle     │ │ ├─ transcription/         │ │
│  │ IPC setup     │ │ │   engine.ts             │ │
│  └───────────────┘ │ │   detector.ts           │ │
│                    │ ├─ ai/                    │ │
│                    │ │   orchestrator.ts       │ │
│                    │ │   strategies/ (Factory) │ │
│                    │ └─ audio/                 │ │
│                    │     index.ts (Loopback)   │ │
│                    └───────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

---

## Estructura del proyecto

```
electron/                   ← Proceso principal (Modular)
  main/
    index.ts                — Ciclo de vida y handlers IPC
  preload/
    index.ts                — Puente IPC (contextBridge)
  services/
    ai/                     — Orquestación LLM (Strategy Pattern)
      orchestrator.ts
      strategies/           — Proveedores (Ollama, Gemini, OpenAI, Claude)
    transcription/          — Motor de Whisper
      engine.ts
      detector.ts
    audio/                  — Captura loopback en Windows

src/                        ← Proceso renderer (React)
  App.tsx                   — Shell principal
  pages/
    Meeting/                — Vista principal de la reunión
  components/
    TranscriptPanel/        — Transcripción en vivo
    NotesPanel/             — Notas generadas por IA
    AudioVisualizer/        — Canvas frecuencia dual
    Settings/               — Configuración (IA, tema, modelos)
```

---

## Configuración de IA

El sistema utiliza el **Strategy Pattern** para permitir flexibilidad máxima:

1. **Ollama**: Requiere tener el servicio de Ollama corriendo localmente.
2. **Gemini**: Requiere una llave gratuita de Google AI Studio.
3. **OpenAI**: Utiliza llaves de API estándar compatibles con modelos como `gpt-4o-mini`.
4. **Claude**: Soporte nativo para modelos de Anthropic.

> [!TIP]
> Configura tus API Keys en la pestaña de **Ajustes > IA** dentro de la aplicación.

---

## Canales IPC Principales

| Canal | Dirección | Propósito |
|---|---|---|
| `transcribe:load-model` | R → M | Cargar modelo Whisper |

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

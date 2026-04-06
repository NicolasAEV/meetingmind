/**
 * Audio IPC — main process side.
 *
 * Responsibilities:
 *  1. Configure setDisplayMediaRequestHandler so Windows loopback audio
 *     (system sound) is captured in the renderer WITHOUT a pick-a-window dialog.
 *  2. Expose desktopCapturer source list to renderer (optional helper).
 *
 * Actual audio capture (Web Audio API, AudioWorklet) runs entirely in the
 * renderer process.  The main process is only needed for the loopback trick
 * on Windows.
 */
import { ipcMain, desktopCapturer, session } from 'electron'

export function setupAudioIPC(): void {
  // ── Windows loopback audio ─────────────────────────────────────────────────
  // Intercept getDisplayMedia() calls from the renderer.
  // Returning { video: source, audio: 'loopback' } makes Electron on Windows
  // capture the system audio mix without any dialog.
  session.defaultSession.setDisplayMediaRequestHandler(
    (_request, callback) => {
      desktopCapturer.getSources({ types: ['screen'] })
        .then((sources) => {
          if (sources.length > 0) {
            // 'loopback' is a Windows-only Electron extension that captures the
            // system audio output (WASAPI loopback).
            callback({ video: sources[0]!, audio: 'loopback' as 'loopback' })
          } else {
            callback({})
          }
        })
        .catch(() => callback({}))
    },
    { useSystemPicker: false },
  )

  // ── Optional: let renderer list available screen sources ──────────────────
  ipcMain.handle('audio:get-sources', async () => {
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 0, height: 0 },
    })
    return sources.map(s => ({ id: s.id, name: s.name }))
  })
}

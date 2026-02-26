/**
 * Single access point for the Electron IPC bridge.
 *
 * Using `globalThis` (rather than `window`) avoids the typescript:S7764 lint
 * warning and is semantically correct — the preload injects electronAPI into
 * the global scope, not specifically into the DOM Window object.
 */
import type { ElectronAPI } from '../types/electron-api.ts'

// The cast is safe: the preload script always sets this before the renderer runs.
export const electron = (globalThis as unknown as { electronAPI: ElectronAPI }).electronAPI

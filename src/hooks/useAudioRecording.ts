import { useState, useRef } from 'react'
import { buildAudioGraph, releaseStream, dropVideoTracks } from '../utils/audio.ts'

export interface AudioRecordingState {
  isRecording:    boolean
  micAnalyser:    AnalyserNode | null
  systemAnalyser: AnalyserNode | null
  start:          () => Promise<void>
  stop:           () => void
}

type ChunkCallback = (chunk: Float32Array, rate: number, source: 'mic' | 'system') => void

/**
 * Manages microphone + system-audio capture with AudioWorklet nodes.
 * The caller supplies `onChunk` to receive resampled PCM frames.
 */
export function useAudioRecording(onChunk: ChunkCallback): AudioRecordingState {
  const [isRecording,    setIsRecording]    = useState(false)
  const [micAnalyser,    setMicAnalyser]    = useState<AnalyserNode | null>(null)
  const [systemAnalyser, setSystemAnalyser] = useState<AnalyserNode | null>(null)

  const micCtxRef    = useRef<AudioContext | null>(null)
  const sysCtxRef    = useRef<AudioContext | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const sysStreamRef = useRef<MediaStream | null>(null)

  async function start(): Promise<void> {
    // ── Microphone ─────────────────────────────────────────────────────────
    const micStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 48000 },
      video: false,
    })
    micStreamRef.current = micStream

    const { ctx: mCtx, analyser: mAn } = await buildAudioGraph(
      micStream,
      (chunk, rate) => onChunk(chunk, rate, 'mic'),
    )
    micCtxRef.current = mCtx
    setMicAnalyser(mAn)

    // ── System audio (Windows loopback via Electron) ───────────────────────
    try {
      const sysStream = await navigator.mediaDevices.getDisplayMedia({
        audio: true,
        video: true,   // required by spec; video tracks are dropped immediately
      })
      dropVideoTracks(sysStream)
      sysStreamRef.current = sysStream

      const { ctx: sCtx, analyser: sAn } = await buildAudioGraph(
        sysStream,
        (chunk, rate) => onChunk(chunk, rate, 'system'),
      )
      sysCtxRef.current = sCtx
      setSystemAnalyser(sAn)
    } catch {
      console.warn('[useAudioRecording] System audio unavailable — mic only')
    }

    setIsRecording(true)
  }

  function stop(): void {
    releaseStream(micStreamRef.current)
    releaseStream(sysStreamRef.current)
    micCtxRef.current?.close()
    sysCtxRef.current?.close()
    micStreamRef.current  = null
    sysStreamRef.current  = null
    micCtxRef.current     = null
    sysCtxRef.current     = null
    setMicAnalyser(null)
    setSystemAnalyser(null)
    setIsRecording(false)
  }

  return { isRecording, micAnalyser, systemAnalyser, start, stop }
}

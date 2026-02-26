/**
 * Dual audio visualizer — microphone (green) + system audio (purple).
 *
 * Receives AnalyserNodes created by the App component after capturing the
 * respective MediaStreams.  Uses requestAnimationFrame to draw frequency-domain
 * bar charts on two <canvas> elements.
 */
import { useEffect, useRef } from 'react'

interface Props {
  micAnalyser:    AnalyserNode | null
  systemAnalyser: AnalyserNode | null
  isRecording:    boolean
}

function drawBars(
  ctx:      CanvasRenderingContext2D,
  analyser: AnalyserNode | null,
  color:    string,
  active:   boolean,
): void {
  const { width, height } = ctx.canvas
  ctx.clearRect(0, 0, width, height)

  if (!analyser || !active) {
    // Draw flat idle line
    ctx.fillStyle = color + '33'
    ctx.fillRect(0, height / 2 - 1, width, 2)
    return
  }

  const bins = analyser.frequencyBinCount          // fftSize / 2
  const data = new Uint8Array(bins)
  analyser.getByteFrequencyData(data)

  const BAR_COUNT  = 64
  const step       = Math.floor(bins / BAR_COUNT)
  const barW       = width / BAR_COUNT - 1
  const maxH       = height

  for (let i = 0; i < BAR_COUNT; i++) {
    // Average a few bins per bar for smoother look
    let sum = 0
    for (let j = 0; j < step; j++) {
      sum += data[i * step + j] ?? 0
    }
    const avg     = sum / step
    const barH    = (avg / 255) * maxH
    const x       = i * (barW + 1)
    const y       = height - barH

    // Gradient: brighter at top
    const gradient = ctx.createLinearGradient(0, y, 0, height)
    gradient.addColorStop(0, color + 'ee')
    gradient.addColorStop(1, color + '44')

    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.roundRect(x, y, barW, barH, 2)
    ctx.fill()
  }
}

function useAnimationLoop(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  analyser:  AnalyserNode | null,
  color:     string,
  active:    boolean,
): void {
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let rafId: number
    const frame = () => {
      // Sync canvas pixel size with CSS size
      const { offsetWidth, offsetHeight } = canvas
      if (canvas.width !== offsetWidth || canvas.height !== offsetHeight) {
        canvas.width  = offsetWidth
        canvas.height = offsetHeight
      }
      drawBars(ctx, analyser, color, active)
      rafId = requestAnimationFrame(frame)
    }
    rafId = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(rafId)
  }, [canvasRef, analyser, color, active])
}

export default function AudioVisualizer({ micAnalyser, systemAnalyser, isRecording }: Props) {
  const micRef = useRef<HTMLCanvasElement>(null)
  const sysRef = useRef<HTMLCanvasElement>(null)

  useAnimationLoop(micRef, micAnalyser,    '#00e676', isRecording)
  useAnimationLoop(sysRef, systemAnalyser, '#b388ff', isRecording)

  return (
    <div className="viz-bar">
      <div className="viz-panel">
        <div className="viz-label mic">
          <span>●</span> Micrófono
        </div>
        <canvas ref={micRef} className="viz-canvas" />
      </div>

      <div className="viz-panel">
        <div className="viz-label sys">
          <span>●</span> Audio del sistema
        </div>
        <canvas ref={sysRef} className="viz-canvas" />
      </div>
    </div>
  )
}

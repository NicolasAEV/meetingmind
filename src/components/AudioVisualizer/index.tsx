import './styles.css'
import { useEffect, useRef, useState } from 'react'

interface Props {
  readonly micAnalyser:    AnalyserNode | null
  readonly systemAnalyser: AnalyserNode | null
  readonly isRecording:    boolean
}

function calcDb(data: Uint8Array): number {
  let sum = 0
  for (const sample of data) sum += (sample / 255) ** 2
  const rms = Math.sqrt(sum / data.length)
  return Math.max(-60, Math.round(20 * Math.log10(rms + 1e-9)))
}

function drawBars(
  ctx:      CanvasRenderingContext2D,
  analyser: AnalyserNode | null,
  color:    string,
  active:   boolean,
): number {
  const { width, height } = ctx.canvas
  ctx.clearRect(0, 0, width, height)

  if (!analyser || !active) {
    ctx.fillStyle = color + '33'
    ctx.fillRect(0, height / 2 - 1, width, 2)
    return -60
  }

  const bins = analyser.frequencyBinCount
  const data = new Uint8Array(bins)
  analyser.getByteFrequencyData(data)

  const BAR_COUNT = 64
  const step      = Math.floor(bins / BAR_COUNT)
  const barW      = width / BAR_COUNT - 1

  for (let i = 0; i < BAR_COUNT; i++) {
    let sum = 0
    for (let j = 0; j < step; j++) sum += data[i * step + j] ?? 0
    const barH = (sum / step / 255) * height
    const x    = i * (barW + 1)
    const y    = height - barH

    const gradient = ctx.createLinearGradient(0, y, 0, height)
    gradient.addColorStop(0, color + 'ee')
    gradient.addColorStop(1, color + '44')

    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.roundRect(x, y, barW, barH, 2)
    ctx.fill()
  }

  return calcDb(data)
}

function useAnimationLoop(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  analyser:  AnalyserNode | null,
  color:     string,
  active:    boolean,
  onDb:      (db: number) => void,
): void {
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let rafId: number
    const frame = () => {
      const { offsetWidth, offsetHeight } = canvas
      if (canvas.width !== offsetWidth || canvas.height !== offsetHeight) {
        canvas.width  = offsetWidth
        canvas.height = offsetHeight
      }
      const db = drawBars(ctx, analyser, color, active)
      onDb(db)
      rafId = requestAnimationFrame(frame)
    }
    rafId = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(rafId)
  }, [canvasRef, analyser, color, active, onDb])
}

export default function AudioVisualizer({ micAnalyser, systemAnalyser, isRecording }: Props) {
  const micRef = useRef<HTMLCanvasElement>(null)
  const sysRef = useRef<HTMLCanvasElement>(null)
  const [micDb, setMicDb] = useState(-60)
  const [sysDb, setSysDb] = useState(-60)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const onMicDb = (db: number) => setMicDb(db)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const onSysDb = (db: number) => setSysDb(db)

  useAnimationLoop(micRef, micAnalyser,    '#00e676', isRecording, onMicDb)
  useAnimationLoop(sysRef, systemAnalyser, '#b388ff', isRecording, onSysDb)

  return (
    <div className="viz-bar">
      <div className="viz-panel">
        <div className="viz-label mic">
          <span className="viz-label-left">
            <span>●</span> MICRÓFONO
          </span>
          <span className="viz-db">{isRecording ? `${micDb}dB` : '—'}</span>
        </div>
        <canvas ref={micRef} className="viz-canvas" />
      </div>
      <div className="viz-panel">
        <div className="viz-label sys">
          <span className="viz-label-left">
            <span>●</span> AUDIO DEL SISTEMA
          </span>
          <span className="viz-db">{isRecording ? `${sysDb}dB` : '—'}</span>
        </div>
        <canvas ref={sysRef} className="viz-canvas" />
      </div>
    </div>
  )
}

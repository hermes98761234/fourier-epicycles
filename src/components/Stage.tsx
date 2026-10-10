import { useEffect, useRef, useState } from 'react'
import type { Pt, Term } from '../lib/fourier'
import { drawScene, readColors, type Display } from '../render'
import type { T } from '../i18n'

interface Props {
  terms: Term[]
  m: number
  curve: Float64Array
  original: Pt[] | null
  display: Display
  period: number
  /** Called with a finished stroke in scene units (the shape fits roughly in [-1, 1]). */
  onStroke: (pts: Pt[]) => void
  t: T
}

const SCENE_SCALE = 0.42

export default function Stage(props: Props) {
  const { t } = props
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const sliderRef = useRef<HTMLInputElement>(null)
  const latest = useRef(props)
  useEffect(() => {
    latest.current = props
    dirty.current = true
  })
  const pos = useRef(0)
  const strokeRef = useRef<Pt[] | null>(null)
  const playingRef = useRef(true)
  const dirty = useRef(true)
  const [playing, setPlaying] = useState(true)
  const [dims, setDims] = useState({ w: 600, h: 600 })

  useEffect(() => {
    playingRef.current = playing
  }, [playing])

  useEffect(() => {
    const el = wrapRef.current!
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect()
      setDims({ w: Math.max(100, Math.round(r.width)), h: Math.max(100, Math.round(r.height)) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current!
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(dims.w * dpr)
    canvas.height = Math.round(dims.h * dpr)
    dirty.current = true
  }, [dims])

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      const p = latest.current
      if (playingRef.current && !strokeRef.current) {
        pos.current = (pos.current + dt / p.period) % 1
        dirty.current = true
      }
      if (dirty.current) {
        dirty.current = false
        const canvas = canvasRef.current!
        const ctx = canvas.getContext('2d')!
        const dpr = canvas.width / (canvas.clientWidth || 1)
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        drawScene(
          ctx,
          canvas.clientWidth,
          canvas.clientHeight,
          { terms: p.terms, m: p.m, t: pos.current, curve: p.curve, original: p.original, stroke: strokeRef.current, display: p.display },
          readColors(document.documentElement),
        )
        if (sliderRef.current) sliderRef.current.value = String(Math.round(pos.current * 1000))
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  const local = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  const down = (e: React.PointerEvent) => {
    canvasRef.current!.setPointerCapture(e.pointerId)
    strokeRef.current = [local(e)]
    dirty.current = true
  }
  const move = (e: React.PointerEvent) => {
    const s = strokeRef.current
    if (!s) return
    const p = local(e)
    const q = s[s.length - 1]
    if (Math.hypot(p.x - q.x, p.y - q.y) >= 2) s.push(p)
    dirty.current = true
  }
  const up = () => {
    const s = strokeRef.current
    strokeRef.current = null
    dirty.current = true
    if (!s) return
    const c = canvasRef.current!
    const sc = Math.min(c.clientWidth, c.clientHeight) * SCENE_SCALE
    props.onStroke(s.map((p) => ({ x: (p.x - c.clientWidth / 2) / sc, y: (p.y - c.clientHeight / 2) / sc })))
  }

  return (
    <div className="stage">
      <div className="stage-canvas" ref={wrapRef}>
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={t('Fourier epicycle canvas. Draw a shape here.')}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
        />
      </div>
      <div className="row">
        <button onClick={() => setPlaying((p) => !p)}>{playing ? t('Pause') : t('Play')}</button>
        <input
          ref={sliderRef}
          type="range"
          min={0}
          max={999}
          defaultValue={0}
          aria-label={t('Position along the path')}
          style={{ flex: 1, minWidth: 120 }}
          onChange={(e) => {
            pos.current = +e.target.value / 1000
            dirty.current = true
            setPlaying(false)
          }}
        />
      </div>
    </div>
  )
}

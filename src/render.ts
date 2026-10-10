import { chain, type Pt, type Term } from './lib/fourier'

export interface Colors {
  bg: string
  fg: string
  muted: string
  accent: string
  line: string
}

export interface Display {
  circles: boolean
  vectors: boolean
  trail: boolean
  original: boolean
  full: boolean
}

export interface View {
  terms: Term[]
  m: number
  /** Position in the period, 0..1. */
  t: number
  /** Reconstructed curve of the first m arms (interleaved x,y). */
  curve: Float64Array
  /** Original resampled path, or null. */
  original: Pt[] | null
  /** Stroke being drawn by the user, in canvas pixels. */
  stroke: Pt[] | null
  display: Display
}

export function readColors(el: Element): Colors {
  const cs = getComputedStyle(el)
  const g = (n: string) => cs.getPropertyValue(n).trim()
  return { bg: g('--chart-bg'), fg: g('--fg'), muted: g('--chart-fg'), accent: g('--accent'), line: g('--ref-line') }
}

export function drawScene(ctx: CanvasRenderingContext2D, w: number, h: number, v: View, c: Colors): void {
  ctx.fillStyle = c.bg
  ctx.fillRect(0, 0, w, h)
  const s = Math.min(w, h) * 0.42
  const ox = w / 2
  const oy = h / 2
  const X = (x: number) => ox + x * s
  const Y = (y: number) => oy + y * s
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  if (v.stroke && v.stroke.length > 1) {
    ctx.strokeStyle = c.accent
    ctx.lineWidth = 2.5
    ctx.beginPath()
    v.stroke.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)))
    ctx.stroke()
    return
  }

  if (v.display.original && v.original) {
    ctx.strokeStyle = c.muted
    ctx.globalAlpha = 0.35
    ctx.lineWidth = 1.5
    ctx.beginPath()
    v.original.forEach((p, i) => (i ? ctx.lineTo(X(p.x), Y(p.y)) : ctx.moveTo(X(p.x), Y(p.y))))
    ctx.closePath()
    ctx.stroke()
    ctx.globalAlpha = 1
  }

  const count = v.curve.length / 2
  if (v.display.full && count) {
    ctx.strokeStyle = c.accent
    ctx.globalAlpha = 0.25
    ctx.lineWidth = 1.5
    ctx.beginPath()
    for (let j = 0; j < count; j++) (j ? ctx.lineTo : ctx.moveTo).call(ctx, X(v.curve[2 * j]), Y(v.curve[2 * j + 1]))
    ctx.closePath()
    ctx.stroke()
    ctx.globalAlpha = 1
  }

  const joints = chain(v.terms, v.m, v.t)

  if (v.display.circles) {
    ctx.strokeStyle = c.muted
    ctx.globalAlpha = 0.45
    ctx.lineWidth = 1
    for (let i = 0; i + 1 < joints.length; i++) {
      const r = Math.hypot(joints[i + 1].x - joints[i].x, joints[i + 1].y - joints[i].y) * s
      if (r < 0.6) continue
      ctx.beginPath()
      ctx.arc(X(joints[i].x), Y(joints[i].y), r, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }
  if (v.display.vectors) {
    ctx.strokeStyle = c.fg
    ctx.globalAlpha = 0.7
    ctx.lineWidth = 1
    ctx.beginPath()
    joints.forEach((p, i) => (i ? ctx.lineTo(X(p.x), Y(p.y)) : ctx.moveTo(X(p.x), Y(p.y))))
    ctx.stroke()
    ctx.globalAlpha = 1
  }

  if (v.display.trail && count) {
    const upto = Math.floor(v.t * count)
    ctx.strokeStyle = c.accent
    ctx.lineWidth = 2.5
    ctx.beginPath()
    for (let j = 0; j <= upto; j++) (j ? ctx.lineTo : ctx.moveTo).call(ctx, X(v.curve[2 * j]), Y(v.curve[2 * j + 1]))
    const tip = joints[joints.length - 1]
    ctx.lineTo(X(tip.x), Y(tip.y))
    ctx.stroke()
  }
  const tip = joints[joints.length - 1]
  ctx.fillStyle = c.line
  ctx.beginPath()
  ctx.arc(X(tip.x), Y(tip.y), 4, 0, Math.PI * 2)
  ctx.fill()
}

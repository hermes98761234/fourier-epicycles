/** Complex-plane Fourier series of a closed path (epicycles). Points are x + i·y. */

export interface Pt {
  x: number
  y: number
}

/** One rotating arm: c·e^(2πi·k·t), c = re + i·im, amp = |c|, phase = arg c. */
export interface Term {
  k: number
  re: number
  im: number
  amp: number
  phase: number
}

export function pathLength(pts: Pt[], closed = true): number {
  let len = 0
  const n = pts.length
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const a = pts[i]
    const b = pts[(i + 1) % n]
    len += Math.hypot(b.x - a.x, b.y - a.y)
  }
  return len
}

/** Resamples a closed polyline into n points equally spaced by arc length (the closing segment is included). */
export function resampleClosed(pts: Pt[], n: number): Pt[] {
  const m = pts.length
  if (m === 0) return []
  if (m === 1) return Array.from({ length: n }, () => ({ ...pts[0] }))
  const total = pathLength(pts)
  if (total === 0) return Array.from({ length: n }, () => ({ ...pts[0] }))
  const out: Pt[] = []
  let seg = 0
  let segStart = 0
  let segLen = Math.hypot(pts[1 % m].x - pts[0].x, pts[1 % m].y - pts[0].y)
  for (let i = 0; i < n; i++) {
    const target = (i / n) * total
    while (seg < m - 1 && segStart + segLen < target) {
      segStart += segLen
      seg++
      const a = pts[seg]
      const b = pts[(seg + 1) % m]
      segLen = Math.hypot(b.x - a.x, b.y - a.y)
    }
    const a = pts[seg]
    const b = pts[(seg + 1) % m]
    const f = segLen > 0 ? Math.min(1, Math.max(0, (target - segStart) / segLen)) : 0
    out.push({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f })
  }
  return out
}

/** Centres the bounding box on the origin and scales so the longer side spans [-1, 1]. */
export function normalizePoints(pts: Pt[]): Pt[] {
  if (pts.length === 0) return []
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
  for (const p of pts) {
    if (p.x < x0) x0 = p.x
    if (p.x > x1) x1 = p.x
    if (p.y < y0) y0 = p.y
    if (p.y > y1) y1 = p.y
  }
  const cx = (x0 + x1) / 2
  const cy = (y0 + y1) / 2
  const half = Math.max(x1 - x0, y1 - y0) / 2 || 1
  return pts.map((p) => ({ x: (p.x - cx) / half, y: (p.y - cy) / half }))
}

/**
 * Discrete Fourier transform of N equally spaced samples of a closed curve.
 * Returns all N terms: the DC term (k = 0) first, then the rest by decreasing amplitude.
 */
export function dft(pts: Pt[]): Term[] {
  const n = pts.length
  if (n === 0) return []
  const cos = new Float64Array(n)
  const sin = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    cos[i] = Math.cos((2 * Math.PI * i) / n)
    sin[i] = Math.sin((2 * Math.PI * i) / n)
  }
  const terms: Term[] = []
  for (let m = 0; m < n; m++) {
    let re = 0
    let im = 0
    for (let j = 0; j < n; j++) {
      const idx = (m * j) % n
      // z · e^(-iθ) = (x + iy)(cos θ - i sin θ)
      re += pts[j].x * cos[idx] + pts[j].y * sin[idx]
      im += pts[j].y * cos[idx] - pts[j].x * sin[idx]
    }
    re /= n
    im /= n
    const k = m < n / 2 ? m : m - n
    terms.push({ k, re, im, amp: Math.hypot(re, im), phase: Math.atan2(im, re) })
  }
  const dc = terms.find((t) => t.k === 0)!
  const rest = terms.filter((t) => t.k !== 0)
  rest.sort((a, b) => b.amp - a.amp || Math.abs(a.k) - Math.abs(b.k) || b.k - a.k)
  return [dc, ...rest]
}

/** Position of the tip of the first `m` arms at time t (one period = t from 0 to 1). */
export function evalTerms(terms: Term[], m: number, t: number): Pt {
  let x = 0
  let y = 0
  const count = Math.min(m, terms.length)
  for (let i = 0; i < count; i++) {
    const c = terms[i]
    const th = 2 * Math.PI * c.k * t
    const cs = Math.cos(th)
    const sn = Math.sin(th)
    x += c.re * cs - c.im * sn
    y += c.re * sn + c.im * cs
  }
  return { x, y }
}

/** Joints of the epicycle chain: start (0,0) then the tip after each of the first m arms. */
export function chain(terms: Term[], m: number, t: number): Pt[] {
  const out: Pt[] = [{ x: 0, y: 0 }]
  let x = 0
  let y = 0
  const count = Math.min(m, terms.length)
  for (let i = 0; i < count; i++) {
    const c = terms[i]
    const th = 2 * Math.PI * c.k * t
    const cs = Math.cos(th)
    const sn = Math.sin(th)
    x += c.re * cs - c.im * sn
    y += c.re * sn + c.im * cs
    out.push({ x, y })
  }
  return out
}

/** The closed curve drawn by the first m arms, as interleaved x,y over one period. */
export function reconstruct(terms: Term[], m: number, count: number): Float64Array {
  const out = new Float64Array(count * 2)
  for (let j = 0; j < count; j++) {
    const p = evalTerms(terms, m, j / count)
    out[2 * j] = p.x
    out[2 * j + 1] = p.y
  }
  return out
}

/** RMS distance between the original samples and the m-arm curve at those samples (Parseval: sqrt of omitted energy). */
export function rmsError(terms: Term[], m: number): number {
  let e = 0
  for (let i = Math.min(m, terms.length); i < terms.length; i++) e += terms[i].amp * terms[i].amp
  return Math.sqrt(e)
}

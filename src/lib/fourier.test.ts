import { describe, expect, it } from 'vitest'
import { chain, dft, evalTerms, normalizePoints, pathLength, reconstruct, resampleClosed, rmsError, type Pt } from './fourier'
import { PRESETS } from './presets'

const circle = (n: number, r = 1): Pt[] => Array.from({ length: n }, (_, i) => ({ x: r * Math.cos((2 * Math.PI * i) / n), y: r * Math.sin((2 * Math.PI * i) / n) }))

describe('dft', () => {
  it('a unit circle traversed once is the single term c1 = 1', () => {
    const terms = dft(circle(64))
    const c1 = terms.find((t) => t.k === 1)!
    expect(c1.re).toBeCloseTo(1, 12)
    expect(c1.im).toBeCloseTo(0, 12)
    expect(terms.filter((t) => t.k !== 1).every((t) => t.amp < 1e-12)).toBe(true)
  })
  it('a circle traversed clockwise is k = -1', () => {
    const pts = circle(32).map((p) => ({ x: p.x, y: -p.y }))
    const t = dft(pts).find((x) => x.k === -1)!
    expect(t.amp).toBeCloseTo(1, 12)
  })
  it('a constant offset is the DC term, which comes first', () => {
    const pts = circle(16).map((p) => ({ x: p.x + 3, y: p.y - 2 }))
    const terms = dft(pts)
    expect(terms[0].k).toBe(0)
    expect(terms[0].re).toBeCloseTo(3, 12)
    expect(terms[0].im).toBeCloseTo(-2, 12)
  })
  it('amplitude and phase of c·e^(iθ)·e^(2πit) are recovered', () => {
    const r = 2.5
    const th = 0.7
    const pts = circle(40).map((p) => ({ x: r * (p.x * Math.cos(th) - p.y * Math.sin(th)), y: r * (p.x * Math.sin(th) + p.y * Math.cos(th)) }))
    const t = dft(pts)[1]
    expect(t.k).toBe(1)
    expect(t.amp).toBeCloseTo(r, 12)
    expect(t.phase).toBeCloseTo(th, 12)
  })
  it('all terms reproduce the sample points exactly', () => {
    const pts = resampleClosed(PRESETS[1].points(), 128)
    const terms = dft(pts)
    for (const j of [0, 5, 31, 77, 127]) {
      const p = evalTerms(terms, terms.length, j / 128)
      expect(p.x).toBeCloseTo(pts[j].x, 9)
      expect(p.y).toBeCloseTo(pts[j].y, 9)
    }
  })
  it('rms error equals the true error (Parseval) and never grows with more terms', () => {
    const pts = resampleClosed(PRESETS[1].points(), 128)
    const terms = dft(pts)
    for (const m of [1, 3, 10]) {
      let s = 0
      for (let j = 0; j < 128; j++) {
        const p = evalTerms(terms, m, j / 128)
        s += (p.x - pts[j].x) ** 2 + (p.y - pts[j].y) ** 2
      }
      expect(rmsError(terms, m)).toBeCloseTo(Math.sqrt(s / 128), 9)
    }
    let prev = Infinity
    for (let m = 1; m <= 128; m++) {
      const e = rmsError(terms, m)
      expect(e).toBeLessThanOrEqual(prev + 1e-12)
      prev = e
    }
    expect(rmsError(terms, 128)).toBeLessThan(1e-9)
  })
  it('the first m terms after DC are the largest ones', () => {
    const terms = dft(resampleClosed(PRESETS[0].points(), 128))
    for (let i = 2; i < terms.length; i++) expect(terms[i].amp).toBeLessThanOrEqual(terms[i - 1].amp + 1e-15)
  })
})

describe('chain and reconstruct', () => {
  it('chain ends at evalTerms and has m+1 joints', () => {
    const terms = dft(resampleClosed(PRESETS[2].points(), 64))
    const c = chain(terms, 7, 0.37)
    const p = evalTerms(terms, 7, 0.37)
    expect(c).toHaveLength(8)
    expect(c[7].x).toBeCloseTo(p.x, 12)
    expect(c[7].y).toBeCloseTo(p.y, 12)
  })
  it('reconstruct samples one period', () => {
    const terms = dft(circle(32))
    const r = reconstruct(terms, 2, 4)
    expect(r).toHaveLength(8)
    expect(r[0]).toBeCloseTo(1, 12)
    expect(r[2]).toBeCloseTo(0, 12)
    expect(r[3]).toBeCloseTo(1, 12)
  })
})

describe('resampleClosed / normalizePoints', () => {
  it('spreads points evenly along a square including the closing edge', () => {
    const sq = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }]
    const r = resampleClosed(sq, 16)
    expect(r[0]).toEqual({ x: 0, y: 0 })
    expect(r[1].x).toBeCloseTo(1, 12)
    expect(r[4].x).toBeCloseTo(4, 12)
    expect(r[12].y).toBeCloseTo(4, 12)
    expect(r[15].y).toBeCloseTo(1, 12)
    expect(pathLength(r)).toBeCloseTo(16, 6)
  })
  it('normalizes to [-1, 1] keeping the aspect ratio', () => {
    const n = normalizePoints([{ x: 10, y: 0 }, { x: 30, y: 10 }, { x: 20, y: 5 }])
    expect(Math.max(...n.map((p) => Math.abs(p.x)))).toBeCloseTo(1, 12)
    expect(Math.max(...n.map((p) => Math.abs(p.y)))).toBeCloseTo(0.5, 12)
  })
})

/** Median-cut colour quantisation for GIF palettes. */

/** `rgb` is flat r,g,b bytes. Returns up to maxColors palette entries as flat r,g,b. */
export function medianCut(rgb: Uint8Array, maxColors: number): Uint8Array {
  const count = Math.floor(rgb.length / 3)
  if (count === 0) return new Uint8Array(maxColors > 1 ? 6 : 3)
  // Count unique colours so flat art keeps its exact colours.
  const hist = new Map<number, number>()
  for (let i = 0; i < count; i++) {
    const key = (rgb[3 * i] << 16) | (rgb[3 * i + 1] << 8) | rgb[3 * i + 2]
    hist.set(key, (hist.get(key) ?? 0) + 1)
  }
  type Box = { keys: number[] }
  const channel = (k: number, c: number) => (k >> (16 - 8 * c)) & 255
  let boxes: Box[] = [{ keys: [...hist.keys()] }]
  const range = (b: Box) => {
    let best = 0
    let bestR = -1
    for (let c = 0; c < 3; c++) {
      let lo = 255, hi = 0
      for (const k of b.keys) {
        const v = channel(k, c)
        if (v < lo) lo = v
        if (v > hi) hi = v
      }
      if (hi - lo > bestR) {
        bestR = hi - lo
        best = c
      }
    }
    return { c: best, r: bestR }
  }
  while (boxes.length < maxColors) {
    let pick = -1
    let pickScore = 0
    boxes.forEach((b, i) => {
      if (b.keys.length < 2) return
      const score = range(b).r * Math.sqrt(b.keys.reduce((s, k) => s + hist.get(k)!, 0))
      if (score > pickScore) {
        pickScore = score
        pick = i
      }
    })
    if (pick < 0) break
    const b = boxes[pick]
    const { c } = range(b)
    b.keys.sort((x, y) => channel(x, c) - channel(y, c))
    const total = b.keys.reduce((s, k) => s + hist.get(k)!, 0)
    let acc = 0
    let cut = 1
    for (let i = 0; i < b.keys.length - 1; i++) {
      acc += hist.get(b.keys[i])!
      cut = i + 1
      if (acc >= total / 2) break
    }
    boxes.splice(pick, 1, { keys: b.keys.slice(0, cut) }, { keys: b.keys.slice(cut) })
  }
  boxes = boxes.filter((b) => b.keys.length > 0)
  const out = new Uint8Array(boxes.length * 3)
  boxes.forEach((b, i) => {
    let r = 0, g = 0, bl = 0, w = 0
    for (const k of b.keys) {
      const n = hist.get(k)!
      r += channel(k, 0) * n
      g += channel(k, 1) * n
      bl += channel(k, 2) * n
      w += n
    }
    out[3 * i] = Math.round(r / w)
    out[3 * i + 1] = Math.round(g / w)
    out[3 * i + 2] = Math.round(bl / w)
  })
  return out
}

/** Maps pixels to the nearest palette entry, memoised per colour. */
export class PaletteMapper {
  private cache = new Map<number, number>()
  private palette: Uint8Array
  constructor(palette: Uint8Array) {
    this.palette = palette
  }
  index(r: number, g: number, b: number): number {
    const key = (r << 16) | (g << 8) | b
    let hit = this.cache.get(key)
    if (hit === undefined) {
      let best = 0
      let bestD = Infinity
      for (let i = 0; i < this.palette.length / 3; i++) {
        const dr = this.palette[3 * i] - r
        const dg = this.palette[3 * i + 1] - g
        const db = this.palette[3 * i + 2] - b
        const d = 2 * dr * dr + 4 * dg * dg + 3 * db * db
        if (d < bestD) {
          bestD = d
          best = i
        }
      }
      hit = best
      this.cache.set(key, hit)
    }
    return hit
  }
  /** RGBA image data to palette indices. */
  map(rgba: Uint8ClampedArray | Uint8Array): Uint8Array {
    const out = new Uint8Array(rgba.length / 4)
    for (let i = 0; i < out.length; i++) out[i] = this.index(rgba[4 * i], rgba[4 * i + 1], rgba[4 * i + 2])
    return out
  }
}

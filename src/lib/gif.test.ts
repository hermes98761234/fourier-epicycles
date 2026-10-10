import { describe, expect, it } from 'vitest'
import { encodeGif, lzwEncode } from './gif'
import { medianCut, PaletteMapper } from './quantize'

/** Reference GIF LZW decoder over concatenated sub-block data. */
function lzwDecode(blocks: Uint8Array, minCode: number): number[] {
  const data: number[] = []
  for (let i = 0; i < blocks.length && blocks[i] !== 0; i += blocks[i] + 1) for (let j = 1; j <= blocks[i]; j++) data.push(blocks[i + j])
  const clear = 1 << minCode
  const eoi = clear + 1
  let table: number[][] = []
  const reset = () => {
    table = []
    for (let i = 0; i < clear; i++) table.push([i])
    table.push([], [])
  }
  reset()
  let size = minCode + 1
  let bitPos = 0
  const read = () => {
    let v = 0
    for (let b = 0; b < size; b++, bitPos++) v |= ((data[bitPos >> 3] >> (bitPos & 7)) & 1) << b
    return v
  }
  const out: number[] = []
  let prev: number[] | null = null
  for (;;) {
    const code = read()
    if (code === clear) {
      reset()
      size = minCode + 1
      prev = null
      continue
    }
    if (code === eoi) break
    let entry: number[]
    if (code < table.length) entry = table[code]
    else entry = [...prev!, prev![0]]
    out.push(...entry)
    if (prev) {
      table.push([...prev, entry[0]])
      if (table.length === 1 << size && size < 12) size++
    }
    prev = entry
  }
  return out
}

describe('lzw', () => {
  it('round-trips a repetitive sequence', () => {
    const src = Uint8Array.from({ length: 5000 }, (_, i) => (i % 7 < 3 ? 1 : 2))
    expect(lzwDecode(lzwEncode(src, 2), 2)).toEqual([...src])
  })
  it('round-trips noise long enough to fill and reset the dictionary', () => {
    let s = 12345
    const src = Uint8Array.from({ length: 60000 }, () => ((s = (s * 1103515245 + 12345) & 0x7fffffff), (s >> 16) & 15))
    expect(lzwDecode(lzwEncode(src, 4), 4)).toEqual([...src])
  })
  it('handles the empty and one-pixel cases', () => {
    expect(lzwDecode(lzwEncode(new Uint8Array(0), 2), 2)).toEqual([])
    expect(lzwDecode(lzwEncode(Uint8Array.of(3), 2), 2)).toEqual([3])
  })
})

describe('encodeGif', () => {
  it('writes a valid header, loop extension, frames and trailer', () => {
    const palette = Uint8Array.of(0, 0, 0, 255, 255, 255, 255, 0, 0)
    const bytes = encodeGif({ width: 3, height: 2, palette, frames: [Uint8Array.of(0, 1, 2, 2, 1, 0), Uint8Array.of(1, 1, 1, 0, 0, 0)], delayCs: 7 })
    expect(String.fromCharCode(...bytes.slice(0, 6))).toBe('GIF89a')
    expect(bytes[6] | (bytes[7] << 8)).toBe(3)
    expect(bytes[8] | (bytes[9] << 8)).toBe(2)
    expect(bytes[bytes.length - 1]).toBe(0x3b)
    const text = String.fromCharCode(...bytes)
    expect(text).toContain('NETSCAPE2.0')
    expect(text.split('\x21\xf9\x04').length - 1).toBe(2)
    expect(text.indexOf('\x21\xf9\x04\x00\x07\x00')).toBeGreaterThan(0)
  })
})

describe('quantize', () => {
  it('keeps the exact colours of flat art', () => {
    const rgb = Uint8Array.from([...Array(50).fill([255, 0, 0]).flat(), ...Array(50).fill([0, 0, 255]).flat(), ...Array(5).fill([10, 200, 10]).flat()])
    const pal = medianCut(rgb, 8)
    const m = new PaletteMapper(pal)
    for (const c of [[255, 0, 0], [0, 0, 255], [10, 200, 10]]) {
      const i = m.index(c[0], c[1], c[2])
      expect([pal[3 * i], pal[3 * i + 1], pal[3 * i + 2]]).toEqual(c)
    }
  })
  it('limits the palette size and maps to the nearest entry', () => {
    const rgb = new Uint8Array(3 * 256)
    for (let i = 0; i < 256; i++) rgb.set([i, 255 - i, (i * 7) & 255], 3 * i)
    const pal = medianCut(rgb, 16)
    expect(pal.length).toBeLessThanOrEqual(48)
    expect(new PaletteMapper(pal).index(0, 255, 0)).toBeLessThan(16)
  })
})

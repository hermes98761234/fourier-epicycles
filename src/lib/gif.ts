/** Minimal GIF89a encoder: indexed frames, global palette, looping animation. */

export interface GifOptions {
  width: number
  height: number
  /** Palette as flat r,g,b bytes (up to 256 colours; padded to a power of two). */
  palette: Uint8Array
  /** One Uint8Array of palette indices (width*height) per frame. */
  frames: Uint8Array[]
  /** Frame delay in hundredths of a second. */
  delayCs: number
}

class ByteSink {
  private buf = new Uint8Array(1 << 16)
  length = 0
  push(...bytes: number[]) {
    for (const b of bytes) this.byte(b)
  }
  byte(b: number) {
    if (this.length === this.buf.length) {
      const nb = new Uint8Array(this.buf.length * 2)
      nb.set(this.buf)
      this.buf = nb
    }
    this.buf[this.length++] = b
  }
  u16(v: number) {
    this.byte(v & 255)
    this.byte((v >> 8) & 255)
  }
  bytes(): Uint8Array {
    return this.buf.slice(0, this.length)
  }
}

/** GIF flavoured LZW; returns the data sub-blocks (without the min-code-size byte). */
export function lzwEncode(indices: Uint8Array, minCodeSize: number): Uint8Array {
  const clear = 1 << minCodeSize
  const eoi = clear + 1
  const out: number[] = []
  let cur = 0
  let curBits = 0
  let codeSize = minCodeSize + 1
  const emit = (code: number) => {
    cur |= code << curBits
    curBits += codeSize
    while (curBits >= 8) {
      out.push(cur & 255)
      cur >>>= 8
      curBits -= 8
    }
  }
  let dict = new Map<number, number>()
  let next = eoi + 1
  emit(clear)
  let prefix = indices.length ? indices[0] : -1
  for (let i = 1; i < indices.length; i++) {
    const c = indices[i]
    const key = (prefix << 8) | c
    const hit = dict.get(key)
    if (hit !== undefined) {
      prefix = hit
      continue
    }
    emit(prefix)
    if (next < 4096) {
      dict.set(key, next++)
      if (next - 1 === 1 << codeSize && codeSize < 12) codeSize++
    } else {
      emit(clear)
      dict = new Map()
      next = eoi + 1
      codeSize = minCodeSize + 1
    }
    prefix = c
  }
  if (prefix >= 0) emit(prefix)
  emit(eoi)
  if (curBits > 0) out.push(cur & 255)
  // split into sub-blocks of at most 255 bytes
  const res: number[] = []
  for (let i = 0; i < out.length; i += 255) {
    const n = Math.min(255, out.length - i)
    res.push(n)
    for (let j = 0; j < n; j++) res.push(out[i + j])
  }
  res.push(0)
  return Uint8Array.from(res)
}

export function encodeGif(o: GifOptions): Uint8Array {
  const colors = Math.max(2, o.palette.length / 3)
  let bits = 1
  while (1 << bits < colors) bits++
  const size = 1 << bits
  const minCode = Math.max(2, bits)
  const s = new ByteSink()
  for (const ch of 'GIF89a') s.byte(ch.charCodeAt(0))
  s.u16(o.width)
  s.u16(o.height)
  s.push(0x80 | 0x70 | (bits - 1), 0, 0)
  for (let i = 0; i < size * 3; i++) s.byte(i < o.palette.length ? o.palette[i] : 0)
  // NETSCAPE loop extension: loop forever
  s.push(0x21, 0xff, 0x0b)
  for (const ch of 'NETSCAPE2.0') s.byte(ch.charCodeAt(0))
  s.push(3, 1, 0, 0, 0)
  for (const f of o.frames) {
    s.push(0x21, 0xf9, 4, 0x00)
    s.u16(o.delayCs)
    s.push(0, 0)
    s.push(0x2c)
    s.u16(0)
    s.u16(0)
    s.u16(o.width)
    s.u16(o.height)
    s.byte(0)
    s.byte(minCode)
    const data = lzwEncode(f, minCode)
    for (const b of data) s.byte(b)
  }
  s.byte(0x3b)
  return s.bytes()
}

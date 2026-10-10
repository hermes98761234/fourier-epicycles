import { encodeGif } from './lib/gif'
import { medianCut, PaletteMapper } from './lib/quantize'
import { drawScene, type Colors, type View } from './render'

const tick = () => new Promise<void>((r) => setTimeout(r, 0))

export interface ExportJob {
  view: Omit<View, 't' | 'stroke'>
  colors: Colors
  /** Seconds for one full turn. */
  period: number
  size: number
}

export function canRecordVideo(): boolean {
  return typeof MediaRecorder !== 'undefined' && typeof HTMLCanvasElement.prototype.captureStream === 'function'
}

/** Renders one full turn into an animated GIF (frame-accurate, not real time). */
export async function exportGif(job: ExportJob, onProgress: (done: number, total: number) => void, signal: AbortSignal): Promise<Blob> {
  const { size } = job
  const frames = 90
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  const render = (i: number) => {
    drawScene(ctx, size, size, { ...job.view, t: i / frames, stroke: null }, job.colors)
    return ctx.getImageData(0, 0, size, size).data
  }
  // Pass 1: build a palette from a sample of frames.
  const sample: number[] = []
  for (let i = 0; i < frames; i += 10) {
    const d = render(i)
    for (let p = 0; p < d.length; p += 4 * 5) sample.push(d[p], d[p + 1], d[p + 2])
    await tick()
  }
  const palette = medianCut(Uint8Array.from(sample), 128)
  const mapper = new PaletteMapper(palette)
  // Pass 2: quantise every frame.
  const out: Uint8Array[] = []
  for (let i = 0; i < frames; i++) {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
    out.push(mapper.map(render(i)))
    onProgress(i + 1, frames)
    await tick()
  }
  const delayCs = Math.max(2, Math.round((job.period * 100) / frames))
  const bytes = encodeGif({ width: size, height: size, palette, frames: out, delayCs })
  return new Blob([bytes as BlobPart], { type: 'image/gif' })
}

/** Records one full turn in real time with MediaRecorder (WebM, or MP4 where the browser offers it). */
export async function exportVideo(job: ExportJob, onProgress: (pct: number) => void, signal: AbortSignal): Promise<{ blob: Blob; ext: string }> {
  const { size } = job
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const types = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4']
  const mime = types.find((t) => MediaRecorder.isTypeSupported(t)) ?? ''
  const rec = new MediaRecorder(canvas.captureStream(30), mime ? { mimeType: mime, videoBitsPerSecond: 4_000_000 } : undefined)
  const chunks: Blob[] = []
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
  const done = new Promise<void>((r) => (rec.onstop = () => r()))
  const t0 = performance.now()
  rec.start()
  await new Promise<void>((resolve) => {
    const step = () => {
      const f = (performance.now() - t0) / 1000 / job.period
      if (signal.aborted || f >= 1) return resolve()
      drawScene(ctx, size, size, { ...job.view, t: f, stroke: null }, job.colors)
      onProgress(Math.round(f * 100))
      requestAnimationFrame(step)
    }
    step()
  })
  drawScene(ctx, size, size, { ...job.view, t: 0.9999, stroke: null }, job.colors)
  rec.stop()
  await done
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
  const type = rec.mimeType || mime || 'video/webm'
  return { blob: new Blob(chunks, { type }), ext: type.includes('mp4') ? 'mp4' : 'webm' }
}

export function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

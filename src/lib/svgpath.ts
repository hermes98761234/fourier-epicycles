import { normalizePoints, resampleClosed, type Pt } from './fourier'

const SHAPES = 'path,circle,ellipse,rect,polygon,polyline,line'

/**
 * Samples every shape of an SVG document into one closed path (sub-paths are chained).
 * Needs a DOM (uses getPointAtLength); returns null if no geometry was found.
 * Scripts and event handlers in the file are stripped before it is attached.
 */
export function svgToPoints(text: string, samples: number): Pt[] | null {
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml')
  const root = doc.documentElement
  if (!root || root.localName !== 'svg' || doc.querySelector('parsererror')) return null
  root.querySelectorAll('script,foreignObject,style').forEach((e) => e.remove())
  root.querySelectorAll('*').forEach((e) => {
    for (const a of [...e.attributes]) if (/^on/i.test(a.name) || /^\s*javascript:/i.test(a.value)) e.removeAttribute(a.name)
  })
  const holder = document.createElement('div')
  holder.style.cssText = 'position:absolute;left:-99999px;top:0;width:1000px;height:1000px;overflow:hidden;visibility:hidden'
  const svg = document.importNode(root, true) as unknown as SVGSVGElement
  svg.style.width = '1000px'
  svg.style.height = '1000px'
  holder.appendChild(svg)
  document.body.appendChild(holder)
  try {
    const raw: Pt[] = []
    svg.querySelectorAll(SHAPES).forEach((node) => {
      if (node.closest('defs,clipPath,mask,symbol,marker,pattern')) return
      const el = node as unknown as SVGGeometryElement
      if (typeof el.getTotalLength !== 'function') return
      let len = 0
      try {
        len = el.getTotalLength()
      } catch {
        return
      }
      if (!(len > 0)) return
      const m = (el as unknown as SVGGraphicsElement).getCTM?.()
      const n = Math.max(8, Math.min(4000, Math.ceil(len / 2)))
      // Include the end point for open shapes so chained sub-paths connect.
      for (let i = 0; i <= n; i++) {
        const p = el.getPointAtLength((i / n) * len)
        raw.push(m ? { x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f } : { x: p.x, y: p.y })
      }
    })
    if (raw.length < 3) return null
    return normalizePoints(resampleClosed(raw, samples))
  } finally {
    holder.remove()
  }
}

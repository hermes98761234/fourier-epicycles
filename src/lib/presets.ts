import type { Pt } from './fourier'

export interface Preset {
  id: string
  name: string
  points: () => Pt[]
}

const param = (n: number, f: (t: number) => Pt): Pt[] => Array.from({ length: n }, (_, i) => f((i / n) * 2 * Math.PI))

export const PRESETS: Preset[] = [
  {
    id: 'heart',
    name: 'Heart',
    points: () => param(400, (t) => ({ x: 16 * Math.sin(t) ** 3, y: -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) })),
  },
  {
    id: 'star',
    name: 'Star',
    points: () => {
      const pts: Pt[] = []
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? 1 : 0.4
        const a = -Math.PI / 2 + (i * Math.PI) / 5
        pts.push({ x: r * Math.cos(a), y: r * Math.sin(a) })
      }
      return pts
    },
  },
  {
    id: 'butterfly',
    name: 'Butterfly',
    points: () =>
      Array.from({ length: 1500 }, (_, i) => {
        const th = (i / 1500) * 12 * Math.PI
        const r = Math.exp(Math.cos(th)) - 2 * Math.cos(4 * th) + Math.sin((2 * th - Math.PI) / 24) ** 5
        return { x: r * Math.sin(th), y: -r * Math.cos(th) }
      }),
  },
  {
    id: 'infinity',
    name: 'Infinity',
    points: () =>
      param(400, (t) => {
        const d = 1 + Math.sin(t) ** 2
        return { x: Math.cos(t) / d, y: (Math.sin(t) * Math.cos(t)) / d }
      }),
  },
  {
    id: 'trefoil',
    name: 'Trefoil',
    points: () => param(400, (t) => ({ x: Math.sin(t) + 2 * Math.sin(2 * t), y: Math.cos(t) - 2 * Math.cos(2 * t) })),
  },
  {
    id: 'pi',
    name: 'Pi',
    points: () => [
      [-1, -0.8], [1, -0.8], [1, -0.5], [0.6, -0.5], [0.6, 0.8], [0.25, 0.8], [0.25, -0.5],
      [-0.25, -0.5], [-0.25, 0.8], [-0.6, 0.8], [-0.6, -0.5], [-1, -0.5],
    ].map(([x, y]) => ({ x, y })),
  },
]

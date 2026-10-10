import type { Pt } from './fourier'
import { PRESETS } from './presets'

export type Lang = 'en' | 'uk'
export type Theme = 'auto' | 'light' | 'dark'

export interface Settings {
  lang: Lang
  theme: Theme
  /** Number of epicycles in use. */
  terms: number
  /** Seconds per full revolution. */
  period: number
  circles: boolean
  vectors: boolean
  trail: boolean
  original: boolean
  full: boolean
}

/** The path is either a named preset or custom points (already normalised). */
export interface Source {
  preset: string | null
  custom: Pt[] | null
}

export interface AppState {
  settings: Settings
  source: Source
}

/** Samples per path; also the number of available arms. */
export const SAMPLES = 1024

export const DEFAULT_SETTINGS: Settings = {
  lang: 'en',
  theme: 'auto',
  terms: 24,
  period: 12,
  circles: true,
  vectors: true,
  trail: true,
  original: true,
  full: false,
}

const KEY = 'fourier-epicycles:v1'

const clamp = (v: unknown, lo: number, hi: number, d: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d)

export function sanitize(raw: unknown): AppState {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>
  const s = (r.settings && typeof r.settings === 'object' ? r.settings : {}) as Record<string, unknown>
  const d = DEFAULT_SETTINGS
  const bool = (v: unknown, def: boolean) => (typeof v === 'boolean' ? v : def)
  const settings: Settings = {
    lang: s.lang === 'uk' ? 'uk' : 'en',
    theme: s.theme === 'light' || s.theme === 'dark' ? s.theme : 'auto',
    terms: Math.round(clamp(s.terms, 1, SAMPLES, d.terms)),
    period: clamp(s.period, 2, 60, d.period),
    circles: bool(s.circles, d.circles),
    vectors: bool(s.vectors, d.vectors),
    trail: bool(s.trail, d.trail),
    original: bool(s.original, d.original),
    full: bool(s.full, d.full),
  }
  const src = (r.source && typeof r.source === 'object' ? r.source : {}) as Record<string, any>
  let custom: Pt[] | null = null
  if (Array.isArray(src.custom) && src.custom.length >= 3 && src.custom.every((p: any) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]))) {
    custom = src.custom.map((p: number[]) => ({ x: p[0], y: p[1] }))
  }
  const preset = typeof src.preset === 'string' && PRESETS.some((p) => p.id === src.preset) ? src.preset : null
  const source: Source = custom ? { preset: null, custom } : { preset: preset ?? PRESETS[0].id, custom: null }
  return { settings, source }
}

export function loadState(): AppState {
  try {
    return sanitize(JSON.parse(localStorage.getItem(KEY) ?? 'null'))
  } catch {
    return sanitize(null)
  }
}

export function saveState(st: AppState): void {
  try {
    const custom = st.source.custom ? st.source.custom.map((p) => [Math.round(p.x * 1e4) / 1e4, Math.round(p.y * 1e4) / 1e4]) : null
    localStorage.setItem(KEY, JSON.stringify({ settings: st.settings, source: { preset: st.source.preset, custom } }))
  } catch {
    // storage may be unavailable or full; settings just won't persist
  }
}

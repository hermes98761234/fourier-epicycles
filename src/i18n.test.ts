import { describe, expect, it } from 'vitest'
import { tr, UK } from './i18n'
import { PRESETS } from './lib/presets'
import { DEFAULT_SETTINGS, sanitize } from './lib/model'

describe('i18n', () => {
  it('translates and interpolates', () => {
    expect(tr('uk', 'Terms: {0} of {1}', 5, 9)).toBe('Членів: 5 з 9')
    expect(tr('en', 'Terms: {0} of {1}', 5, 9)).toBe('Terms: 5 of 9')
    expect(tr('uk', 'unknown string')).toBe('unknown string')
  })
  it('has a translation for every preset name and no empty entries', () => {
    for (const p of PRESETS) expect(UK[p.name]).toBeTruthy()
    expect(Object.values(UK).every((v) => v.length > 0)).toBe(true)
  })
})

describe('settings', () => {
  it('falls back to defaults and clamps bad input', () => {
    const s = sanitize({ settings: { terms: 1e9, period: -5, lang: 'xx', theme: 'dark' }, source: { preset: 'nope' } })
    expect(s.settings.terms).toBe(1024)
    expect(s.settings.period).toBe(2)
    expect(s.settings.lang).toBe('en')
    expect(s.settings.theme).toBe('dark')
    expect(s.source.preset).toBe(PRESETS[0].id)
    expect(sanitize(null).settings).toEqual(DEFAULT_SETTINGS)
  })
  it('keeps valid custom points', () => {
    const s = sanitize({ source: { custom: [[0, 0], [1, 0], [1, 1]] } })
    expect(s.source.custom).toHaveLength(3)
    expect(s.source.preset).toBeNull()
  })
})

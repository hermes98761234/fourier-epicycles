import { useEffect, useMemo, useRef, useState } from 'react'
import { dft, normalizePoints, resampleClosed, reconstruct, rmsError, type Pt } from './lib/fourier'
import { loadState, saveState, SAMPLES, type AppState, type Settings } from './lib/model'
import { PRESETS } from './lib/presets'
import { svgToPoints } from './lib/svgpath'
import { tr, type T } from './i18n'
import { canRecordVideo, download, exportGif, exportVideo, type ExportJob } from './exporters'
import { readColors } from './render'
import Stage from './components/Stage'

const CURVE_SAMPLES = 720

export default function App() {
  const [state, setState] = useState<AppState>(loadState)
  const [notice, setNotice] = useState('')
  const [job, setJob] = useState<{ label: string } | null>(null)
  const abort = useRef<AbortController | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const { settings, source } = state
  const t: T = (s, ...a) => tr(settings.lang, s, ...a)
  const set = (patch: Partial<Settings>) => setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }))

  const points = useMemo<Pt[]>(() => {
    if (source.custom) return resampleClosed(source.custom, SAMPLES)
    const p = PRESETS.find((x) => x.id === source.preset) ?? PRESETS[0]
    return normalizePoints(resampleClosed(p.points(), SAMPLES))
  }, [source])
  const terms = useMemo(() => dft(points), [points])
  const m = Math.min(settings.terms, terms.length)
  const curve = useMemo(() => reconstruct(terms, m, CURVE_SAMPLES), [terms, m])
  const err = rmsError(terms, m)

  useEffect(() => saveState(state), [state])
  useEffect(() => {
    const root = document.documentElement
    if (settings.theme === 'auto') delete root.dataset.theme
    else root.dataset.theme = settings.theme
    root.lang = settings.lang
    document.title = `${tr(settings.lang, 'Fourier epicycles')}`
  }, [settings.theme, settings.lang])

  const setCustom = (pts: Pt[]) => {
    setNotice('')
    setState((s) => ({ ...s, source: { preset: null, custom: normalizePoints(resampleClosed(pts, SAMPLES)) } }))
  }
  const onStroke = (pts: Pt[]) => {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
    for (const p of pts) {
      x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y)
    }
    if (pts.length < 5 || Math.max(x1 - x0, y1 - y0) < 0.08) return setNotice(t('Draw something bigger.'))
    setCustom(pts)
  }
  const onFile = async (f: File | undefined) => {
    if (!f) return
    const pts = svgToPoints(await f.text(), SAMPLES)
    if (!pts) return setNotice(t("Couldn't read any shapes from that SVG."))
    setCustom(pts)
  }

  const display = { circles: settings.circles, vectors: settings.vectors, trail: settings.trail, original: settings.original, full: settings.full }
  const startJob = async (kind: 'gif' | 'video') => {
    const ctl = new AbortController()
    abort.current = ctl
    const spec: ExportJob = { view: { terms, m, curve, original: points, display }, colors: readColors(document.documentElement), period: settings.period, size: kind === 'gif' ? 420 : 720 }
    try {
      if (kind === 'gif') {
        setJob({ label: t('Rendering frame {0} of {1}…', 0, 90) })
        const blob = await exportGif(spec, (d, n) => setJob({ label: t('Rendering frame {0} of {1}…', d, n) }), ctl.signal)
        download(blob, 'fourier-epicycles.gif')
      } else {
        setJob({ label: t('Recording… {0}%', 0) })
        const { blob, ext } = await exportVideo(spec, (p) => setJob({ label: t('Recording… {0}%', p) }), ctl.signal)
        download(blob, `fourier-epicycles.${ext}`)
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) setNotice(String(e))
    } finally {
      setJob(null)
    }
  }

  // Number-of-terms slider is logarithmic: fine control where the shape changes most.
  const logMax = Math.log(terms.length || 1)
  const sliderVal = Math.log(Math.max(1, m))
  const top = terms.slice(0, 8)

  return (
    <div className="app">
      <header className="toolbar">
        <span className="brand">{t('Fourier epicycles')}</span>
        <span className="hint">{t('Draw any shape and watch rotating circles redraw it.')}</span>
      </header>
      <div className="body">
        <aside className="side">
          <div className="panel">
            <section className="section">
              <h3>{t('Path')}</h3>
              <p className="hint">{t('Draw on the canvas with mouse, finger or pen. The shape closes itself.')}</p>
              <div className="row presets" role="group" aria-label={t('Presets')}>
                {PRESETS.map((p) => (
                  <button
                    key={p.id}
                    className={source.preset === p.id ? 'active' : ''}
                    aria-pressed={source.preset === p.id}
                    onClick={() => { setNotice(''); setState((s) => ({ ...s, source: { preset: p.id, custom: null } })) }}
                  >
                    {t(p.name)}
                  </button>
                ))}
              </div>
              <div className="row">
                <button onClick={() => fileRef.current?.click()}>{t('Upload SVG')}</button>
                <button onClick={() => { setNotice(''); setState((s) => ({ ...s, source: { preset: PRESETS[0].id, custom: null } })) }}>{t('Clear')}</button>
                <input ref={fileRef} type="file" accept=".svg,image/svg+xml" hidden onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = '' }} />
              </div>
              {notice && <p className="hint err-text" role="alert">{notice}</p>}
            </section>
            <section className="section">
              <h3>{t('Epicycles')}</h3>
              <div className="field">
                <label htmlFor="terms">{t('Terms: {0} of {1}', m, terms.length)}</label>
                <div className="row" style={{ marginBottom: 0 }}>
                  <input
                    id="terms"
                    type="range"
                    min={0}
                    max={logMax}
                    step={0.01}
                    value={sliderVal}
                    style={{ flex: 1 }}
                    onChange={(e) => set({ terms: Math.min(terms.length, Math.max(1, Math.round(Math.exp(+e.target.value)))) })}
                  />
                  <button className="small" onClick={() => set({ terms: terms.length })}>{t('All')}</button>
                </div>
              </div>
              <div className="field">
                <label htmlFor="period">{t('Seconds per turn')}: {settings.period}</label>
                <input id="period" type="range" min={2} max={40} step={1} value={settings.period} onChange={(e) => set({ period: +e.target.value })} />
              </div>
            </section>
            <section className="section">
              <h3>{t('Display')}</h3>
              {(
                [['circles', 'Circles'], ['vectors', 'Arms'], ['trail', 'Trail'], ['original', 'Original path'], ['full', 'Full reconstructed path']] as const
              ).map(([k, label]) => (
                <label key={k} className="check">
                  <input type="checkbox" checked={settings[k]} onChange={(e) => set({ [k]: e.target.checked })} /> {t(label)}
                </label>
              ))}
            </section>
            <section className="section">
              <h3>{t('Export')}</h3>
              <div className="row">
                <button disabled={!!job} onClick={() => void startJob('gif')}>{t('Export GIF')}</button>
                <button disabled={!!job || !canRecordVideo()} title={canRecordVideo() ? '' : t('Video recording is not supported in this browser.')} onClick={() => void startJob('video')}>{t('Record WebM')}</button>
              </div>
              {job && (
                <div className="row">
                  <span className="hint" role="status">{job.label}</span>
                  <button className="small" onClick={() => abort.current?.abort()}>{t('Cancel')}</button>
                </div>
              )}
            </section>
            <section className="section">
              <h3>{t('Settings')}</h3>
              <div className="grid2">
                <div className="field">
                  <label htmlFor="lang">{t('Language')}</label>
                  <select id="lang" value={settings.lang} onChange={(e) => set({ lang: e.target.value === 'uk' ? 'uk' : 'en' })}>
                    <option value="en">English</option>
                    <option value="uk">Українська</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="theme">{t('Theme')}</label>
                  <select id="theme" value={settings.theme} onChange={(e) => set({ theme: e.target.value as Settings['theme'] })}>
                    <option value="auto">{t('System')}</option>
                    <option value="light">{t('Light')}</option>
                    <option value="dark">{t('Dark')}</option>
                  </select>
                </div>
              </div>
            </section>
          </div>
        </aside>
        <main className="main">
          <Stage terms={terms} m={m} curve={curve} original={points} display={display} period={settings.period} onStroke={onStroke} t={t} />
          <div className="box">
            <p className="verdict">
              {t('Fit error (RMS)')}: {((err / 2) * 100).toFixed(2)}% <span className="hint">{t('of the shape size')}</span>
            </p>
            <h3>{t('Largest terms')}</h3>
            <table className="data">
              <thead>
                <tr><td>#</td><td>{t('Frequency')}</td><td>{t('Radius')}</td><td>{t('Phase')}</td></tr>
              </thead>
              <tbody>
                {top.map((c, i) => (
                  <tr key={c.k} className={i < m ? '' : 'off'}>
                    <td>{i + 1}</td>
                    <td>{c.k}</td>
                    <td>{c.amp.toFixed(4)}</td>
                    <td>{((c.phase * 180) / Math.PI).toFixed(1)}°</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      </div>
      <p className="hint foot">
        {t('Drawing is approximated by a Fourier series. Everything runs in your browser.')}{' '}
        <a href="https://github.com/hermes98761234/fourier-epicycles">{t('Source on GitHub')}</a>
      </p>
    </div>
  )
}

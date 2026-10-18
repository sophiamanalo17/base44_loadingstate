import { useEffect, useRef, useState, type ReactNode } from 'react'
import { DEFAULTS, useMosaic, type MosaicSettings } from './settings'
import './panel.css'

type NumKey = { [K in keyof MosaicSettings]: MosaicSettings[K] extends number ? K : never }[keyof MosaicSettings]

function Slider({ k, label, min, max, step, unit = '', hint }: { k: NumKey; label: string; min: number; max: number; step: number; unit?: string; hint?: string }) {
  const { settings, set } = useMosaic()
  const v = settings[k]
  const changed = v !== DEFAULTS[k]
  return (
    <label className="mp-row" title={hint}>
      <span className="mp-label">
        {label}
        {changed && (
          <button type="button" className="mp-reset-one" onClick={() => set(k, DEFAULTS[k])} aria-label={`Reset ${label}`}>
            ↺
          </button>
        )}
      </span>
      <span className="mp-value">
        {Number.isInteger(step) ? v : v.toFixed(2)}
        {unit}
      </span>
      <input type="range" min={min} max={max} step={step} value={v} onChange={(e) => set(k, Number(e.target.value) as never)} />
    </label>
  )
}

function Segmented<K extends keyof MosaicSettings>({ k, label, options }: { k: K; label: string; options: { value: MosaicSettings[K]; label: string }[] }) {
  const { settings, set } = useMosaic()
  return (
    <div className="mp-row">
      <span className="mp-label">{label}</span>
      <div className="mp-seg" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={settings[k] === o.value}
            className={settings[k] === o.value ? 'on' : ''}
            onClick={() => set(k, o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function Toggle({ k, label }: { k: 'enabled'; label: string }) {
  const { settings, set } = useMosaic()
  return (
    <label className="mp-toggle">
      <span>{label}</span>
      <input type="checkbox" checked={settings[k]} onChange={(e) => set(k, e.target.checked)} />
      <i aria-hidden />
    </label>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mp-group">
      <h3>{title}</h3>
      {children}
    </section>
  )
}

export function Panel() {
  const { settings, replay, reset } = useMosaic()
  const [open, setOpen] = useState(true)
  const [autoReplay, setAutoReplay] = useState(true)
  const [copied, setCopied] = useState(false)
  const first = useRef(true)

  // replay shortly after the last tweak so slider drags don't restart every frame
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    if (!autoReplay) return
    const id = setTimeout(replay, 300)
    return () => clearTimeout(id)
  }, [settings, autoReplay, replay])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'p' || e.key === 'P') setOpen((o) => !o)
      if (e.key === 'r' || e.key === 'R') replay()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [replay])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(settings, null, 2))
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      // clipboard blocked
    }
  }

  return (
    <>
      <button type="button" className={`mp-tab ${open ? 'hidden' : ''}`} onClick={() => setOpen(true)} aria-label="Open effect panel">
        <span className="mp-tab-swatch" aria-hidden />
        Effect
      </button>
      <aside className={`mp ${open ? 'open' : ''}`} aria-label="Image load-in settings">
        <header className="mp-head">
          <div>
            <strong>Mosaic load-in</strong>
            <small>P toggles · R replays</small>
          </div>
          <button type="button" className="mp-close" onClick={() => setOpen(false)} aria-label="Close panel">
            ×
          </button>
        </header>

        <div className="mp-actions">
          <button type="button" className="mp-primary" onClick={replay}>
            Replay
          </button>
          <button type="button" onClick={copy}>{copied ? 'Copied' : 'Copy JSON'}</button>
          <button type="button" onClick={reset}>
            Reset
          </button>
        </div>

        <div className="mp-body">
          <Group title="General">
            <Toggle k="enabled" label="Effect on" />
            <Segmented
              k="style"
              label="Style"
              options={[
                { value: 'mosaic', label: 'Mosaic' },
                { value: 'mask', label: 'Mask' },
              ]}
            />
            <label className="mp-toggle">
              <span>Replay on change</span>
              <input type="checkbox" checked={autoReplay} onChange={(e) => setAutoReplay(e.target.checked)} />
              <i aria-hidden />
            </label>
            <Segmented
              k="trigger"
              label="Start when"
              options={[
                { value: 'scroll', label: 'In view' },
                { value: 'load', label: 'Page load' },
              ]}
            />
          </Group>

          <Group title="Timing">
            <Slider k="duration" label="Duration" min={300} max={6000} step={50} unit="ms" />
            <Slider k="spread" label="Sweep share" min={0} max={0.95} step={0.01} hint="Part of the duration spent sweeping blocks in" />
            <Slider k="stagger" label="Stagger between images" min={0} max={800} step={10} unit="ms" />
            <Slider k="jitter" label="Jitter" min={0} max={1} step={0.01} />
            <Slider k="blockFade" label="Block fade" min={0} max={400} step={10} unit="ms" hint="0 = hard pixel pop" />
            <Segmented
              k="easing"
              label="Sweep easing"
              options={[
                { value: 'linear', label: 'Linear' },
                { value: 'easeOut', label: 'Out' },
                { value: 'easeInOut', label: 'In-out' },
                { value: 'expoOut', label: 'Expo' },
              ]}
            />
          </Group>

          {settings.style === 'mask' && (
            <Group title="Mask">
              <Slider k="maskGrid" label="Tiles per side" min={1} max={8} step={1} hint="2 = four quadrants pinned at the centre" />
              <Slider k="maskStartScale" label="Start size" min={0} max={1} step={0.01} hint="Tile size as it leaves the centre; 0 = grows from a point" />
              <Slider k="maskStagger" label="Outer tiles lag" min={0} max={0.9} step={0.01} />
            </Group>
          )}

          <Group title="Sweep">
            <Segmented
              k="direction"
              label="Direction"
              options={[
                { value: 'left', label: '→' },
                { value: 'right', label: '←' },
                { value: 'top', label: '↓' },
                { value: 'bottom', label: '↑' },
                { value: 'center', label: '◎' },
                { value: 'random', label: '⁘' },
              ]}
            />
            <Slider k="waveAmp" label="Wave amplitude" min={0} max={1.5} step={0.01} />
            <Slider k="waveFreq" label="Wave frequency" min={0} max={6} step={0.1} />
          </Group>

          <Group title="Blocks">
            <Slider k="cellSize" label="Block width" min={12} max={240} step={1} unit="px" />
            <Slider k="aspect" label="Block aspect (w/h)" min={0.5} max={4} step={0.05} />
            <Slider k="levels" label="Subdivisions" min={1} max={6} step={1} />
            <Slider k="detail" label="Detail splits first" min={0} max={1} step={0.01} />
            <Slider k="seed" label="Seed" min={1} max={99} step={1} />
          </Group>

          <Group title="Colour">
            <Slider k="saturation" label="Saturation" min={0} max={2.5} step={0.01} />
            <Slider k="wash" label="Pastel wash" min={0} max={0.9} step={0.01} />
          </Group>
        </div>
      </aside>
    </>
  )
}

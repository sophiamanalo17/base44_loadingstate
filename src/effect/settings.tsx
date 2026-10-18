import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type Direction = 'left' | 'right' | 'top' | 'bottom' | 'center' | 'random'
export type Easing = 'linear' | 'easeOut' | 'easeInOut' | 'expoOut'
export type Style = 'mosaic' | 'mask'
export type Trigger = 'scroll' | 'load'

export interface MosaicSettings {
  enabled: boolean
  /** mosaic = quadtree block resolve; mask = tiles grow out of the centre to their place */
  style: Style
  trigger: Trigger
  /** total time for one image to fully resolve (ms) */
  duration: number
  /** portion of the duration spent sweeping the wave across the image (0–1) */
  spread: number
  direction: Direction
  /** sine offset on the sweep front — the "harmonic" part (0–1 of spread) */
  waveAmp: number
  /** number of sine periods across the image */
  waveFreq: number
  /** width of the coarsest block in px */
  cellSize: number
  /** block width / height */
  aspect: number
  /** number of mosaic subdivision levels before the real image */
  levels: number
  /** per-block timing randomness (0–1) */
  jitter: number
  /** high-detail blocks split sooner (0–1) */
  detail: number
  /** saturation multiplier for block colours */
  saturation: number
  /** mix block colours toward white (0–1) — the pastel wash of the reel */
  wash: number
  /** ms a block takes to appear; 0 = hard binary pop */
  blockFade: number
  easing: Easing
  /** delay between images entering together (ms) */
  stagger: number
  seed: number
  /** mask: tiles per side (2 = four quadrants) */
  maskGrid: number
  /** mask: tile size when it leaves the centre, as a share of its final size (0 = a point) */
  maskStartScale: number
  /** mask: share of the duration that tiles further from the centre wait (0–1) */
  maskStagger: number
}

export const DEFAULTS: MosaicSettings = {
  enabled: true,
  style: 'mosaic',
  trigger: 'scroll',
  duration: 1800,
  spread: 0.45,
  direction: 'left',
  waveAmp: 0.35,
  waveFreq: 1.5,
  cellSize: 96,
  aspect: 1.8,
  levels: 3,
  jitter: 0.5,
  detail: 0.5,
  saturation: 1.15,
  wash: 0.25,
  blockFade: 0,
  easing: 'easeOut',
  stagger: 120,
  seed: 7,
  maskGrid: 2,
  maskStartScale: 0,
  maskStagger: 0.25,
}

const STORAGE_KEY = 'base44-mosaic-settings'

interface Ctx {
  settings: MosaicSettings
  set: <K extends keyof MosaicSettings>(key: K, value: MosaicSettings[K]) => void
  reset: () => void
  replay: () => void
  /** bumps on every replay so images restart */
  replayId: number
}

const SettingsContext = createContext<Ctx | null>(null)

function load(): MosaicSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    // storage unavailable — fall back to defaults
  }
  return DEFAULTS
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<MosaicSettings>(load)
  const [replayId, setReplayId] = useState(0)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    } catch {
      // ignore
    }
  }, [settings])

  const set = useCallback<Ctx['set']>((key, value) => {
    setSettings((s) => ({ ...s, [key]: value }))
  }, [])
  const reset = useCallback(() => {
    setSettings(DEFAULTS)
    setReplayId((n) => n + 1)
  }, [])
  const replay = useCallback(() => setReplayId((n) => n + 1), [])

  const value = useMemo(() => ({ settings, set, reset, replay, replayId }), [settings, set, reset, replay, replayId])
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useMosaic() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useMosaic must be used inside SettingsProvider')
  return ctx
}

import { useEffect, useState, type CSSProperties } from 'react'
import { useInView, useLoop } from './useLoop'
import './steps.css'

/* All three share one 280×200 stage, one cursor, one easing and the brand palette. */

function Cursor({ x, y, pressed }: { x: number; y: number; pressed?: boolean }) {
  return (
    <svg className={`mg-cursor ${pressed ? 'is-pressed' : ''}`} style={{ transform: `translate(${x}px, ${y}px)` }} width="18" height="22" viewBox="0 0 18 22" aria-hidden>
      <path d="M1.5 1.5v16.2l4.3-4.1 2.9 6.6 3.1-1.4-2.9-6.5h6z" fill="#1E1E24" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

/** brand "frame holder": thin outline with square cells on each corner */
function Frame({ style, on }: { style: CSSProperties; on: boolean }) {
  return (
    <div className={`mg-frame ${on ? 'is-on' : ''}`} style={style} aria-hidden>
      <i />
      <i />
      <i />
      <i />
    </div>
  )
}

/** the Base44 "Bloom" cell — four rounded lobes around a square */
function Bloom({ size = 28, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <g fill={color}>
        <circle cx="16" cy="7" r="6" />
        <circle cx="16" cy="25" r="6" />
        <circle cx="7" cy="16" r="6" />
        <circle cx="25" cy="16" r="6" />
        <rect x="10" y="10" width="12" height="12" />
      </g>
      <rect x="13.5" y="13.5" width="5" height="5" fill="currentColor" />
    </svg>
  )
}

/* ---------- 1 · Pick a template ---------- */
// idle, glide to A, hover A, glide to B, click, selected, reset
const PICK = [500, 700, 450, 600, 220, 1700, 450]
const TILES = [
  { x: 58, y: 30, kind: 'sun' },
  { x: 146, y: 30, kind: 'bloom' },
  { x: 58, y: 108, kind: 'chart' },
  { x: 146, y: 108, kind: 'list' },
] as const

export function PickGraphic() {
  const [ref, inView] = useInView<HTMLDivElement>()
  const p = useLoop(PICK, inView, 5)
  const cursor = p === 0 || p === 6 ? { x: 236, y: 166 } : p <= 2 ? { x: 104, y: 62 } : { x: 192, y: 62 }
  const selected = p === 5
  return (
    <div ref={ref} className="mg-stage" aria-hidden>
      {TILES.map((t, i) => {
        const hover = (i === 0 && p === 2) || (i === 1 && (p === 3 || p === 4))
        const dim = selected && i !== 1
        return (
          <div
            key={t.kind}
            className={`mg-tile mg-tile--${t.kind} ${hover ? 'is-hover' : ''} ${dim ? 'is-dim' : ''} ${selected && i === 1 ? 'is-picked' : ''}`}
            style={{ left: t.x, top: t.y }}
          >
            {t.kind === 'sun' && (
              <span className="mg-sun">
                <i />
                <i />
              </span>
            )}
            {t.kind === 'bloom' && <Bloom size={30} />}
            {t.kind === 'chart' && (
              <span className="mg-bars">
                <i style={{ height: 10 }} />
                <i style={{ height: 18 }} />
                <i style={{ height: 26 }} />
              </span>
            )}
            {t.kind === 'list' && (
              <span className="mg-lines">
                <i style={{ width: '80%' }} />
                <i style={{ width: '60%' }} />
                <i style={{ width: '70%' }} />
              </span>
            )}
          </div>
        )
      })}
      <Frame on={selected} style={{ left: 140, top: 24, width: 88, height: 74 }} />
      <Cursor {...cursor} pressed={p === 4} />
    </div>
  )
}

/* ---------- 2 · Prompt it ---------- */
const PROMPT_TEXT = 'Add a booking page with a calendar'
const CHAR_MS = 42
// empty, typing, pause, send, build result, hold, reset
const PROMPT = [450, PROMPT_TEXT.length * CHAR_MS, 300, 260, 900, 1600, 450]

export function PromptGraphic() {
  const [ref, inView] = useInView<HTMLDivElement>()
  const p = useLoop(PROMPT, inView, 5)
  const [chars, setChars] = useState(0)

  useEffect(() => {
    if (p === 0 || p === 6) setChars(0)
    if (p >= 2 && p <= 5) setChars(PROMPT_TEXT.length)
    if (p !== 1) return
    setChars(0)
    const id = setInterval(() => setChars((c) => Math.min(PROMPT_TEXT.length, c + 1)), CHAR_MS)
    return () => clearInterval(id)
  }, [p])

  const built = p === 4 || p === 5
  return (
    <div ref={ref} className="mg-stage" aria-hidden>
      <div className={`mg-prompt ${p === 1 ? 'is-focus' : ''}`}>
        <p>
          {chars === 0 ? <span className="mg-placeholder">Describe what you want…</span> : PROMPT_TEXT.slice(0, chars)}
          {p >= 1 && p <= 2 && <span className="mg-caret" />}
        </p>
        <div className="mg-prompt-row">
          <span className="mg-plus">+</span>
          <span className={`mg-send ${p === 3 ? 'is-pressed' : ''} ${chars === PROMPT_TEXT.length ? 'is-ready' : ''}`}>
            <svg width="10" height="10" viewBox="0 0 10 10">
              <path d="M2 8 8 2M3.5 2H8v4.5" stroke="#1E1E24" strokeWidth="1.6" fill="none" strokeLinecap="round" />
            </svg>
          </span>
        </div>
      </div>

      <div className={`mg-result ${built ? 'is-built' : ''}`}>
        <div className="mg-cal">
          {Array.from({ length: 14 }, (_, i) => (
            <i key={i} className={i === 9 ? 'is-pick' : ''} style={{ transitionDelay: `${120 + i * 28}ms` }} />
          ))}
        </div>
        <div className="mg-result-lines">
          <i style={{ width: '74%' }} />
          <i style={{ width: '52%' }} />
          <b>Book</b>
        </div>
      </div>
      <Cursor x={p >= 2 && p <= 3 ? 236 : 250} y={p >= 2 && p <= 3 ? 70 : 178} pressed={p === 3} />
    </div>
  )
}

/* ---------- 3 · Make it yours ---------- */
const THEMES = ['#FF6A00', '#3B51E5', '#134F25']
// per colour: glide to swatch, click, hold
const MAKE = [550, 220, 1300, 550, 220, 1300, 550, 220, 1300]

export function MakeGraphic() {
  const [ref, inView] = useInView<HTMLDivElement>()
  // offset so the loop opens resting on orange, the lead brand colour
  const p = (useLoop(MAKE, inView, 0) + 2) % MAKE.length
  const target = Math.floor(p / 3)
  const step = p % 3
  // colour lands on the click; until then the previous one shows
  const applied = step === 0 ? (target + THEMES.length - 1) % THEMES.length : target
  const accent = THEMES[applied]
  const swatchY = (i: number) => 38 + i * 44

  return (
    <div ref={ref} className="mg-stage" style={{ ['--accent' as string]: accent }} aria-hidden>
      <div className="mg-app">
        <div className="mg-app-bar">
          <i />
          <i />
          <i />
        </div>
        <div className="mg-app-hero">
          <span className="mg-app-bloom" style={{ color: accent }}>
            <Bloom size={34} />
          </span>
        </div>
        <i className="mg-app-line" style={{ width: '70%' }} />
        <i className="mg-app-line" style={{ width: '46%' }} />
        <span className="mg-app-btn" />
      </div>
      <div className="mg-swatches">
        {THEMES.map((c, i) => (
          <span key={c} className={`mg-swatch ${applied === i ? 'is-on' : ''}`} style={{ background: c, top: swatchY(i) }} />
        ))}
      </div>
      <Cursor x={226} y={swatchY(target) + 12} pressed={step === 1} />
    </div>
  )
}

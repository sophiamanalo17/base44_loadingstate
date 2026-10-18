import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { draw, maskCorners, prepare, type Fit, type MaskCorners, type Prepared } from './mosaic'
import { useMosaic } from './settings'

interface Props {
  src: string
  alt?: string
  className?: string
  style?: CSSProperties
  fit?: Fit
  /** vertical crop anchor for cover fit: 0 = top, 0.5 = centre, 1 = bottom */
  focusY?: number
  /** position in a group that enters together; multiplied by the stagger setting */
  order?: number
  onDone?: () => void
  /** mask style: where the mask's outer corners sit relative to rest each frame; null once at rest */
  onMaskFrame?: (corners: MaskCorners | null) => void
}

type Phase = 'waiting' | 'playing' | 'done'

export function PixelImage({ src, alt = '', className, style, fit = 'cover', focusY = 0.5, order = 0, onDone, onMaskFrame }: Props) {
  const { settings: s, replayId } = useMosaic()
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  const [inView, setInView] = useState(false)
  const [phase, setPhase] = useState<Phase>('waiting')

  const settingsRef = useRef(s)
  settingsRef.current = s
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone
  const onMaskFrameRef = useRef(onMaskFrame)
  onMaskFrameRef.current = onMaskFrame

  useEffect(() => {
    const el = new Image()
    el.decoding = 'async'
    el.onload = () => setImg(el)
    el.src = src
  }, [src])

  useEffect(() => {
    const el = wrapRef.current!
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect
      setSize((prev) => (prev && Math.abs(prev.w - width) < 1 && Math.abs(prev.h - height) < 1 ? prev : { w: width, h: height }))
    })
    ro.observe(el)
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.15 })
    io.observe(el)
    return () => {
      ro.disconnect()
      io.disconnect()
    }
  }, [])

  // a replay or a change to how blocks are built restarts the image
  const shapeKey = `${s.cellSize}|${s.aspect}|${s.levels}|${s.saturation}|${s.wash}`
  useEffect(() => {
    setPhase('waiting')
  }, [replayId, shapeKey, s.enabled])

  // park anything following the mask at the centre until it plays, and release it afterwards
  const masking = s.enabled && s.style === 'mask' && phase !== 'done'
  useLayoutEffect(() => {
    if (!onMaskFrameRef.current) return
    if (masking && size && phase === 'waiting') onMaskFrameRef.current(maskCorners(size.w, size.h, settingsRef.current, 0))
    else if (!masking) onMaskFrameRef.current(null)
  }, [masking, phase, size])

  const shouldPlay = s.enabled && phase === 'waiting' && img && size && size.w > 0 && (s.trigger === 'load' || inView)

  useEffect(() => {
    if (!shouldPlay) return
    setPhase('playing')
  }, [shouldPlay])

  useEffect(() => {
    if (phase !== 'playing' || !img || !size) return
    const c = canvasRef.current!
    const cur = settingsRef.current
    let prep: Prepared
    try {
      prep = prepare(img, size.w, size.h, fit, focusY, cur)
    } catch {
      // tainted / undecodable source — just show the image
      setPhase('done')
      return
    }
    c.width = Math.round(size.w * prep.dpr)
    c.height = Math.round(size.h * prep.dpr)
    const ctx = c.getContext('2d')!
    const start = performance.now() + order * cur.stagger
    let raf = 0
    const tick = (now: number) => {
      const live = settingsRef.current
      if (live.style === 'mask') onMaskFrameRef.current?.(maskCorners(size.w, size.h, live, Math.max(0, now - start)))
      if (now < start) {
        raf = requestAnimationFrame(tick)
        return
      }
      if (draw(ctx, prep, live, now - start)) {
        onMaskFrameRef.current?.(null)
        setPhase('done')
        onDoneRef.current?.()
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [phase, img, size, fit, focusY, order])

  const showImg = !s.enabled || phase === 'done'

  return (
    <div ref={wrapRef} className={className} style={{ position: 'relative', overflow: 'hidden', ...style }}>
      <img
        src={src}
        alt={alt}
        draggable={false}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: fit, objectPosition: `50% ${focusY * 100}%`, visibility: showImg ? 'visible' : 'hidden' }}
      />
      <canvas
        ref={canvasRef}
        aria-hidden
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: phase === 'playing' ? 'block' : 'none' }}
      />
    </div>
  )
}

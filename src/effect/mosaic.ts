import type { Easing, MosaicSettings } from './settings'

/**
 * Quadtree mosaic resolve, modelled on the "Harmonic Lines" reel:
 * wide colour-averaged blocks pop in along a sine-shaped sweep, then split
 * 2×2 (detail-heavy blocks split first) until the real image shows through.
 */

interface Level {
  cols: number
  rows: number
  cw: number
  ch: number
  fill: (string | null)[]
  variance: Float32Array
}

export interface Prepared {
  w: number
  h: number
  dpr: number
  full: HTMLCanvasElement
  levels: Level[]
}

export type Fit = 'cover' | 'contain'

function coverRect(nw: number, nh: number, w: number, h: number, fit: Fit, focusY: number) {
  const scale = fit === 'cover' ? Math.max(w / nw, h / nh) : Math.min(w / nw, h / nh)
  const dw = nw * scale
  const dh = nh * scale
  return { dx: (w - dw) / 2, dy: (h - dh) * focusY, dw, dh }
}

function canvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(w))
  c.height = Math.max(1, Math.round(h))
  return c
}

/** downscale by repeated halving so every block colour is a true-ish average */
function downscale(src: HTMLCanvasElement, tw: number, th: number) {
  let cur = src
  while (cur.width / 2 > tw * 1.01 && cur.height / 2 > th * 1.01) {
    const next = canvas(Math.max(tw, cur.width / 2), Math.max(th, cur.height / 2))
    const ctx = next.getContext('2d')!
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(cur, 0, 0, next.width, next.height)
    cur = next
  }
  const out = canvas(tw, th)
  const ctx = out.getContext('2d', { willReadFrequently: true })!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(cur, 0, 0, tw, th)
  return ctx.getImageData(0, 0, tw, th).data
}

export function prepare(
  img: HTMLImageElement,
  w: number,
  h: number,
  fit: Fit,
  focusY: number,
  s: Pick<MosaicSettings, 'cellSize' | 'aspect' | 'levels' | 'saturation' | 'wash'>,
): Prepared {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const { dx, dy, dw, dh } = coverRect(img.naturalWidth || w, img.naturalHeight || h, w, h, fit, focusY)

  const full = canvas(w * dpr, h * dpr)
  const fctx = full.getContext('2d')!
  fctx.imageSmoothingQuality = 'high'
  fctx.drawImage(img, dx * dpr, dy * dpr, dw * dpr, dh * dpr)

  const L = Math.max(1, Math.round(s.levels))
  const cw0 = Math.max(4, s.cellSize)
  const ch0 = Math.max(2, cw0 / s.aspect)
  const cols0 = Math.ceil(w / cw0)
  const rows0 = Math.ceil(h / ch0)
  const k = 2 ** (L - 1)
  const colsF = cols0 * k
  const rowsF = rows0 * k

  // pad the image out to a whole number of root cells, then shrink to one pixel per finest cell
  const padded = canvas(cols0 * cw0, rows0 * ch0)
  padded.getContext('2d')!.drawImage(full, 0, 0, w, h)
  const data = downscale(padded, colsF, rowsF)

  // rgba per finest cell (premultiplied so averaging respects transparency)
  let r = new Float32Array(colsF * rowsF)
  let g = new Float32Array(colsF * rowsF)
  let b = new Float32Array(colsF * rowsF)
  let a = new Float32Array(colsF * rowsF)
  for (let i = 0; i < colsF * rowsF; i++) {
    const al = data[i * 4 + 3] / 255
    a[i] = al
    r[i] = (data[i * 4] / 255) * al
    g[i] = (data[i * 4 + 1] / 255) * al
    b[i] = (data[i * 4 + 2] / 255) * al
  }

  const levels: Level[] = new Array(L)
  const pendingVariance = new Map<number, Float32Array>()
  let cols = colsF
  let rows = rowsF
  for (let lv = L - 1; lv >= 0; lv--) {
    const cw = cw0 / 2 ** lv
    const ch = ch0 / 2 ** lv
    levels[lv] = { cols, rows, cw, ch, fill: buildFills(r, g, b, a, s.saturation, s.wash), variance: new Float32Array(cols * rows) }
    if (lv === 0) break
    // average 2×2 into the parent level and record how much the children disagree
    const pc = cols / 2
    const pr = rows / 2
    const nr = new Float32Array(pc * pr)
    const ng = new Float32Array(pc * pr)
    const nb = new Float32Array(pc * pr)
    const na = new Float32Array(pc * pr)
    const nv = new Float32Array(pc * pr)
    for (let y = 0; y < pr; y++) {
      for (let x = 0; x < pc; x++) {
        const p = y * pc + x
        const idx = [2 * y * cols + 2 * x, 2 * y * cols + 2 * x + 1, (2 * y + 1) * cols + 2 * x, (2 * y + 1) * cols + 2 * x + 1]
        for (const q of idx) {
          nr[p] += r[q] / 4
          ng[p] += g[q] / 4
          nb[p] += b[q] / 4
          na[p] += a[q] / 4
        }
        let v = 0
        for (const q of idx) v += (r[q] - nr[p]) ** 2 + (g[q] - ng[p]) ** 2 + (b[q] - nb[p]) ** 2
        nv[p] = v
      }
    }
    pendingVariance.set(lv - 1, nv)
    r = nr
    g = ng
    b = nb
    a = na
    cols = pc
    rows = pr
  }
  for (const [lv, v] of pendingVariance) {
    let max = 1e-6
    for (const x of v) max = Math.max(max, x)
    for (let i = 0; i < v.length; i++) v[i] = Math.sqrt(v[i] / max)
    levels[lv].variance = v
  }

  return { w, h, dpr, full, levels }
}

function buildFills(r: Float32Array, g: Float32Array, b: Float32Array, a: Float32Array, sat: number, wash: number) {
  const out: (string | null)[] = new Array(r.length)
  for (let i = 0; i < r.length; i++) {
    const al = a[i]
    if (al < 0.04) {
      out[i] = null
      continue
    }
    let R = r[i] / al
    let G = g[i] / al
    let B = b[i] / al
    const luma = 0.299 * R + 0.587 * G + 0.114 * B
    R = luma + (R - luma) * sat
    G = luma + (G - luma) * sat
    B = luma + (B - luma) * sat
    R = R + (1 - R) * wash
    G = G + (1 - G) * wash
    B = B + (1 - B) * wash
    const c = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255)
    out[i] = `rgba(${c(R)},${c(G)},${c(B)},${al.toFixed(3)})`
  }
  return out
}

/** deterministic 0–1 hash per cell so a replay looks the same for a given seed */
function rand(a: number, b: number, c: number, seed: number) {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647 + seed * 1442695041) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967295
}

const EASE: Record<Easing, (x: number) => number> = {
  linear: (x) => x,
  easeOut: (x) => 1 - (1 - x) ** 2,
  easeInOut: (x) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2),
  expoOut: (x) => (x >= 1 ? 1 : 1 - 2 ** (-10 * x)),
}

/** where along the sweep (0–1) a point sits, including the harmonic wave offset */
function sweepPos(nx: number, ny: number, s: MosaicSettings, i: number, j: number) {
  let u: number
  let v: number
  switch (s.direction) {
    case 'right':
      u = 1 - nx
      v = ny
      break
    case 'top':
      u = ny
      v = nx
      break
    case 'bottom':
      u = 1 - ny
      v = nx
      break
    case 'center': {
      const dx = nx - 0.5
      const dy = ny - 0.5
      u = Math.min(1, Math.hypot(dx, dy) / 0.7071)
      v = (Math.atan2(dy, dx) / (2 * Math.PI) + 1) % 1
      break
    }
    case 'random':
      u = rand(i, j, 99, s.seed)
      v = rand(j, i, 98, s.seed)
      break
    default:
      u = nx
      v = ny
  }
  const wave = 0.5 * (1 + Math.sin(2 * Math.PI * s.waveFreq * v))
  return EASE[s.easing]((u + s.waveAmp * wave) / (1 + s.waveAmp))
}

/**
 * Mask reveal: the image is cut into a grid of tiles that all start at the image centre.
 * Each tile is pinned by the corner facing the centre (the top-left tile by its bottom-right),
 * then grows and travels to its own place. The picture stays put, so the moving tile acts as a window onto it.
 */
function maskTile(i: number, j: number, w: number, h: number, s: MosaicSettings, t: number) {
  const n = Math.max(1, Math.round(s.maskGrid))
  const tw = w / n
  const th = h / n
  const cx = w / 2
  const cy = h / 2
  const x0 = i * tw
  const y0 = j * th
  // which side of the tile faces the centre: 1 = right/bottom, 0 = left/top, 0.5 = tile straddles the centre
  const facing = (mid: number, c: number) => (mid < c - 0.5 ? 1 : mid > c + 0.5 ? 0 : 0.5)
  const ax = facing(x0 + tw / 2, cx)
  const ay = facing(y0 + th / 2, cy)
  const lag = Math.min(0.95, Math.max(0, s.maskStagger))
  const delay = (lag * Math.hypot(x0 + tw / 2 - cx, y0 + th / 2 - cy)) / (Math.hypot(cx, cy) || 1)
  const k = Math.min(1, Math.max(0, (t / s.duration - delay) / (1 - lag)))
  const e = EASE[s.easing](k)
  const scale = s.maskStartScale + (1 - s.maskStartScale) * e
  const rw = tw * scale
  const rh = th * scale
  // the pinned corner travels from the image centre to its home on the grid
  const px = cx + (x0 + ax * tw - cx) * e
  const py = cy + (y0 + ay * th - cy) * e
  return { k, x: px - ax * rw, y: py - ay * rh, w: rw, h: rh }
}

export type MaskCorners = Record<'tl' | 'tr' | 'bl' | 'br', { x: number; y: number }>

/** how far each outer corner of the mask sits from its resting place at time t (px) */
export function maskCorners(w: number, h: number, s: MosaicSettings, t: number): MaskCorners {
  const last = Math.max(1, Math.round(s.maskGrid)) - 1
  const tl = maskTile(0, 0, w, h, s, t)
  const tr = maskTile(last, 0, w, h, s, t)
  const bl = maskTile(0, last, w, h, s, t)
  const br = maskTile(last, last, w, h, s, t)
  return {
    tl: { x: tl.x, y: tl.y },
    tr: { x: tr.x + tr.w - w, y: tr.y },
    bl: { x: bl.x, y: bl.y + bl.h - h },
    br: { x: br.x + br.w - w, y: br.y + br.h - h },
  }
}

function drawMask(ctx: CanvasRenderingContext2D, p: Prepared, s: MosaicSettings, t: number) {
  const { w, h, dpr, full } = p
  const n = Math.max(1, Math.round(s.maskGrid))
  let done = true

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)

  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const r = maskTile(i, j, w, h, s, t)
      if (r.k < 1) done = false
      if (r.k <= 0) continue
      const rx = Math.max(0, r.x)
      const ry = Math.max(0, r.y)
      const cw = Math.min(r.w, w - rx)
      const ch = Math.min(r.h, h - ry)
      if (cw <= 0 || ch <= 0) continue
      ctx.drawImage(full, rx * dpr, ry * dpr, cw * dpr, ch * dpr, rx, ry, cw, ch)
    }
  }
  return done
}

/** draws frame at time t (ms since start). returns true once every block shows the real image */
export function draw(ctx: CanvasRenderingContext2D, p: Prepared, s: MosaicSettings, t: number) {
  if (s.style === 'mask') return drawMask(ctx, p, s, t)
  const { w, h, dpr, levels, full } = p
  const L = levels.length
  const spreadMs = s.duration * s.spread
  const stepMs = (s.duration * (1 - s.spread)) / L
  let done = true

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)

  const fadeAlpha = (age: number) => (s.blockFade > 0 ? Math.min(1, age / s.blockFade) : 1)

  const cell = (lv: number, i: number, j: number, appear: number) => {
    const level = levels[lv]
    const x = i * level.cw
    const y = j * level.ch
    if (x >= w || y >= h) return
    if (t < appear) {
      done = false
      return
    }
    const idx = j * level.cols + i
    const jit = s.jitter * (rand(lv, i, j, s.seed) - 0.5) * 1.2
    const det = lv < L - 1 ? s.detail * (level.variance[idx] - 0.5) * 1.2 : 0
    const end = appear + stepMs * Math.min(2, Math.max(0.25, 1 + jit - det))

    if (t >= end) {
      if (lv < L - 1) {
        cell(lv + 1, 2 * i, 2 * j, end)
        cell(lv + 1, 2 * i + 1, 2 * j, end)
        cell(lv + 1, 2 * i, 2 * j + 1, end)
        cell(lv + 1, 2 * i + 1, 2 * j + 1, end)
        return
      }
      const age = t - end
      const al = fadeAlpha(age)
      if (al < 1) {
        done = false
        const f = level.fill[idx]
        if (f) {
          ctx.fillStyle = f
          ctx.fillRect(x, y, level.cw, level.ch)
        }
        ctx.globalAlpha = al
      }
      const cw = Math.min(level.cw, w - x)
      const ch = Math.min(level.ch, h - y)
      ctx.drawImage(full, x * dpr, y * dpr, cw * dpr, ch * dpr, x, y, cw, ch)
      ctx.globalAlpha = 1
      return
    }

    done = false
    const f = level.fill[idx]
    if (!f) return
    ctx.globalAlpha = lv === 0 ? fadeAlpha(t - appear) : 1
    ctx.fillStyle = f
    // +0.5 overlap hides hairline seams between neighbouring blocks
    ctx.fillRect(x, y, level.cw + 0.5, level.ch + 0.5)
    ctx.globalAlpha = 1
  }

  const root = levels[0]
  for (let j = 0; j < root.rows; j++) {
    for (let i = 0; i < root.cols; i++) {
      const nx = Math.min(1, ((i + 0.5) * root.cw) / w)
      const ny = Math.min(1, ((j + 0.5) * root.ch) / h)
      const appear = spreadMs * sweepPos(nx, ny, s, i, j) + s.jitter * rand(i, j, 7, s.seed) * stepMs * 0.5
      cell(0, i, j, appear)
    }
  }
  return done
}

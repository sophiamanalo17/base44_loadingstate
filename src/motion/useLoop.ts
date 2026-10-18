import { useEffect, useRef, useState } from 'react'

/** true while the element is on screen */
export function useInView<T extends Element>(threshold = 0.3) {
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold })
    io.observe(el)
    return () => io.disconnect()
  }, [threshold])
  return [ref, inView] as const
}

export const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Steps through phases with the given durations (ms) and loops, only while `active`.
 * Under reduced motion it parks on `restPhase` so the graphic still reads as a still.
 */
export function useLoop(durations: number[], active: boolean, restPhase = durations.length - 1) {
  const [phase, setPhase] = useState(0)
  const reduce = reducedMotion()
  useEffect(() => {
    if (reduce || !active) return
    const id = setTimeout(() => setPhase((p) => (p + 1) % durations.length), durations[phase])
    return () => clearTimeout(id)
  }, [phase, active, reduce, durations])
  return reduce ? restPhase : phase
}

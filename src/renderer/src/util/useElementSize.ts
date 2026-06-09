import { useEffect, useRef, useState } from 'react'

export interface Size {
  w: number
  h: number
}

/** Track an element's content box size via ResizeObserver. */
export function useElementSize<T extends HTMLElement>(): readonly [
  React.RefObject<T>,
  Size
] {
  const ref = useRef<T>(null)
  const [size, setSize] = useState<Size>({ w: 0, h: 0 })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect
      if (r) setSize({ w: r.width, h: r.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return [ref, size] as const
}

/** Largest w×h with the given aspect ratio that fits inside box. */
export function fitWithin(boxW: number, boxH: number, aspectW: number, aspectH: number): Size {
  if (boxW <= 0 || boxH <= 0 || aspectW <= 0 || aspectH <= 0) return { w: 0, h: 0 }
  const ar = aspectW / aspectH
  let w = boxW
  let h = boxW / ar
  if (h > boxH) {
    h = boxH
    w = boxH * ar
  }
  return { w: Math.floor(w), h: Math.floor(h) }
}

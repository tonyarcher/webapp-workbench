import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'

export type CustomEventHandler = (detail: unknown) => void

export function useCustomEvents(
  handlers: Record<string, CustomEventHandler | undefined>,
): RefObject<HTMLElement | null> {
  const ref = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const el = ref.current
    if (el === null) return
    const listeners: Array<[string, EventListener]> = []
    for (const [name, handler] of Object.entries(handlers)) {
      if (typeof handler !== 'function') continue
      const listener: EventListener = (event: Event): void => {
        handler((event as CustomEvent).detail)
      }
      el.addEventListener(name, listener)
      listeners.push([name, listener])
    }
    return () => {
      for (const [name, listener] of listeners) {
        el.removeEventListener(name, listener)
      }
    }
  }, [handlers])

  return ref
}

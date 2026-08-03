import { useCallback, useEffect, useRef } from 'react'
import type { RefCallback } from 'react'

export type CustomEventHandler = (detail: unknown) => void

export function useCustomEvents(
  handlers: Record<string, CustomEventHandler | undefined>,
): RefCallback<HTMLElement | null> {
  const handlersRef = useRef(handlers)
  useEffect(() => {
    handlersRef.current = handlers
  }, [handlers])

  const eventNames = Object.keys(handlers)
    .filter((name) => handlers[name] !== undefined)
    .sort()
    .join(',')

  return useCallback(
    (el: HTMLElement | null) => {
      if (el === null) return
      const names = eventNames.length > 0 ? eventNames.split(',') : []
      const listeners: Array<[string, EventListener]> = []
      for (const name of names) {
        const listener: EventListener = (event: Event): void => {
          handlersRef.current[name]?.((event as CustomEvent).detail)
        }
        el.addEventListener(name, listener)
        listeners.push([name, listener])
      }
      return () => {
        for (const [name, listener] of listeners) {
          el.removeEventListener(name, listener)
        }
      }
    },
    [eventNames],
  )
}

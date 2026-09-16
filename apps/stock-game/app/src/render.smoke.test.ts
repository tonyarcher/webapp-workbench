// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import './components/sg-app-shell'

describe('app render smoke', () => {
  it('renders the shell without throwing', async () => {
    const host = document.createElement('div')
    host.id = 'root'
    document.body.appendChild(host)
    let error: unknown = null
    let shell: Element | null = null
    try {
      shell = document.createElement('sg-app-shell')
      host.appendChild(shell)
      await new Promise((resolve) => setTimeout(resolve, 0))
    } catch (err) {
      error = err
    }
    expect(error).toBeNull()
    expect((shell as unknown as { shadowRoot: ShadowRoot | null })?.shadowRoot?.textContent).toContain('Stock Game')
    document.body.removeChild(host)
  })
})

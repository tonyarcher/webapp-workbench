// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../lib/auth', () => ({
  getAccessToken: vi.fn(async () => 'test-token' as string | null),
  refreshTokens: vi.fn(async () => null as string | null),
}))

import './sg-settings-view'
import type { SgSettingsView } from './sg-settings-view'
import { getQueryClient } from '../lib/queryClient'

const CONFIG = {
  startingCashCents: 123400,
  startDate: Date.parse('2024-01-01'),
  provider: 'yahoo',
  quoteDelayMinutes: 15,
  commissionCentsPerTrade: 0,
}

const SUBMIT = {
  startingCashCents: 200000,
  startDate: Date.parse('2024-01-01'),
  provider: 'yahoo',
  quoteDelayMinutes: 15,
  commissionCentsPerTrade: 0,
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

async function settled(): Promise<void> {
  for (let i = 0; i < 8; i++) await new Promise((resolve) => setTimeout(resolve, 0))
}

function cashInput(el: SgSettingsView): HTMLInputElement | null {
  return el.shadowRoot?.querySelector('sg-settings-form')?.shadowRoot?.querySelector('#cash') ?? null
}

describe('sg-settings-view', () => {
  beforeEach(() => {
    getQueryClient().clear()
    vi.unstubAllGlobals()
  })

  it('loads config into the form and saves on submit', async () => {
    let savedCash = CONFIG.startingCashCents
    const calls: Array<{ method: string; body: unknown }> = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === 'PUT') {
          const body = JSON.parse(init.body as string) as { startingCashCents: number }
          savedCash = body.startingCashCents
          calls.push({ method: 'PUT', body })
          return jsonResponse({ ...CONFIG, startingCashCents: savedCash })
        }
        return jsonResponse({ ...CONFIG, startingCashCents: savedCash })
      }),
    )
    const el = document.createElement('sg-settings-view') as SgSettingsView
    document.body.appendChild(el)
    await settled()
    expect(cashInput(el)?.value).toBe('1234')

    const form = el.shadowRoot?.querySelector('sg-settings-form')
    expect(form).not.toBeNull()
    form?.dispatchEvent(
      new CustomEvent('sg-config-submit', { detail: SUBMIT, bubbles: true, composed: true }),
    )
    await settled()
    expect(calls.length).toBe(1)
    expect(calls[0]?.body).toMatchObject({ startingCashCents: 200000 })
    expect(el.shadowRoot?.textContent).toContain('Configuration saved.')
    expect(cashInput(el)?.value).toBe('2000')
    el.remove()
  })

  it('shows save errors without the success message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === 'PUT') return jsonResponse({ error: 'boom' }, 500)
        return jsonResponse(CONFIG)
      }),
    )
    const el = document.createElement('sg-settings-view') as SgSettingsView
    document.body.appendChild(el)
    await settled()
    el.shadowRoot
      ?.querySelector('sg-settings-form')
      ?.dispatchEvent(
        new CustomEvent('sg-config-submit', { detail: SUBMIT, bubbles: true, composed: true }),
      )
    await settled()
    expect(el.shadowRoot?.textContent).toContain('boom')
    expect(el.shadowRoot?.textContent).not.toContain('Configuration saved.')
    el.remove()
  })

  it('keeps the success message when the post-save refresh fails', async () => {
    const priorDefaults = getQueryClient().getDefaultOptions()
    getQueryClient().setDefaultOptions({ queries: { retry: false } })
    try {
      let gets = 0
      vi.stubGlobal(
        'fetch',
        vi.fn(async (_url: string, init?: RequestInit) => {
          if (init?.method === 'PUT') return jsonResponse(SUBMIT)
          gets += 1
          if (gets > 1) return jsonResponse({ error: 'stale' }, 500)
          return jsonResponse(CONFIG)
        }),
      )
      const el = document.createElement('sg-settings-view') as SgSettingsView
      document.body.appendChild(el)
      await settled()
      el.shadowRoot
        ?.querySelector('sg-settings-form')
        ?.dispatchEvent(
          new CustomEvent('sg-config-submit', { detail: SUBMIT, bubbles: true, composed: true }),
        )
      await settled()
      expect(el.shadowRoot?.textContent).toContain('Configuration saved.')
      expect(el.shadowRoot?.textContent).toContain('stale')
      expect(el.busy).toBe(false)
      el.remove()
    } finally {
      getQueryClient().setDefaultOptions(priorDefaults)
    }
  })
})

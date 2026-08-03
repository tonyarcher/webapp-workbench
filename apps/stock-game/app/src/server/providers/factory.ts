import type { PriceProvider } from './types'
import { ProviderError } from './types'
import { YahooProvider } from './yahoo'
import { TwelveDataProvider } from './twelvedata'
import { AlphaVantageProvider } from './alphaVantage'
import { withCache } from './caching'
import type { Repo } from '../db'
import { getEnv } from '../env'

export function createProvider(repo: Repo): PriceProvider {
  const env = getEnv()
  const raw = createRawProvider(env.provider)
  return withCache(raw, repo, env.quoteTtlMs)
}

function createRawProvider(id: string): PriceProvider {
  const env = getEnv()
  switch (id) {
    case 'yahoo':
      return new YahooProvider()
    case 'twelvedata': {
      const key = env.twelveDataApiKey
      if (!key) throw new ProviderError('TWELVEDATA_API_KEY is not set')
      return new TwelveDataProvider(key)
    }
    case 'alphaVantage': {
      const key = env.alphaVantageApiKey
      if (!key) throw new ProviderError('ALPHAVANTAGE_API_KEY is not set')
      return new AlphaVantageProvider(key)
    }
    default:
      throw new ProviderError(`Unknown PRICE_PROVIDER: ${id}`)
  }
}

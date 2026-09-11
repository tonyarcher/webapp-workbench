package stockgame.provider

import stockgame.domain.Bar
import stockgame.domain.Quote
import stockgame.domain.SymbolHit
import stockgame.store.BarCache

private const val MINUTE_MS = 60_000L
private const val EMPTY_TTL = 10 * MINUTE_MS

class CachedProvider(
    private val inner: PriceProvider,
    private val cache: BarCache,
    private val quoteTtlMs: Long,
) : PriceProvider {
    override val id: String = inner.id
    private val quotes = HashMap<String, Pair<Long, Quote>>()
    private val emptyUntil = HashMap<String, Long>()

    override fun getQuote(symbol: String): Quote {
        val hit = quotes[symbol]
        val now = System.currentTimeMillis()
        if (hit != null && now - hit.first < quoteTtlMs) return hit.second
        val quote = inner.getQuote(symbol)
        quotes[symbol] = now to quote
        return quote
    }

    override fun getBars(symbol: String, interval: String, from: Long, to: Long): List<Bar> {
        val existing = cache.getBars(symbol, interval, from, to)
        if (existing.isNotEmpty()) return existing
        val key = "$symbol:$interval:$from:$to"
        val until = emptyUntil[key]
        if (until != null && until > System.currentTimeMillis()) return emptyList()
        val fetched = inner.getBars(symbol, interval, from, to)
        if (fetched.isEmpty()) {
            emptyUntil[key] = System.currentTimeMillis() + EMPTY_TTL
            return emptyList()
        }
        cache.upsertBars(symbol, interval, fetched)
        return cache.getBars(symbol, interval, from, to)
    }

    override fun search(query: String): List<SymbolHit> = inner.search(query)
}

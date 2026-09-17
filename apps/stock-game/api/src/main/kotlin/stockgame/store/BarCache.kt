package stockgame.store

import stockgame.domain.Bar

interface BarCache {
    fun getBars(symbol: String, interval: String, from: Long, to: Long): List<Bar>
    fun upsertBars(symbol: String, interval: String, bars: List<Bar>)
}

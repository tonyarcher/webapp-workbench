package stockgame.store

import javax.sql.DataSource
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import stockgame.domain.Bar
import stockgame.persist.PriceCacheEntity
import stockgame.persist.PriceCacheRepo

private const val DAY_MS = 24 * 60 * 60 * 1000L

@Service
@ConditionalOnBean(DataSource::class)
class JpaBarCache(private val cache: PriceCacheRepo) : BarCache {
    override fun getBars(symbol: String, interval: String, from: Long, to: Long): List<Bar> {
        val rows = cache.findBySymbolAndIntervalAndDateGreaterThanEqualAndDateLessThanEqualOrderByDateAsc(
            symbol,
            interval,
            from - DAY_MS,
            to + DAY_MS,
        )
        return rows.filter { it.date in from..to }.map { it.toBar() }
    }

    @Transactional
    override fun upsertBars(symbol: String, interval: String, bars: List<Bar>) {
        bars.forEach { bar ->
            cache.save(
                PriceCacheEntity(symbol, interval, bar.time, bar.open, bar.high, bar.low, bar.close, bar.volume),
            )
        }
    }
}

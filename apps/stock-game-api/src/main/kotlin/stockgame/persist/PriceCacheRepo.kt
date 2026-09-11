package stockgame.persist

import org.springframework.data.jpa.repository.JpaRepository

interface PriceCacheRepo : JpaRepository<PriceCacheEntity, PriceCacheId> {
    fun findBySymbolAndIntervalAndDateGreaterThanEqualAndDateLessThanEqualOrderByDateAsc(
        symbol: String,
        interval: String,
        from: Long,
        to: Long,
    ): List<PriceCacheEntity>
}

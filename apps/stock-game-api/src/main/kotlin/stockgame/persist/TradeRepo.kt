package stockgame.persist

import org.springframework.data.jpa.repository.JpaRepository

interface TradeRepo : JpaRepository<TradeEntity, Long> {
    fun findAllByOrderByExecutedAtAscIdAsc(): List<TradeEntity>
}

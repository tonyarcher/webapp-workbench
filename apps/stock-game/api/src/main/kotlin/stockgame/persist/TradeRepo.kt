package stockgame.persist

import java.util.UUID
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query

interface TradeRepo : JpaRepository<TradeEntity, Long> {
    fun findByUserIdOrderByExecutedAtAscIdAsc(userId: UUID): List<TradeEntity>
}

interface OrderRepo : JpaRepository<OrderEntity, Long> {
    fun findByUserIdOrderByExecuteAtAscIdAsc(userId: UUID): List<OrderEntity>
    fun findByUserIdAndStatusAndExecuteAtLessThanEqualOrderByExecuteAtAsc(
        userId: UUID,
        status: String,
        executeAt: Long,
    ): List<OrderEntity>

    fun findByUserIdAndId(userId: UUID, id: Long): OrderEntity?

    @Query("select distinct o.userId from OrderEntity o where o.status = 'pending'")
    fun findUserIdsWithPendingOrders(): List<UUID>
}

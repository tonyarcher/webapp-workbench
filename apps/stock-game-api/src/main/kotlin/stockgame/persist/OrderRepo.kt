package stockgame.persist

import org.springframework.data.jpa.repository.JpaRepository

interface OrderRepo : JpaRepository<OrderEntity, Long> {
    fun findAllByOrderByExecuteAtAscIdAsc(): List<OrderEntity>
    fun findByStatusAndExecuteAtLessThanEqualOrderByExecuteAtAsc(status: String, executeAt: Long): List<OrderEntity>
}

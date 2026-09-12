package stockgame.store

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import java.util.UUID
import javax.sql.DataSource
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import stockgame.domain.GameConfig
import stockgame.domain.Order
import stockgame.domain.Trade
import stockgame.persist.GameConfigEntity
import stockgame.persist.GameConfigId
import stockgame.persist.GameConfigRepo
import stockgame.persist.OrderRepo
import stockgame.persist.TradeRepo

@Service
@ConditionalOnBean(DataSource::class)
class JpaGameStore(
    private val configs: GameConfigRepo,
    private val trades: TradeRepo,
    private val orders: OrderRepo,
    private val mapper: ObjectMapper,
) : GameStore {
    override fun getConfig(userId: UUID): GameConfig? {
        val raw = configs.findById(GameConfigId(userId, "game")).orElse(null)?.value ?: return null
        return mapper.readValue<GameConfig>(raw)
    }

    override fun saveConfig(userId: UUID, config: GameConfig) {
        configs.save(GameConfigEntity(userId, "game", mapper.writeValueAsString(config)))
    }

    override fun listTrades(userId: UUID): List<Trade> =
        trades.findByUserIdOrderByExecutedAtAscIdAsc(userId).map { it.toTrade() }

    override fun insertTrade(trade: NewTrade): Trade = trades.save(trade.toEntity()).toTrade()

    override fun listOrders(userId: UUID): List<Order> =
        orders.findByUserIdOrderByExecuteAtAscIdAsc(userId).map { it.toOrder() }

    override fun insertOrder(order: NewOrder): Order = orders.save(order.toEntity()).toOrder()

    override fun pendingOrders(userId: UUID, now: Long): List<Order> =
        orders.findByUserIdAndStatusAndExecuteAtLessThanEqualOrderByExecuteAtAsc(userId, "pending", now)
            .map { it.toOrder() }

    @Transactional
    override fun fillOrderWithTrade(userId: UUID, orderId: Long, trade: NewTrade): Trade? {
        val row = orders.findByUserIdAndId(userId, orderId) ?: return null
        if (row.status != "pending") return null
        val saved = trades.save(trade.copy(userId = userId).toEntity())
        row.status = "filled"
        row.tradeId = saved.id
        orders.save(row)
        return saved.toTrade()
    }

    override fun cancelOrder(userId: UUID, orderId: Long) {
        val row = orders.findByUserIdAndId(userId, orderId) ?: return
        if (row.status != "pending") return
        row.status = "cancelled"
        orders.save(row)
    }

    override fun userIdsWithPendingOrders(): List<UUID> = orders.findUserIdsWithPendingOrders()
}

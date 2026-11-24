package timesupapi.connectors
import org.springframework.beans.factory.ObjectProvider
import org.springframework.stereotype.Component

/**
 * Connectors are looked up by id. A missing id is an error, not a fallback.
 *
 * The bean list goes through [ObjectProvider] so an empty registry is legal:
 * plain `List<Connector>` injection fails context startup when no connector
 * bean exists yet, which would take the whole API down over an unused seam.
 */
@Component
class ConnectorRegistry(connectors: ObjectProvider<Connector>) {
    private val byId: Map<String, Connector> = connectors.orderedStream().toList().associateBy { it.id }

    fun get(id: String): Connector = byId[id] ?: throw IllegalArgumentException("unknown connector: $id")

    fun getOrNull(id: String): Connector? = byId[id]

    fun ids(): List<String> = byId.keys.sorted()
}

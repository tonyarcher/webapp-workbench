package rssapi.body

/** Opaque object-store for article bodies. Implementations must not log payloads. */
interface BodyObjectClient {
    fun put(key: String, bytes: ByteArray)
    fun get(key: String): ByteArray?
    fun delete(key: String)
}

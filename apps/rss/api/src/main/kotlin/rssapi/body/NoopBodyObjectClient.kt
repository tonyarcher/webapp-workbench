package rssapi.body

/** Disabled cold tier: no object store. */
class NoopBodyObjectClient : BodyObjectClient {
    override fun put(key: String, bytes: ByteArray) = Unit
    override fun get(key: String): ByteArray? = null
    override fun delete(key: String) = Unit
}

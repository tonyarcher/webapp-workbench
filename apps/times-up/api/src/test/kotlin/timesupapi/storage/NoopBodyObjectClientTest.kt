package timesupapi.storage
import kotlin.test.Test
import kotlin.test.assertNull

class NoopBodyObjectClientTest {
    @Test
    fun noop() {
        val c = NoopBodyObjectClient()
        c.put("k", byteArrayOf(1))
        assertNull(c.get("k"))
        c.delete("k")
    }
}

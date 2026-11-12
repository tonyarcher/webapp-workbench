package radioapi.ai

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

class AiBackendTest {
    @Test
    fun basicAuthEmptyUserYieldsNoHeader() {
        assertTrue(basicAuth("", "pw").isEmpty())
    }

    @Test
    fun basicAuthEncodesPair() {
        val headers = basicAuth("user", "pw")
        assertTrue(headers["Authorization"]!!.startsWith("Basic "))
    }

    @Test
    fun requireOkPassesThroughBody() {
        assertEquals("ok", requireOk(HttpResult(200, "ok"), "probe"))
    }

    @Test
    fun requireOkThrowsOnStatus() {
        assertFailsWith<AiException> { requireOk(HttpResult(500, "bad"), "probe") }
    }

    @Test
    fun parseBodyThrowsOnBadJson() {
        assertFailsWith<AiException> { parseBody("not-json", "probe") }
    }

    @Test
    fun jsonRoundTrip() {
        val body = jsonBody(mapOf("a" to 1))
        assertEquals(1, parseJson(body).path("a").asInt())
    }
}

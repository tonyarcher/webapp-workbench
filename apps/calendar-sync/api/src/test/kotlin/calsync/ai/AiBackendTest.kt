package calsync.ai

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
        assertTrue(basicAuth("user", "pw")["Authorization"]!!.startsWith("Basic "))
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
    fun requireOkThrowsBelowRange() {
        assertFailsWith<AiException> { requireOk(HttpResult(150, "early"), "probe") }
    }

    @Test
    fun parseBodyThrowsOnBadJson() {
        assertFailsWith<AiException> { parseBody("not-json", "probe") }
    }
}

package fitnessapi.http

import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpStatusCode
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class SampleErrorTest {
    @Test
    fun patchNotFound() = withApi {
        val res = apiClient().patchJson(
            "/samples",
            """{"metric":"waist","originId":"missing","hidden":true}""",
        )
        assertEquals(HttpStatusCode.NotFound, res.status)
        assertTrue(res.bodyAsText().contains("sample not found"))
    }

    @Test
    fun infiniteValueSiRejected() = withApi {
        apiClient().postJson("/imports", WAIST_ONE)
        val res = apiClient().patchJson(
            "/samples",
            """{"metric":"waist","originId":"manual:waist:1","valueSi":1e999}""",
        )
        assertEquals(HttpStatusCode.BadRequest, res.status)
        assertTrue(res.bodyAsText().contains("valueSi must be finite"))
    }

    @Test
    fun invalidJson() = withApi {
        val res = apiClient().postJson("/imports", "{not json")
        assertEquals(HttpStatusCode.BadRequest, res.status)
        assertTrue(res.bodyAsText().contains("Invalid JSON"))
    }
}

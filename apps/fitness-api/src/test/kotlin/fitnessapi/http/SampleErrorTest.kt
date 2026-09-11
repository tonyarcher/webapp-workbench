package fitnessapi.http

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.post
import org.springframework.test.web.servlet.put

@WebMvcTest
@Import(TestStoresConfig::class)
class SampleErrorTest {
    @Autowired
    lateinit var mvc: MockMvc

    @Autowired
    lateinit var samples: FakeSampleStore

    @BeforeEach
    fun reset() {
        samples.clear()
    }

    @Test
    fun patchNotFound() {
        val res = mvc.patchJson(
            "/samples",
            """{"metric":"waist","originId":"missing","hidden":true}""",
        )
        assertEquals(404, res.response.status)
        assertTrue(res.response.contentAsString.contains("sample not found"))
    }

    @Test
    fun infiniteValueSiRejected() {
        mvc.postJson("/imports", WAIST_ONE)
        val res = mvc.patchJson(
            "/samples",
            """{"metric":"waist","originId":"manual:waist:1","valueSi":1e999}""",
        )
        assertEquals(400, res.response.status)
        assertTrue(res.response.contentAsString.contains("valueSi must be finite"))
    }

    @Test
    fun invalidJson() {
        val res = mvc.postJson("/imports", "{not json")
        assertEquals(400, res.response.status)
        assertTrue(res.response.contentAsString.contains("Invalid JSON"))
    }

    @Test
    fun bodyTooLarge() {
        val payload = "x".repeat(2_000_001)
        val res = mvc.post("/imports") {
            contentType = MediaType.APPLICATION_JSON
            content = payload
        }.andReturn()
        assertEquals(400, res.response.status)
        assertTrue(res.response.contentAsString.contains("Request body too large"))
    }

    @Test
    fun profileMissingBody() {
        val res = mvc.put("/profile") {
            contentType = MediaType.APPLICATION_JSON
        }.andReturn()
        assertEquals(400, res.response.status)
        assertTrue(res.response.contentAsString.contains("missing body"))
    }
}

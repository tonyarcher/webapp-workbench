package fitnessapi.http

import org.junit.jupiter.api.BeforeEach
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.http.HttpStatus
import org.springframework.test.web.servlet.MockMvc
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

@WebMvcTest
@Import(TestStoresConfig::class)
class WebBranchTest {
    @Autowired
    lateinit var mvc: MockMvc

    @Autowired
    lateinit var samples: FakeSampleStore

    @Autowired
    lateinit var profiles: FakeProfileStore

    @BeforeEach
    fun reset() {
        samples.clear()
        profiles.clear()
    }

    @Test
    fun profileMissingBodyIs400() {
        val res = mvc.putJson("/profile", "null")
        assertEquals(HttpStatus.BAD_REQUEST.value(), res.response.status)
    }

    @Test
    fun profilePartialBody() {
        val put = mvc.putJson("/profile", """{"sex":"female"}""")
        assertEquals(200, put.response.status)
        assertTrue(mvc.getPath("/profile").response.contentAsString.contains("female"))
    }

    @Test
    fun importEmptyBody() {
        val res = mvc.postJson("/imports", """{}""")
        assertEquals(200, res.response.status)
        assertTrue(res.response.contentAsString.contains("\"stored\":0"))
    }

    @Test
    fun importNonArraySamples() {
        val res = mvc.postJson("/imports", """{"samples":{"a":1}}""")
        assertEquals(200, res.response.status)
    }

    @Test
    fun statsLatestEmpty() {
        assertTrue(mvc.getPath("/stats").response.contentAsString.contains("metrics"))
        assertTrue(mvc.getPath("/samples/latest").response.contentAsString.contains("latest"))
        assertTrue(mvc.getPath("/rollups").response.contentAsString.contains("rollups"))
    }

    @Test
    fun samplesListFilters() {
        mvc.postJson("/imports", BODY_MASS)
        val res = mvc.getPath("/samples?metric=body_mass&from=1&to=9999999999999&limit=5")
        assertEquals(200, res.response.status)
        val badMetric = mvc.getPath("/samples?metric=nope")
        assertEquals(200, badMetric.response.status)
    }
}

package fitnessapi.http

import fitnessapi.LOCAL_USER_ID
import fitnessapi.ai.AiConfig
import fitnessapi.ai.AiQuotaService
import fitnessapi.check.PlausibilityProvider
import fitnessapi.check.PlausibilityScores
import fitnessapi.domain.IncomingSample
import fitnessapi.web.CorsConfig
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.jupiter.api.BeforeEach
import org.mockito.kotlin.any
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.post
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

@WebMvcTest
@Import(TestStoresConfig::class, CorsConfig::class)
class CheckControllerTest {
    @Autowired
    lateinit var mvc: MockMvc

    @Autowired
    lateinit var samples: FakeSampleStore

    @MockitoBean
    lateinit var aiConfig: AiConfig

    @MockitoBean
    lateinit var quotas: AiQuotaService

    @MockitoBean
    lateinit var provider: PlausibilityProvider

    @BeforeEach
    fun reset() {
        samples.clear()
        samples.importSamples(
            LOCAL_USER_ID,
            listOf(IncomingSample("body_mass", 1_700_000_000_000L, 82.0, "csv", "csv:1")),
            "csv",
            0,
            emptyList(),
        )
    }

    private fun checkBody(vararg rows: String): String = """{"samples":[${rows.joinToString(",")}]}"""

    private fun row(metric: String, value: String): String =
        """{"metric":"$metric","t":1700000000000,"valueSi":$value}"""

    @Test
    fun disabledProviderReturnsCodeVerdicts() {
        whenever(aiConfig.provider).thenReturn("")
        whenever(aiConfig.decisionApiKey).thenReturn("")

        val res = mvc.post("/imports/check") {
            header("X-Api-Version", "1")
            contentType = MediaType.APPLICATION_JSON
            content = checkBody(row("body_mass", "83"), row("nope", "1"))
        }.andReturn()

        assertEquals(200, res.response.status)
        val checks = Json.parseToJsonElement(res.response.contentAsString).jsonObject["checks"]!!.jsonArray
        assertEquals(2, checks.size)
        val byId = checks.associateBy { it.jsonObject["id"]!!.jsonPrimitive.content }
        assertEquals(false, byId.getValue("s0").jsonObject["flagged"]!!.jsonPrimitive.boolean)
        assertEquals("code", byId.getValue("s0").jsonObject["method"]!!.jsonPrimitive.content)
        assertEquals(false, byId.getValue("s1").jsonObject["valid"]!!.jsonPrimitive.boolean)
        verify(quotas, never()).consume(any(), any(), any())
        verify(provider, never()).scoreBatch(any())
    }

    @Test
    fun decisionPathFlagsOutlier() {
        whenever(aiConfig.provider).thenReturn("decision")
        whenever(aiConfig.decisionApiKey).thenReturn("k")
        whenever(provider.scoreBatch(any())).thenReturn(mapOf("s0" to PlausibilityScores(0.9, 0.8)))

        val res = mvc.post("/imports/check") {
            header("X-Api-Version", "1")
            contentType = MediaType.APPLICATION_JSON
            content = checkBody(row("body_mass", "83"))
        }.andReturn()

        assertEquals(200, res.response.status)
        val check = Json.parseToJsonElement(res.response.contentAsString).jsonObject["checks"]!!.jsonArray.single()
        assertEquals(true, check.jsonObject["flagged"]!!.jsonPrimitive.boolean)
        assertEquals("model", check.jsonObject["method"]!!.jsonPrimitive.content)
        verify(quotas).consume(any(), any(), any())
    }

    @Test
    fun decisionKeyMissingFallsBackWithoutQuota() {
        whenever(aiConfig.provider).thenReturn("decision")
        whenever(aiConfig.decisionApiKey).thenReturn("")

        val res = mvc.post("/imports/check") {
            header("X-Api-Version", "1")
            contentType = MediaType.APPLICATION_JSON
            content = checkBody(row("body_mass", "83"))
        }.andReturn()

        assertEquals(200, res.response.status)
        val check = Json.parseToJsonElement(res.response.contentAsString).jsonObject["checks"]!!.jsonArray.single()
        assertEquals("code", check.jsonObject["method"]!!.jsonPrimitive.content)
        verify(quotas, never()).consume(any(), any(), any())
    }

    @Test
    fun nullAndNonFiniteValuesAreInvalid() {
        whenever(aiConfig.provider).thenReturn("")
        whenever(aiConfig.decisionApiKey).thenReturn("")

        val res = mvc.post("/imports/check") {
            header("X-Api-Version", "1")
            contentType = MediaType.APPLICATION_JSON
            content =
                """{"samples":[
                    {"metric":"body_mass","t":1700000000000},
                    {"metric":"body_mass","t":1700000000000,"valueSi":1e999},
                    {"metric":"body_mass","valueSi":82},
                    {"metric":"body_mass","t":"NaN","valueSi":82}
                ]}"""
        }.andReturn()

        assertEquals(200, res.response.status)
        val checks = Json.parseToJsonElement(res.response.contentAsString).jsonObject["checks"]!!.jsonArray
        assertEquals(4, checks.size)
        assertTrue(checks.all { !it.jsonObject["valid"]!!.jsonPrimitive.boolean })
    }

    @Test
    fun metricWithoutHistoryScoresAgainstEmptyContext() {
        whenever(aiConfig.provider).thenReturn("decision")
        whenever(aiConfig.decisionApiKey).thenReturn("k")
        whenever(provider.scoreBatch(any())).thenReturn(mapOf("s0" to PlausibilityScores(0.5, 0.0)))

        val res = mvc.post("/imports/check") {
            header("X-Api-Version", "1")
            contentType = MediaType.APPLICATION_JSON
            content = checkBody(row("steps", "5000"))
        }.andReturn()

        assertEquals(200, res.response.status)
        val check = Json.parseToJsonElement(res.response.contentAsString).jsonObject["checks"]!!.jsonArray.single()
        assertEquals("model", check.jsonObject["method"]!!.jsonPrimitive.content)
        assertEquals(false, check.jsonObject["flagged"]!!.jsonPrimitive.boolean)
    }

    @Test
    fun providerFailureFallsBackToCode() {
        whenever(aiConfig.provider).thenReturn("decision")
        whenever(aiConfig.decisionApiKey).thenReturn("k")
        whenever(provider.scoreBatch(any())).thenAnswer { throw fitnessapi.ai.AiException("down") }

        val res = mvc.post("/imports/check") {
            header("X-Api-Version", "1")
            contentType = MediaType.APPLICATION_JSON
            content = checkBody(row("body_mass", "83"))
        }.andReturn()

        assertEquals(200, res.response.status)
        val check = Json.parseToJsonElement(res.response.contentAsString).jsonObject["checks"]!!.jsonArray.single()
        assertEquals(false, check.jsonObject["flagged"]!!.jsonPrimitive.boolean)
        assertEquals("code", check.jsonObject["method"]!!.jsonPrimitive.content)
    }

    @Test
    fun missingAndOversizedBodiesAre400() {
        val missing = mvc.post("/imports/check") {
            header("X-Api-Version", "1")
            contentType = MediaType.APPLICATION_JSON
            content = """{"nope":[]}"""
        }.andReturn()
        assertEquals(HttpStatus.BAD_REQUEST.value(), missing.response.status)
        assertTrue(missing.response.contentAsString.contains("missing samples"))

        val many = (0 until 21).joinToString(",") { row("body_mass", "82") }
        val oversized = mvc.post("/imports/check") {
            header("X-Api-Version", "1")
            contentType = MediaType.APPLICATION_JSON
            content = checkBody(many)
        }.andReturn()
        assertEquals(HttpStatus.BAD_REQUEST.value(), oversized.response.status)
    }
}

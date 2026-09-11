package fitnessapi.http

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.double
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.jupiter.api.BeforeEach
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.test.web.servlet.MockMvc

@WebMvcTest
@Import(TestStoresConfig::class)
class FitnessRoutesTest {
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
    fun importStoresOne() {
        val res = mvc.postJson("/imports", BODY_MASS)
        assertEquals(200, res.response.status)
        val body = Json.parseToJsonElement(res.response.contentAsString).jsonObject
        assertEquals(1, body["stored"]?.jsonPrimitive?.int)
    }

    @Test
    fun importDedupsAndUpserts() {
        mvc.postJson("/imports", BODY_MASS)
        val dupBody =
            """{"samples":[
                {"metric":"body_mass","t":$BODY_MASS_T,"valueSi":82,"source":"csv","originId":"csv:body_mass:1"},
                {"metric":"body_mass","t":$BODY_MASS_T,"valueSi":82,"source":"csv","originId":"csv:body_mass:1"}
            ],"source":"csv"}"""
        val dup = mvc.postJson("/imports", dupBody)
        assertEquals(1, Json.parseToJsonElement(dup.response.contentAsString).jsonObject["stored"]?.jsonPrimitive?.int)
        val replay =
            """{"samples":[{"metric":"body_mass","t":$BODY_MASS_T,"valueSi":83,
                "source":"csv","originId":"csv:body_mass:1"}],"source":"csv"}"""
        mvc.postJson("/imports", replay)
        val stats = Json.parseToJsonElement(mvc.getPath("/stats").response.contentAsString).jsonObject
        assertEquals(1, stats["metrics"]?.jsonArray?.get(0)?.jsonObject?.get("n")?.jsonPrimitive?.int)
        val latest = Json.parseToJsonElement(mvc.getPath("/samples/latest").response.contentAsString).jsonObject
        assertEquals(83.0, latest["latest"]?.jsonArray?.get(0)?.jsonObject?.get("valueSi")?.jsonPrimitive?.double)
    }

    @Test
    fun profileRoundTrip() {
        val put = mvc.putJson(
            "/profile",
            """{"sex":"male","birthYear":1988,"heightM":1.8,"displayUnit":"lb",
                "tm":{"squat":160,"bench":100,"deadlift":180,"press":70}}""",
        )
        assertEquals(200, put.response.status)
        val got = Json.parseToJsonElement(mvc.getPath("/profile").response.contentAsString).jsonObject
        assertEquals("male", got["sex"]?.jsonPrimitive?.content)
        assertEquals("lb", got["displayUnit"]?.jsonPrimitive?.content)
        assertEquals(160.0, got["tm"]?.jsonObject?.get("squat")?.jsonPrimitive?.double)
    }

    @Test
    fun samplesInvalidLimit() {
        val res = mvc.getPath("/samples?limit=abc")
        assertEquals(200, res.response.status)
    }

    @Test
    fun hideExcludesFromSeries() {
        mvc.postJson("/imports", WAIST_TWO)
        val before = Json.parseToJsonElement(mvc.getPath("/series?metric=waist").response.contentAsString).jsonObject
        assertEquals(2, before["n"]?.jsonPrimitive?.int)
        val hide = mvc.patchJson("/samples", """{"metric":"waist","originId":"manual:waist:2","hidden":true}""")
        assertEquals(200, hide.response.status)
        val after = Json.parseToJsonElement(mvc.getPath("/series?metric=waist").response.contentAsString).jsonObject
        assertEquals(1, after["n"]?.jsonPrimitive?.int)
        val rolls = Json.parseToJsonElement(mvc.getPath("/rollups").response.contentAsString)
            .jsonObject["rollups"]!!.jsonArray
        assertEquals(1, rolls.count { it.jsonObject["metric"]?.jsonPrimitive?.content == "waist" })
    }

    @Test
    fun overrideBecomesLatest() {
        mvc.postJson("/imports", WAIST_ONE)
        val over = mvc.patchJson("/samples", """{"metric":"waist","originId":"manual:waist:1","valueSi":0.85}""")
        assertEquals(200, over.response.status)
        val latest = Json.parseToJsonElement(mvc.getPath("/samples/latest").response.contentAsString).jsonObject
        val waist = latest["latest"]!!.jsonArray.first {
            it.jsonObject["metric"]?.jsonPrimitive?.content == "waist"
        }.jsonObject
        assertEquals(0.85, waist["valueSi"]?.jsonPrimitive?.double)
    }

    @Test
    fun seriesRequiresMetric() {
        val res = mvc.getPath("/series")
        assertEquals(400, res.response.status)
        assertTrue(res.response.contentAsString.contains("metric required"))
    }

    @Test
    fun unknownPath404() {
        val res = mvc.getPath("/nope")
        assertEquals(404, res.response.status)
        assertEquals("""{"error":"not found"}""", res.response.contentAsString)
    }

    @Test
    fun patchRequiresFields() {
        val res = mvc.patchJson("/samples", """{"metric":"waist"}""")
        assertEquals(400, res.response.status)
    }

    @Test
    fun importRejectsTooMany() {
        val samplesJson = List(2_001) { """{"metric":"body_mass","t":1,"valueSi":1,"originId":"x$it"}""" }
        val res = mvc.postJson("/imports", """{"samples":[${samplesJson.joinToString()}]}""")
        assertEquals(400, res.response.status)
        assertTrue(res.response.contentAsString.contains("at most 2000"))
    }
}

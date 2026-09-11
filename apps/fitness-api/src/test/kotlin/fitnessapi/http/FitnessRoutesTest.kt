package fitnessapi.http

import io.ktor.client.request.get
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpStatusCode
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.double
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

class FitnessRoutesTest {
    @Test
    fun importStoresOne() = withApi {
        val client = apiClient()
        val res = client.postJson("/imports", BODY_MASS)
        assertEquals(HttpStatusCode.OK, res.status)
        val body = Json.parseToJsonElement(res.bodyAsText()).jsonObject
        assertEquals(1, body["stored"]?.jsonPrimitive?.int)
    }

    @Test
    fun importDedupsAndUpserts() = withApi {
        val client = apiClient()
        client.postJson("/imports", BODY_MASS)
        val dupBody =
            """{"samples":[
                {"metric":"body_mass","t":$BODY_MASS_T,"valueSi":82,"source":"csv","originId":"csv:body_mass:1"},
                {"metric":"body_mass","t":$BODY_MASS_T,"valueSi":82,"source":"csv","originId":"csv:body_mass:1"}
            ],"source":"csv"}"""
        val dup = client.postJson("/imports", dupBody)
        assertEquals(1, Json.parseToJsonElement(dup.bodyAsText()).jsonObject["stored"]?.jsonPrimitive?.int)
        val replay =
            """{"samples":[{"metric":"body_mass","t":$BODY_MASS_T,"valueSi":83,
                "source":"csv","originId":"csv:body_mass:1"}],"source":"csv"}"""
        client.postJson("/imports", replay)
        val stats = Json.parseToJsonElement(client.get("/stats").bodyAsText()).jsonObject
        assertEquals(1, stats["metrics"]?.jsonArray?.get(0)?.jsonObject?.get("n")?.jsonPrimitive?.int)
        val latest = Json.parseToJsonElement(client.get("/samples/latest").bodyAsText()).jsonObject
        assertEquals(83.0, latest["latest"]?.jsonArray?.get(0)?.jsonObject?.get("valueSi")?.jsonPrimitive?.double)
    }

    @Test
    fun profileRoundTrip() = withApi {
        val client = apiClient()
        val put = client.putJson(
            "/profile",
            """{"sex":"male","birthYear":1988,"heightM":1.8,"displayUnit":"lb",
                "tm":{"squat":160,"bench":100,"deadlift":180,"press":70}}""",
        )
        assertEquals(HttpStatusCode.OK, put.status)
        val got = Json.parseToJsonElement(client.get("/profile").bodyAsText()).jsonObject
        assertEquals("male", got["sex"]?.jsonPrimitive?.content)
        assertEquals("lb", got["displayUnit"]?.jsonPrimitive?.content)
        assertEquals(160.0, got["tm"]?.jsonObject?.get("squat")?.jsonPrimitive?.double)
    }

    @Test
    fun samplesInvalidLimit() = withApi {
        val client = apiClient()
        val res = client.get("/samples?limit=abc")
        assertEquals(HttpStatusCode.OK, res.status)
    }

    @Test
    fun hideExcludesFromSeries() = withApi {
        val client = apiClient()
        client.postJson("/imports", WAIST_TWO)
        val before = Json.parseToJsonElement(client.get("/series?metric=waist").bodyAsText()).jsonObject
        assertEquals(2, before["n"]?.jsonPrimitive?.int)
        val hide = client.patchJson("/samples", """{"metric":"waist","originId":"manual:waist:2","hidden":true}""")
        assertEquals(HttpStatusCode.OK, hide.status)
        val after = Json.parseToJsonElement(client.get("/series?metric=waist").bodyAsText()).jsonObject
        assertEquals(1, after["n"]?.jsonPrimitive?.int)
        val rolls = Json.parseToJsonElement(client.get("/rollups").bodyAsText()).jsonObject["rollups"]!!.jsonArray
        assertEquals(1, rolls.count { it.jsonObject["metric"]?.jsonPrimitive?.content == "waist" })
    }

    @Test
    fun overrideBecomesLatest() = withApi {
        val client = apiClient()
        client.postJson("/imports", WAIST_ONE)
        val over = client.patchJson("/samples", """{"metric":"waist","originId":"manual:waist:1","valueSi":0.85}""")
        assertEquals(HttpStatusCode.OK, over.status)
        val latest = Json.parseToJsonElement(client.get("/samples/latest").bodyAsText()).jsonObject
        val waist = latest["latest"]!!.jsonArray.first {
            it.jsonObject["metric"]?.jsonPrimitive?.content == "waist"
        }.jsonObject
        assertEquals(0.85, waist["valueSi"]?.jsonPrimitive?.double)
    }

    @Test
    fun seriesRequiresMetric() = withApi {
        val res = apiClient().get("/series")
        assertEquals(HttpStatusCode.BadRequest, res.status)
        assertTrue(res.bodyAsText().contains("metric required"))
    }

    @Test
    fun unknownPath404() = withApi {
        val res = apiClient().get("/nope")
        assertEquals(HttpStatusCode.NotFound, res.status)
        assertEquals("""{"error":"not found"}""", res.bodyAsText())
    }

    @Test
    fun patchRequiresFields() = withApi {
        val res = apiClient().patchJson("/samples", """{"metric":"waist"}""")
        assertEquals(HttpStatusCode.BadRequest, res.status)
    }

    @Test
    fun importRejectsTooMany() = withApi {
        val samples = List(2_001) { """{"metric":"body_mass","t":1,"valueSi":1,"originId":"x$it"}""" }
        val res = apiClient().postJson("/imports", """{"samples":[${samples.joinToString()}]}""")
        assertEquals(HttpStatusCode.BadRequest, res.status)
        assertTrue(res.bodyAsText().contains("at most 2000"))
    }
}

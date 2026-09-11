package fitnessapi.http

import io.ktor.client.HttpClient
import io.ktor.client.request.patch
import io.ktor.client.request.post
import io.ktor.client.request.put
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.http.ContentType
import io.ktor.http.contentType
import io.ktor.server.testing.ApplicationTestBuilder
import io.ktor.server.testing.testApplication
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import fitnessapi.Settings
import fitnessapi.module
import fitnessapi.store.FitnessServices

internal val TEST_CLOCK: Clock = Clock.fixed(Instant.parse("2026-09-11T17:00:00Z"), ZoneOffset.UTC)

internal val TEST_SETTINGS = Settings(3003, "", "error", "fitness-api")

internal val BODY_MASS_T = Instant.parse("2026-01-05T08:00:00Z").toEpochMilli()

internal val BODY_MASS =
    """{"samples":[{"metric":"body_mass","t":$BODY_MASS_T,"valueSi":82,"source":"csv","originId":"csv:body_mass:1"}],"source":"csv"}"""

internal val WAIST_T1 = Instant.parse("2026-02-01T08:00:00Z").toEpochMilli()

internal val WAIST_T2 = Instant.parse("2026-02-08T08:00:00Z").toEpochMilli()

internal val WAIST_ONE =
    """{"samples":[{"metric":"waist","t":$WAIST_T1,"valueSi":0.9,"source":"manual","originId":"manual:waist:1"}],"source":"manual"}"""

internal val WAIST_TWO =
    """{"samples":[
        {"metric":"waist","t":$WAIST_T1,"valueSi":0.9,"source":"manual","originId":"manual:waist:1"},
        {"metric":"waist","t":$WAIST_T2,"valueSi":0.88,"source":"manual","originId":"manual:waist:2"}
    ],"source":"manual"}"""

internal fun testFitness(): FitnessServices =
    FitnessServices(TEST_CLOCK, FakeProfileStore(), FakeSampleStore())

internal fun ApplicationTestBuilder.apiClient(): HttpClient = createClient {
    followRedirects = false
}

internal suspend fun HttpClient.postJson(path: String, body: String): HttpResponse = post(path) {
    contentType(ContentType.Application.Json)
    setBody(body)
}

internal suspend fun HttpClient.putJson(path: String, body: String): HttpResponse = put(path) {
    contentType(ContentType.Application.Json)
    setBody(body)
}

internal suspend fun HttpClient.patchJson(path: String, body: String): HttpResponse = patch(path) {
    contentType(ContentType.Application.Json)
    setBody(body)
}

internal fun withApi(fitness: FitnessServices = testFitness(), block: suspend ApplicationTestBuilder.() -> Unit) =
    testApplication {
        application { module(TEST_SETTINGS, dataSource = null, fitness = fitness) }
        block()
    }

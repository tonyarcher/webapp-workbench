package fitnessapi.http

import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.MvcResult
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.patch
import org.springframework.test.web.servlet.post
import org.springframework.test.web.servlet.put

internal val TEST_CLOCK: Clock = Clock.fixed(Instant.parse("2026-09-11T17:00:00Z"), ZoneOffset.UTC)

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

internal fun MockMvc.postJson(path: String, body: String): MvcResult = post(path) {
    contentType = MediaType.APPLICATION_JSON
    content = body
}.andReturn()

internal fun MockMvc.putJson(path: String, body: String): MvcResult = put(path) {
    contentType = MediaType.APPLICATION_JSON
    content = body
}.andReturn()

internal fun MockMvc.patchJson(path: String, body: String): MvcResult = patch(path) {
    contentType = MediaType.APPLICATION_JSON
    content = body
}.andReturn()

internal fun MockMvc.getPath(path: String): MvcResult = get(path).andReturn()

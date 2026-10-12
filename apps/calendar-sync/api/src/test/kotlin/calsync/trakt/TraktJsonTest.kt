package calsync.trakt

import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class TraktJsonTest {
    @Test
    fun malformedBodyIsNull() {
        assertNull(parseJsonBody("nope{{{"))
    }

    @Test
    fun deviceCodeRequiresAllFields() {
        val full = parseJsonBody(
            """{"device_code":"dc","user_code":"UC-1","verification_url":"https://trakt.tv/activate","expires_in":600,"interval":5}""",
        )!!
        assertEquals(
            DeviceCodeTokens("dc", "UC-1", "https://trakt.tv/activate", 600, 5),
            parseDeviceCode(full),
        )
        assertNull(parseDeviceCode(parseJsonBody("""{"user_code":"UC-1","expires_in":600,"interval":5}""")))
        assertNull(parseDeviceCode(parseJsonBody("""{"device_code":"dc","expires_in":600,"interval":5}""")))
        assertNull(parseDeviceCode(parseJsonBody("""{"device_code":"dc","user_code":"UC-1","interval":5}""")))
        assertNull(parseDeviceCode(parseJsonBody("""{"device_code":"dc","user_code":"UC-1","expires_in":600}""")))
        assertNull(
            parseDeviceCode(parseJsonBody("""{"device_code":7,"user_code":"UC-1","expires_in":600,"interval":5}""")),
        )
        assertNull(parseDeviceCode(parseJsonBody("""[1,2]""")))
        assertNull(parseDeviceCode(null))
    }

    @Test
    fun untrustedVerificationUrlFallsBack() {
        val evil = parseJsonBody(
            """{"device_code":"dc","user_code":"UC","verification_url":"https://evil.example/x","expires_in":600,"interval":5}""",
        )!!
        assertEquals(TRAKT_VERIFICATION_URL, parseDeviceCode(evil)?.verificationUrl)
        val sub = parseJsonBody(
            """{"device_code":"dc","user_code":"UC","verification_url":"https://a.trakt.tv/x","expires_in":600,"interval":5}""",
        )!!
        assertEquals("https://a.trakt.tv/x", parseDeviceCode(sub)?.verificationUrl)
        val missing = parseJsonBody(
            """{"device_code":"dc","user_code":"UC","expires_in":600,"interval":5}""",
        )!!
        assertEquals(TRAKT_VERIFICATION_URL, parseDeviceCode(missing)?.verificationUrl)
        val malformed = parseJsonBody(
            """{"device_code":"dc","user_code":"UC","verification_url":"::not a url::","expires_in":600,"interval":5}""",
        )!!
        assertEquals(TRAKT_VERIFICATION_URL, parseDeviceCode(malformed)?.verificationUrl)
    }

    @Test
    fun tokenRequiresAllFields() {
        val full = parseJsonBody("""{"access_token":"a","refresh_token":"r","expires_in":3600}""")!!
        assertEquals(TraktTokens("a", "r", 3600), parseToken(full))
        assertNull(parseToken(parseJsonBody("""{"access_token":"a"}""")))
        assertNull(parseToken(parseJsonBody("""{"refresh_token":"r","expires_in":3600}""")))
        assertNull(parseToken(parseJsonBody("""{"access_token":"a","refresh_token":"r"}""")))
        assertNull(parseToken(parseJsonBody("""{"access_token":"a","refresh_token":"r","expires_in":"soon"}""")))
        assertNull(parseToken(null))
    }

    @Test
    fun pollMapping() {
        val token = parseJsonBody("""{"access_token":"a","refresh_token":"r","expires_in":3600}""")!!
        assertEquals(DevicePoll.Token(TraktTokens("a", "r", 3600)), pollStatusOf(200, token))
        assertEquals(DevicePoll.Pending, pollStatusOf(400, parseJsonBody("""{"error":"authorization_pending"}""")))
        assertEquals(DevicePoll.Pending, pollStatusOf(400, parseJsonBody("""{"error":"slow_down"}""")))
        assertEquals(DevicePoll.Pending, pollStatusOf(429, parseJsonBody("""{}""")))
        assertEquals(
            DevicePoll.Denied("Trakt access denied"),
            pollStatusOf(400, parseJsonBody("""{"error":"access_denied"}""")),
        )
        assertEquals(
            DevicePoll.Denied("Trakt access denied"),
            pollStatusOf(400, parseJsonBody("""{"error":"denied"}""")),
        )
        assertEquals(
            DevicePoll.Expired("Trakt device code expired"),
            pollStatusOf(400, parseJsonBody("""{"error":"expired_token"}""")),
        )
        assertEquals(
            DevicePoll.Expired("Trakt device code expired"),
            pollStatusOf(400, parseJsonBody("""{"error":"expired"}""")),
        )
        assertEquals(DevicePoll.Pending, pollStatusOf(500, null))
    }
}

package calsync.web

import calsync.persist.UserEntity
import calsync.persist.UserRepo
import calsync.trakt.CredentialStatus
import calsync.trakt.DeviceCodeTokens
import calsync.trakt.DevicePollResult
import calsync.trakt.TraktService
import calsync.trakt.TraktVaultService
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.delete
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post
import java.time.Instant
import java.util.UUID
import kotlin.test.assertEquals

private fun calJwt(sub: String): Jwt = Jwt.withTokenValue("tok")
    .header("alg", "RS256")
    .claim("sub", sub)
    .claim("preferred_username", sub)
    .claim("aud", listOf("calendar-sync"))
    .build()

@WebMvcTest(TraktController::class)
@Import(SecurityConfig::class, RequestIdFilter::class, IdentityUser::class)
class TraktControllerTest {
    @Autowired
    lateinit var mvc: MockMvc

    @MockitoBean
    lateinit var decoder: JwtDecoder

    @MockitoBean
    lateinit var users: UserRepo

    @MockitoBean
    lateinit var trakt: TraktService

    @MockitoBean
    lateinit var vault: TraktVaultService

    private fun auth(uid: UUID) {
        whenever(decoder.decode(any())).thenReturn(calJwt("u1"))
        whenever(users.findBySubject("u1")).thenReturn(UserEntity(id = uid, subject = "u1"))
    }

    @Test
    fun saveCredentialsShape200() {
        val uid = UUID.randomUUID()
        auth(uid)

        mvc.post("/trakt/credentials") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer t")
            contentType = MediaType.APPLICATION_JSON
            content = """{"clientId":"cid","clientSecret":"sec"}"""
        }.andExpect {
            status { isOk() }
            jsonPath("$.configured") { value(true) }
        }
        verify(vault).saveCredentials(eq(uid), eq("cid"), eq("sec"))
    }

    @Test
    fun credentialStatusShape200() {
        auth(UUID.randomUUID())
        whenever(vault.status(any())).thenReturn(
            CredentialStatus(true, true, Instant.ofEpochMilli(2_000L)),
        )

        mvc.get("/trakt/credentials") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer t")
        }.andExpect {
            status { isOk() }
            jsonPath("$.configured") { value(true) }
            jsonPath("$.authorized") { value(true) }
            jsonPath("$.expiresAt") { value(2_000L) }
        }
    }

    @Test
    fun credentialStatusWithoutExpiry() {
        auth(UUID.randomUUID())
        whenever(vault.status(any())).thenReturn(
            CredentialStatus(true, false, null),
        )

        mvc.get("/trakt/credentials") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer t")
        }.andExpect {
            status { isOk() }
            jsonPath("$.configured") { value(true) }
            jsonPath("$.authorized") { value(false) }
        }
    }

    @Test
    fun clearCredentialsShape200() {
        val uid = UUID.randomUUID()
        auth(uid)

        mvc.delete("/trakt/credentials") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer t")
        }.andExpect {
            status { isOk() }
            jsonPath("$.configured") { value(false) }
        }
        verify(vault).clear(eq(uid))
    }

    @Test
    fun deviceCodeShape200() {
        auth(UUID.randomUUID())
        whenever(trakt.deviceCode(any())).thenReturn(
            DeviceCodeTokens("dc", "UC-1", "https://trakt.tv/activate", 600, 5),
        )

        mvc.post("/trakt/device/code") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer t")
        }.andExpect {
            status { isOk() }
            jsonPath("$.deviceCode") { value("dc") }
            jsonPath("$.userCode") { value("UC-1") }
            jsonPath("$.verificationUrl") { value("https://trakt.tv/activate") }
            jsonPath("$.expiresIn") { value(600) }
            jsonPath("$.interval") { value(5) }
        }
    }

    @Test
    fun deviceTokenAuthorized() {
        auth(UUID.randomUUID())
        whenever(trakt.pollDeviceToken(any(), any())).thenReturn(
            DevicePollResult(authorized = true, expiresAt = Instant.ofEpochMilli(2_000L)),
        )

        mvc.post("/trakt/device/token") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer t")
            contentType = MediaType.APPLICATION_JSON
            content = """{"deviceCode":"dc"}"""
        }.andExpect {
            status { isOk() }
            jsonPath("$.authorized") { value(true) }
            jsonPath("$.expiresAt") { value(2_000L) }
        }
    }

    @Test
    fun deviceTokenPending() {
        auth(UUID.randomUUID())
        whenever(trakt.pollDeviceToken(any(), any())).thenReturn(
            DevicePollResult(authorized = false, expiresAt = null),
        )

        mvc.post("/trakt/device/token") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer t")
            contentType = MediaType.APPLICATION_JSON
            content = """{"deviceCode":"dc"}"""
        }.andExpect {
            status { isOk() }
            jsonPath("$.authorized") { value(false) }
        }
    }

    @Test
    fun deviceTokenBlankBodyPassesEmpty() {
        val uid = UUID.randomUUID()
        auth(uid)
        whenever(trakt.pollDeviceToken(any(), any())).thenReturn(
            DevicePollResult(authorized = false, expiresAt = null),
        )

        mvc.post("/trakt/device/token") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer t")
            contentType = MediaType.APPLICATION_JSON
            content = """{}"""
        }.andExpect {
            status { isOk() }
        }
        verify(trakt).pollDeviceToken(eq(uid), eq(""))
    }

    @Test
    fun refreshTokenShape200() {
        auth(UUID.randomUUID())
        whenever(trakt.refreshTokens(any())).thenReturn(Instant.ofEpochMilli(2_000L))

        mvc.post("/trakt/token/refresh") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer t")
        }.andExpect {
            status { isOk() }
            jsonPath("$.ok") { value(true) }
            jsonPath("$.expiresAt") { value(2_000L) }
        }
    }

    @Test
    fun missingJwtIs401() {
        val res = mvc.get("/trakt/credentials") {
            header("X-Api-Version", "1")
        }.andReturn()
        assertEquals(HttpStatus.UNAUTHORIZED.value(), res.response.status)
        assertEquals("""{"error":"unauthorized"}""", res.response.contentAsString)
    }

    @Test
    fun blankCredentialBodyPassesEmpty() {
        val uid = UUID.randomUUID()
        auth(uid)

        mvc.post("/trakt/credentials") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer t")
            contentType = MediaType.APPLICATION_JSON
            content = """{}"""
        }.andExpect {
            status { isOk() }
        }
        verify(vault).saveCredentials(eq(uid), eq(""), eq(""))
    }

    @Test
    fun missingVersionIs404() {
        auth(UUID.randomUUID())
        val res = mvc.get("/trakt/credentials") {
            header("Authorization", "Bearer t")
        }.andReturn()
        assertEquals(HttpStatus.NOT_FOUND.value(), res.response.status)
    }
}

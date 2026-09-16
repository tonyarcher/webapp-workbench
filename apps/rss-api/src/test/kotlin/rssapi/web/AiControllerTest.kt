package rssapi.web

import java.util.UUID
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.anyOrNull
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.http.MediaType
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post
import rssapi.ai.AiService
import rssapi.ai.AiStatus
import rssapi.persist.UserEntity
import rssapi.persist.UserRepo

private fun aiJwt(sub: String): Jwt = Jwt.withTokenValue("tok")
    .header("alg", "RS256")
    .claim("sub", sub)
    .claim("preferred_username", "alice")
    .claim("aud", listOf("rss-reader"))
    .build()

@WebMvcTest(AiController::class)
@Import(SecurityConfig::class, RequestIdFilter::class, IdentityUser::class)
class AiControllerTest {
    @Autowired
    lateinit var mvc: MockMvc

    @MockitoBean
    lateinit var decoder: JwtDecoder

    @MockitoBean
    lateinit var users: UserRepo

    @MockitoBean
    lateinit var ai: AiService

    private fun stubAuth() {
        whenever(decoder.decode(any())).thenReturn(aiJwt("u1"))
        whenever(users.findBySubject("u1")).thenReturn(
            UserEntity(id = UUID.randomUUID(), label = "identity", subject = "u1", username = "alice"),
        )
    }

    @Test
    fun statusReportsAvailability() {
        stubAuth()
        whenever(ai.status()).thenReturn(AiStatus("ollama", "qwen3:8b", true))

        mvc.get("/ai/status") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer good")
        }.andExpect {
            status { isOk() }
            jsonPath("$.available") { value(true) }
            jsonPath("$.provider") { value("ollama") }
        }
    }

    @Test
    fun summarizeReturnsText() {
        stubAuth()
        whenever(ai.summarize(any(), any(), any())).thenReturn("- a\n- b")

        mvc.post("/ai/summarize") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer good")
            contentType = MediaType.APPLICATION_JSON
            content = """{"title":"T","text":"body"}"""
        }.andExpect {
            status { isOk() }
            jsonPath("$.summary") { value("- a\n- b") }
        }
    }

    @Test
    fun quotaErrorSurfaces429() {
        stubAuth()
        whenever(ai.summarize(any(), anyOrNull(), any())).thenThrow(ApiException(429, "hourly AI budget used"))

        mvc.post("/ai/summarize") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer good")
            contentType = MediaType.APPLICATION_JSON
            content = """{"text":"body"}"""
        }.andExpect {
            status { isTooManyRequests() }
        }
    }

    @Test
    fun missingTextIs400() {
        stubAuth()

        mvc.post("/ai/summarize") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer good")
            contentType = MediaType.APPLICATION_JSON
            content = """{}"""
        }.andExpect {
            status { isBadRequest() }
        }
    }
}

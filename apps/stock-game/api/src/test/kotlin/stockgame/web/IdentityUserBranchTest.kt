package stockgame.web

import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken
import stockgame.persist.UserEntity
import stockgame.persist.UserRepo
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class IdentityUserBranchTest {
    private val users: UserRepo = mock()

    private fun auth(sub: String?, name: String?) {
        val builder = Jwt.withTokenValue("tok").header("alg", "RS256")
        if (sub != null) builder.claim("sub", sub)
        if (name != null) builder.claim("preferred_username", name)
        val token = builder.build()
        SecurityContextHolder.getContext().authentication = JwtAuthenticationToken(token)
    }

    private fun clear() {
        SecurityContextHolder.clearContext()
    }

    @Test
    fun missingAuthRejected() {
        clear()
        assertFailsWith<ApiException> { IdentityUser(users).id }
        auth("", "alice")
        assertFailsWith<ApiException> { IdentityUser(users).id }
        clear()
    }

    @Test
    fun renamesOnClaimChange() {
        val id = UUID.randomUUID()
        auth("s1", "new-name")
        whenever(users.findBySubject("s1")).thenReturn(UserEntity(id = id, subject = "s1", username = "old"))
        assertEquals(id, IdentityUser(users).id)
        verify(users).save(org.mockito.kotlin.check { assertEquals("new-name", it.username) })
        clear()
    }

    @Test
    fun sameUsernameSkipsSave() {
        val id = UUID.randomUUID()
        auth("s1", "same")
        whenever(users.findBySubject("s1")).thenReturn(UserEntity(id = id, subject = "s1", username = "same"))
        assertEquals(id, IdentityUser(users).id)
        verify(users, org.mockito.kotlin.never()).save(any())
        clear()
    }

    @Test
    fun raceFallsBackToExisting() {
        val id = UUID.randomUUID()
        auth("s2", null)
        whenever(users.findBySubject("s2"))
            .thenReturn(null)
            .thenReturn(UserEntity(id = id, subject = "s2"))
        whenever(users.save(any<UserEntity>())).thenThrow(DataIntegrityViolationException("race"))
        assertEquals(id, IdentityUser(users).id)
        clear()
    }

    @Test
    fun raceWithoutRowIs500() {
        auth("s3", null)
        whenever(users.findBySubject("s3")).thenReturn(null)
        whenever(users.save(any<UserEntity>())).thenThrow(DataIntegrityViolationException("race"))
        assertFailsWith<ApiException> { IdentityUser(users).id }
        clear()
    }
}

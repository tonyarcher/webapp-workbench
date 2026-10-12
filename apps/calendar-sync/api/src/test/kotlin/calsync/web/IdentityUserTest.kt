package calsync.web

import calsync.persist.UserEntity
import calsync.persist.UserRepo
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken
import java.time.Instant
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull

@ExtendWith(MockitoExtension::class)
class IdentityUserTest {
    @Mock
    lateinit var users: UserRepo

    private val uid: UUID = UUID.randomUUID()

    @AfterEach
    fun clearSecurity() {
        SecurityContextHolder.clearContext()
    }

    private fun login(claims: Map<String, Any?> = mapOf("sub" to "s1", "preferred_username" to "alice")) {
        val builder = Jwt.withTokenValue("tok").header("alg", "RS256")
        claims.forEach { (name, value) -> value?.let { builder.claim(name, it) } }
        SecurityContextHolder.getContext().authentication = JwtAuthenticationToken(builder.build())
    }

    @Test
    fun provisionsNewUser() {
        login()
        whenever(users.findBySubject("s1")).thenReturn(null)
        whenever(users.save(any<UserEntity>())).thenAnswer {
            it.getArgument<UserEntity>(0).apply { id = uid }
        }
        val user = IdentityUser(users)
        assertEquals(uid, user.id)
        assertEquals("alice", user.username)
    }

    @Test
    fun existingUserWithoutChangesSkipsSave() {
        login()
        val entity = UserEntity(
            id = uid,
            subject = "s1",
            username = "alice",
            lastSeenAt = Instant.now(),
        )
        whenever(users.findBySubject("s1")).thenReturn(entity)
        val user = IdentityUser(users)
        assertEquals(uid, user.id)
        verify(users, never()).save(any())
    }

    @Test
    fun existingUserNullLastSeenSaves() {
        login()
        val entity = UserEntity(
            id = uid,
            subject = "s1",
            username = "alice",
            lastSeenAt = null,
        )
        whenever(users.findBySubject("s1")).thenReturn(entity)
        assertEquals(uid, IdentityUser(users).id)
        verify(users).save(entity)
    }

    @Test
    fun existingUserRenamedAndStaleTouchSaves() {
        login()
        val entity = UserEntity(
            id = uid,
            subject = "s1",
            username = "old",
            lastSeenAt = Instant.now().minusSeconds(7_200),
        )
        whenever(users.findBySubject("s1")).thenReturn(entity)
        val user = IdentityUser(users)
        assertEquals("alice", user.username)
        verify(users).save(entity)
    }

    @Test
    fun parallelProvisionRaceRecovers() {
        login()
        whenever(users.findBySubject("s1")).thenReturn(null)
            .thenReturn(UserEntity(id = uid, subject = "s1"))
        // First save loses the race; the recovery touch saves cleanly.
        whenever(users.save(any<UserEntity>()))
            .thenThrow(DataIntegrityViolationException("dup"))
            .thenAnswer { it.getArgument<UserEntity>(0) }
        assertEquals(uid, IdentityUser(users).id)
    }

    @Test
    fun parallelProvisionRaceMissingIs500() {
        login()
        whenever(users.findBySubject("s1")).thenReturn(null)
        whenever(users.save(any<UserEntity>())).thenThrow(DataIntegrityViolationException("dup"))
        val err = assertFailsWith<ApiException> { IdentityUser(users).id }
        assertEquals(org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR, err.status)
    }

    @Test
    fun missingAuthenticationIs401() {
        val err = assertFailsWith<ApiException> { IdentityUser(users).id }
        assertEquals(org.springframework.http.HttpStatus.UNAUTHORIZED, err.status)
    }

    @Test
    fun wrongAuthenticationTypeIs401() {
        // username resolves through the entity, so a non-JWT authentication
        // fails at the subject check exactly like a missing one.
        SecurityContextHolder.getContext().authentication =
            org.springframework.security.authentication.TestingAuthenticationToken("u", "p")
        val err = assertFailsWith<ApiException> { IdentityUser(users).id }
        assertEquals(org.springframework.http.HttpStatus.UNAUTHORIZED, err.status)
    }

    @Test
    fun blankSubjectIs401() {
        login(mapOf("preferred_username" to "alice"))
        val err = assertFailsWith<ApiException> { IdentityUser(users).id }
        assertEquals(org.springframework.http.HttpStatus.UNAUTHORIZED, err.status)
    }

    @Test
    fun emptyStringSubjectIs401() {
        login(mapOf("sub" to "", "preferred_username" to "alice"))
        val err = assertFailsWith<ApiException> { IdentityUser(users).id }
        assertEquals(org.springframework.http.HttpStatus.UNAUTHORIZED, err.status)
    }

    @Test
    fun missingUsernameClaimIsNull() {
        login(mapOf("sub" to "s1"))
        whenever(users.findBySubject("s1")).thenReturn(null)
        whenever(users.save(any<UserEntity>())).thenAnswer {
            it.getArgument<UserEntity>(0).apply { id = uid }
        }
        assertNull(IdentityUser(users).username)
    }
}
